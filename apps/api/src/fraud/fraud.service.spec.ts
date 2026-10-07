import { describe, expect, it, vi } from "vitest";
import { FraudRulesRepository } from "./fraud-rules.repository";
import { FlaggedEventsRepository } from "./flagged-events.repository";
import { FraudService } from "./fraud.service";

function fakeRedis() {
  const sets = new Map<string, { score: number; member: string }[]>();
  const store = (key: string) => {
    let entries = sets.get(key);
    if (!entries) {
      entries = [];
      sets.set(key, entries);
    }
    return entries;
  };
  return {
    zadd: vi.fn(async (key: string, score: number, member: string) => {
      store(key).push({ score, member });
      return 1;
    }),
    zremrangebyscore: vi.fn(async (key: string, min: number, max: number) => {
      const entries = store(key);
      const kept = entries.filter((entry) => entry.score < min || entry.score > max);
      sets.set(key, kept);
      return entries.length - kept.length;
    }),
    zremrangebyrank: vi.fn(async (key: string, start: number, stop: number) => {
      const entries = [...store(key)].sort((a, b) => a.score - b.score);
      const removed = entries.slice(start, stop < 0 ? entries.length + stop + 1 : stop + 1);
      const removedMembers = new Set(removed.map((entry) => entry.member));
      sets.set(
        key,
        store(key).filter((entry) => !removedMembers.has(entry.member)),
      );
      return removed.length;
    }),
    zrangebyscore: vi.fn(async (key: string, min: number, max: number) => {
      return store(key)
        .filter((entry) => entry.score >= min && entry.score <= max)
        .sort((a, b) => a.score - b.score)
        .map((entry) => entry.member);
    }),
    zcard: vi.fn(async (key: string) => store(key).length),
    expire: vi.fn(async () => 1),
  };
}

const RULES: Record<string, { threshold: string; windowSeconds: number; enabled: boolean }> = {
  "order-velocity": { threshold: "10", windowSeconds: 3600, enabled: true },
  "payout-velocity": { threshold: "5", windowSeconds: 86400, enabled: true },
  "amount-anomaly": { threshold: "3.0", windowSeconds: 2592000, enabled: true },
  "new-account-high-value": { threshold: "100000", windowSeconds: 604800, enabled: true },
  "login-burst": { threshold: "5", windowSeconds: 600, enabled: true },
  "discount-abuse": { threshold: "5", windowSeconds: 3600, enabled: true },
  "dispute-rate": { threshold: "0.3", windowSeconds: 2592000, enabled: true },
};

function setup(overrides: Record<string, Partial<(typeof RULES)[string]>> = {}) {
  const flagged: unknown[] = [];
  const rules = {
    findByName: vi.fn(async (name: string) => {
      const rule = { ...(RULES[name] ?? {}), ...(overrides[name] ?? {}) };
      if (!rule.threshold) return null;
      return { name, ...rule };
    }),
    list: vi.fn(),
    update: vi.fn(),
  };
  const events = {
    create: vi.fn(async (data: unknown) => {
      flagged.push(data);
      return data;
    }),
    list: vi.fn(),
  };
  const redis = fakeRedis();
  const service = new FraudService(
    rules as unknown as FraudRulesRepository,
    events as unknown as FlaggedEventsRepository,
    redis as never,
  );
  return { service, rules, events, redis, flagged };
}

describe("FraudService", () => {
  it("flags order velocity past the threshold", async () => {
    const { service, flagged } = setup();
    let last = { suspicious: false };
    for (let i = 0; i < 11; i += 1) {
      last = await service.screenOrder("buyer-1", 1000);
    }
    expect(last.suspicious).toBe(true);
    expect(flagged).toHaveLength(1);
  });

  it("flags payout velocity and amount outliers", async () => {
    const { service } = setup();
    let last = { suspicious: false };
    for (let i = 0; i < 6; i += 1) {
      last = await service.screenPayout("seller-1", 1000);
    }
    expect(last.suspicious).toBe(true);
    expect(last.rule).toBe("payout-velocity");
  });

  it("flags amounts beyond the historical average", async () => {
    const { service } = setup();
    for (let i = 0; i < 3; i += 1) {
      expect(await service.checkAmountAnomaly("buyer-1", 10000)).toEqual({ suspicious: false });
    }
    const flagged = await service.checkAmountAnomaly("buyer-1", 40000);
    expect(flagged.suspicious).toBe(true);
    expect(flagged.rule).toBe("amount-anomaly");
  });

  it("flags large moves on young accounts only", async () => {
    const { service } = setup();
    const young = await service.checkNewAccount("u-1", new Date(Date.now() - 86400000), 15000000);
    expect(young.suspicious).toBe(true);

    const old = await service.checkNewAccount("u-2", new Date(Date.now() - 30 * 86400000), 15000000);
    expect(old.suspicious).toBe(false);

    const small = await service.checkNewAccount("u-3", new Date(Date.now() - 86400000), 5000);
    expect(small.suspicious).toBe(false);
  });

  it("flags login bursts per identifier", async () => {
    const { service, flagged } = setup();
    let last = { suspicious: false };
    for (let i = 0; i < 6; i += 1) {
      last = await service.screenLogin("attacker@test.com");
    }
    expect(last.suspicious).toBe(true);
    expect(flagged).toHaveLength(1);
  });

  it("flags discount redemption abuse", async () => {
    const { service } = setup();
    let last = { suspicious: false };
    for (let i = 0; i < 6; i += 1) {
      last = await service.screenDiscountRedemption("buyer-1");
    }
    expect(last.suspicious).toBe(true);
    expect(last.rule).toBe("discount-abuse");
  });

  it("flags dispute rates above the threshold", async () => {
    const { service } = setup();
    for (let i = 0; i < 4; i += 1) {
      await service.recordOrder("buyer-1", 1000);
    }
    await service.recordDispute("buyer-1");
    expect(await service.screenDisputeRate("buyer-1")).toEqual({ suspicious: false });
    await service.recordDispute("buyer-1");
    const flagged = await service.screenDisputeRate("buyer-1");
    expect(flagged.suspicious).toBe(true);
    expect(flagged.rule).toBe("dispute-rate");
  });

  it("stays quiet for disabled rules", async () => {
    const { service } = setup({ "login-burst": { enabled: false } });
    let last = { suspicious: false };
    for (let i = 0; i < 10; i += 1) {
      last = await service.screenLogin("attacker@test.com");
    }
    expect(last.suspicious).toBe(false);
  });

  it("fails open when Redis is down", async () => {
    const { service, redis } = setup();
    redis.zadd.mockRejectedValue(new Error("Redis down"));
    expect(await service.screenOrder("buyer-1", 1000)).toEqual({ suspicious: false });
    expect(await service.screenLogin("x@test.com")).toEqual({ suspicious: false });
  });
});

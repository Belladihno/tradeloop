import { Inject, Injectable, Logger } from "@nestjs/common";
import type Redis from "ioredis";
import type { FraudRuleName, FraudScreening } from "@tradeloop/types";
import { REDIS_CLIENT } from "../redis/redis.module";
import { FlaggedEventsRepository } from "./flagged-events.repository";
import { FraudRulesRepository } from "./fraud-rules.repository";
import type { FraudRule } from "./entities/fraud-rule.entity";

const MAX_HISTORY = 50;
const MIN_HISTORY_FOR_AVERAGE = 3;

interface ActiveRule {
  name: FraudRuleName;
  threshold: number;
  windowSeconds: number;
}

@Injectable()
export class FraudService {
  private readonly logger = new Logger(FraudService.name);

  constructor(
    private readonly rules: FraudRulesRepository,
    private readonly events: FlaggedEventsRepository,
    @Inject(REDIS_CLIENT) private readonly redis: Redis,
  ) {}

  private windowKey(rule: string, key: string): string {
    return `fraud:${rule}:${key}`;
  }

  private async activeRule(name: FraudRuleName): Promise<ActiveRule | null> {
    try {
      const rule: FraudRule | null = await this.rules.findByName(name);
      if (!rule?.enabled) return null;
      return { name, threshold: Number(rule.threshold), windowSeconds: rule.windowSeconds };
    } catch (error) {
      this.logger.warn(`Fraud rule lookup failed for ${name}: ${(error as Error).message}`);
      return null;
    }
  }

  private async track(
    rule: string,
    key: string,
    windowSeconds: number,
    amountMinor = 0,
  ): Promise<number> {
    const now = Date.now();
    const rkey = this.windowKey(rule, key);
    const member = `${now}:${Math.random().toString(36).slice(2)}:${amountMinor}`;
    await this.redis.zadd(rkey, now, member);
    await this.redis.zremrangebyscore(rkey, 0, now - windowSeconds * 1000);
    await this.redis.zremrangebyrank(rkey, 0, -(MAX_HISTORY + 1));
    await this.redis.expire(rkey, windowSeconds + 60);
    return this.redis.zcard(rkey);
  }

  private async amounts(
    rule: string,
    key: string,
    windowSeconds: number,
  ): Promise<number[]> {
    const now = Date.now();
    const members = await this.redis.zrangebyscore(
      this.windowKey(rule, key),
      now - windowSeconds * 1000,
      now,
    );
    return members.map((member) => Number(member.split(":")[2] ?? 0));
  }

  private clean(): FraudScreening {
    return { suspicious: false };
  }

  private async flag(
    userId: string | null,
    key: string,
    rule: FraudRuleName,
    detail: Record<string, unknown>,
  ): Promise<FraudScreening> {
    const reason = `${rule} triggered for ${key}`;
    try {
      await this.events.create({ userId, key, ruleName: rule, detail });
    } catch (error) {
      this.logger.warn(`Flagged event persistence failed: ${(error as Error).message}`);
    }
    return { suspicious: true, rule, reason };
  }

  private async failOpen<T>(label: string, task: () => Promise<T>, fallback: T): Promise<T> {
    try {
      return await task();
    } catch (error) {
      this.logger.warn(`Fraud ${label} failed open: ${(error as Error).message}`);
      return fallback;
    }
  }

  async screenOrder(userId: string, amountMinor: number): Promise<FraudScreening> {
    return this.failOpen("screenOrder", async () => {
      await this.recordOrder(userId, amountMinor);
      const velocity = await this.activeRule("order-velocity");
      if (velocity) {
        const count = await this.track("order-velocity", userId, velocity.windowSeconds);
        if (count > velocity.threshold) {
          return this.flag(userId, userId, "order-velocity", { count, amountMinor });
        }
      }
      return this.checkAmount(userId, amountMinor);
    }, this.clean());
  }

  async checkAmountAnomaly(userId: string, amountMinor: number): Promise<FraudScreening> {
    return this.failOpen("checkAmountAnomaly", async () => {
      const rule = await this.activeRule("amount-anomaly");
      if (!rule) return this.clean();
      const history = await this.amounts("amount-anomaly", userId, rule.windowSeconds);
      await this.track("amount-anomaly", userId, rule.windowSeconds, amountMinor);
      if (history.length < MIN_HISTORY_FOR_AVERAGE) return this.clean();
      const average = history.reduce((sum, value) => sum + value, 0) / history.length;
      if (average > 0 && amountMinor > average * rule.threshold) {
        return this.flag(userId, userId, "amount-anomaly", {
          amountMinor,
          average: Math.round(average),
        });
      }
      return this.clean();
    }, this.clean());
  }

  private async checkAmount(
    userId: string,
    amountMinor: number,
  ): Promise<FraudScreening> {
    return this.checkAmountAnomaly(userId, amountMinor);
  }

  async screenPayout(sellerId: string, amountMinor: number): Promise<FraudScreening> {
    return this.failOpen("screenPayout", async () => {
      const velocity = await this.activeRule("payout-velocity");
      if (velocity) {
        const count = await this.track("payout-velocity", sellerId, velocity.windowSeconds);
        if (count > velocity.threshold) {
          return this.flag(sellerId, sellerId, "payout-velocity", { count, amountMinor });
        }
      }
      const anomaly = await this.activeRule("amount-anomaly");
      if (anomaly) {
        const history = await this.amounts("payout-amounts", sellerId, anomaly.windowSeconds);
        await this.track("payout-amounts", sellerId, anomaly.windowSeconds, amountMinor);
        const average =
          history.length > 0
            ? history.reduce((sum, value) => sum + value, 0) / history.length
            : 0;
        if (
          history.length >= MIN_HISTORY_FOR_AVERAGE &&
          average > 0 &&
          amountMinor > average * anomaly.threshold
        ) {
          return this.flag(sellerId, sellerId, "amount-anomaly", { amountMinor });
        }
      }
      return this.clean();
    }, this.clean());
  }

  async checkNewAccount(
    userId: string,
    createdAt: Date,
    amountMinor: number,
  ): Promise<FraudScreening> {
    return this.failOpen("checkNewAccount", async () => {
      const rule = await this.activeRule("new-account-high-value");
      if (!rule) return this.clean();
      const ageSeconds = (Date.now() - createdAt.getTime()) / 1000;
      if (ageSeconds < rule.windowSeconds && amountMinor >= Math.round(rule.threshold * 100)) {
        return this.flag(userId, userId, "new-account-high-value", { amountMinor });
      }
      return this.clean();
    }, this.clean());
  }

  async screenLogin(identifier: string): Promise<FraudScreening> {
    const key = identifier.toLowerCase().trim();
    return this.failOpen("screenLogin", async () => {
      const rule = await this.activeRule("login-burst");
      if (!rule) return this.clean();
      const count = await this.track("login-burst", key, rule.windowSeconds);
      if (count > rule.threshold) {
        return this.flag(null, key, "login-burst", { count });
      }
      return this.clean();
    }, this.clean());
  }

  async screenDiscountRedemption(userId: string): Promise<FraudScreening> {
    return this.failOpen("screenDiscountRedemption", async () => {
      const rule = await this.activeRule("discount-abuse");
      if (!rule) return this.clean();
      const count = await this.track("discount-abuse", userId, rule.windowSeconds);
      if (count > rule.threshold) {
        return this.flag(userId, userId, "discount-abuse", { count });
      }
      return this.clean();
    }, this.clean());
  }

  async recordDispute(userId: string): Promise<void> {
    await this.failOpen("recordDispute", async () => {
      const rule = await this.activeRule("dispute-rate");
      if (!rule) return;
      await this.track("dispute-rate-disputes", userId, rule.windowSeconds);
    }, undefined);
  }

  async screenDisputeRate(userId: string): Promise<FraudScreening> {
    return this.failOpen("screenDisputeRate", async () => {
      const rule = await this.activeRule("dispute-rate");
      if (!rule) return this.clean();
      const disputes = await this.countOnly("dispute-rate-disputes", userId, rule.windowSeconds);
      const orders = await this.countOnly("order-history", userId, rule.windowSeconds);
      if (orders >= 3 && disputes / Math.max(orders, 1) > rule.threshold) {
        return this.flag(userId, userId, "dispute-rate", { disputes, orders });
      }
      return this.clean();
    }, this.clean());
  }

  private async countOnly(rule: string, key: string, windowSeconds: number): Promise<number> {
    const now = Date.now();
    const rkey = this.windowKey(rule, key);
    await this.redis.zremrangebyscore(rkey, 0, now - windowSeconds * 1000);
    return this.redis.zcard(rkey);
  }

  async recordOrder(userId: string, amountMinor: number): Promise<void> {
    await this.failOpen("recordOrder", async () => {
      const rule = await this.activeRule("dispute-rate");
      const windowSeconds = rule?.windowSeconds ?? 2592000;
      await this.track("order-history", userId, windowSeconds, amountMinor);
    }, undefined);
  }

  async listRules() {
    return this.rules.list();
  }

  async listEvents(limit = 100) {
    return this.events.list(limit);
  }

  async updateRule(
    name: FraudRuleName,
    patch: { enabled?: boolean; threshold?: string; windowSeconds?: number },
  ) {
    return this.rules.update(name, patch);
  }
}

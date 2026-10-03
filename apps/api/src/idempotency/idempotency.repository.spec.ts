import { describe, expect, it, vi } from "vitest";
import { IdempotencyKeysRepository } from "./idempotency.repository";

function setup() {
  const keys = {
    create: vi.fn((_entity: unknown, data: unknown) => data),
    save: vi.fn(),
    findOne: vi.fn(),
    delete: vi.fn(),
  };
  const repository = new IdempotencyKeysRepository(keys as never);
  return { repository, keys };
}

describe("IdempotencyKeysRepository", () => {
  it("returns the winner's response on concurrent duplicate saves", async () => {
    const { repository, keys } = setup();
    const winner = { createdAt: new Date(), response: { orders: ["o-1"] } };
    keys.save.mockRejectedValue({ code: "23505" });
    keys.findOne.mockResolvedValue(winner);

    const result = await repository.saveIfAbsent("key-1", "u-1", { orders: ["o-2"] });

    expect(result).toEqual({ orders: ["o-1"] });
  });

  it("rethrows non-conflict errors", async () => {
    const { repository, keys } = setup();
    keys.save.mockRejectedValue(new Error("connection lost"));

    await expect(repository.saveIfAbsent("key-1", "u-1", {})).rejects.toThrow(
      "connection lost",
    );
  });

  it("treats expired keys as misses", async () => {
    const { repository, keys } = setup();
    keys.findOne.mockResolvedValue({
      createdAt: new Date(Date.now() - 25 * 60 * 60 * 1000),
      response: { orders: [] },
    });

    await expect(repository.findValid("key-1", "u-1")).resolves.toBeNull();
  });
});

import { describe, expect, it, vi } from "vitest";
import { AuditService } from "./audit.service";

function setup(saveImpl?: () => Promise<unknown>) {
  const logs = {
    create: vi.fn((data: unknown) => data),
    save: vi.fn(saveImpl ?? (async (data: unknown) => data)),
    find: vi.fn(async () => []),
  };
  const service = new AuditService(logs as never);
  return { service, logs };
}

describe("AuditService", () => {
  it("persists audit entries", async () => {
    const { service, logs } = setup();

    await service.record({
      actorId: "admin-1",
      action: "payout.approved",
      entityType: "payout",
      entityId: "p-1",
    });

    expect(logs.save).toHaveBeenCalledWith(
      expect.objectContaining({ actorId: "admin-1", action: "payout.approved" }),
    );
  });

  it("never fails the caller when the write fails", async () => {
    const { service } = setup(async () => {
      throw new Error("DB down");
    });

    await expect(
      service.record({ actorId: null, action: "dispute.expired", entityType: "dispute" }),
    ).resolves.toBeUndefined();
  });

  it("lists recent entries bounded", async () => {
    const { service, logs } = setup();

    await service.list(10);

    expect(logs.find).toHaveBeenCalledWith(
      expect.objectContaining({ order: { createdAt: "DESC" }, take: 10 }),
    );
  });
});

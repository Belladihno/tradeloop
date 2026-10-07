import { afterEach, describe, expect, it, vi } from "vitest";
import {
  WebhookDeliveryStatus,
  type WebhookEventType,
} from "@tradeloop/types";
import { ConflictException, NotFoundException } from "@nestjs/common";
import { EncryptionService } from "../../common/crypto/encryption.service";
import { SellerProfilesRepository } from "../../seller-profiles/seller-profiles.repository";
import { WebhookDeliveriesRepository } from "./webhook-deliveries.repository";
import { WebhookDeliveryService } from "./webhook-delivery.service";

function setup() {
  const deliveries = {
    create: vi.fn(async (data: Record<string, unknown>) => ({ id: "d-1", attempts: 0, ...data })),
    findById: vi.fn(),
    findFailed: vi.fn(),
    save: vi.fn(async (delivery: unknown) => delivery),
  };
  const profiles = {
    findByUserId: vi.fn(async () => ({
      id: "p-1",
      webhookUrl: "https://seller.test/hooks",
      webhookSecret: "enc-secret",
    })),
  };
  const crypto = { decrypt: vi.fn((value: string) => value) };
  const queue = { add: vi.fn(async () => ({ id: "job-1" })) };
  const service = new WebhookDeliveryService(
    deliveries as unknown as WebhookDeliveriesRepository,
    profiles as unknown as SellerProfilesRepository,
    crypto as unknown as EncryptionService,
    queue as never,
  );
  return { service, deliveries, profiles, crypto, queue };
}

function okFetch() {
  vi.stubGlobal(
    "fetch",
    vi.fn(async () => ({ ok: true, status: 200 })),
  );
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("WebhookDeliveryService", () => {
  it("signs payloads verifiably", async () => {
    const { service } = setup();
    const { signature, body } = service.signPayload("secret", {
      event: "order.created" as WebhookEventType,
      data: { orderId: "o-1" },
      timestamp: "2026-01-01T00:00:00.000Z",
      deliveryId: "d-1",
    });
    const { createHmac, timingSafeEqual } = await import("crypto");
    const expected = createHmac("sha256", "secret").update(body).digest("hex");
    expect(timingSafeEqual(Buffer.from(signature), Buffer.from(expected))).toBe(true);
    expect(JSON.parse(body)).toMatchObject({ event: "order.created", deliveryId: "d-1" });
  });

  it("skips sellers with no webhook URL", async () => {
    const { service, deliveries, queue, profiles } = setup();
    profiles.findByUserId.mockResolvedValue({ id: "p-1", webhookUrl: null });

    expect(await service.dispatch("order.created", "seller-1", {})).toBeNull();
    expect(deliveries.create).not.toHaveBeenCalled();
    expect(queue.add).not.toHaveBeenCalled();
  });

  it("stores pending rows and enqueues delivery jobs", async () => {
    const { service, deliveries, queue, profiles } = setup();
    profiles.findByUserId.mockResolvedValue({
      id: "p-1",
      webhookUrl: "https://seller.test/hooks",
      webhookSecret: "enc-secret",
    });

    const record = await service.dispatch("order.created", "seller-1", { orderId: "o-1" });

    expect(record?.status).toBe(WebhookDeliveryStatus.PENDING);
    expect(deliveries.create).toHaveBeenCalledWith(
      expect.objectContaining({ eventType: "order.created", targetUrl: "https://seller.test/hooks" }),
    );
    expect(queue.add).toHaveBeenCalledWith("deliver", { deliveryId: "d-1" }, expect.anything());
  });

  it("delivers signed payloads and marks them delivered", async () => {
    const { service, deliveries } = setup();
    okFetch();
    deliveries.findById.mockResolvedValue({
      id: "d-1",
      status: WebhookDeliveryStatus.PENDING,
      attempts: 0,
      targetUrl: "https://seller.test/hooks",
      eventType: "order.created",
      payload: { orderId: "o-1" },
    });

    expect(await service.deliver("d-1")).toBe("delivered");
    expect(deliveries.save).toHaveBeenCalledWith(
      expect.objectContaining({ status: WebhookDeliveryStatus.DELIVERED }),
    );
  });

  it("retries failures and dead-letters after five attempts", async () => {
    const { service, deliveries } = setup();
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => ({ ok: false, status: 500 })),
    );
    const record = {
      id: "d-1",
      status: WebhookDeliveryStatus.PENDING,
      attempts: 4,
      targetUrl: "https://seller.test/hooks",
      eventType: "order.created",
      payload: {},
    };
    deliveries.findById.mockResolvedValue(record);

    expect(await service.deliver("d-1")).toBe("failed");
    expect(record.status).toBe(WebhookDeliveryStatus.FAILED);
    expect(record.attempts).toBe(5);
  });

  it("dedupes re-entry on non-pending rows", async () => {
    const { service, deliveries } = setup();
    deliveries.findById.mockResolvedValueOnce(null);
    deliveries.findById.mockResolvedValueOnce({ id: "d-1", status: WebhookDeliveryStatus.DELIVERED });

    expect(await service.deliver("missing")).toBe("duplicate");
    expect(await service.deliver("d-1")).toBe("duplicate");
  });

  it("resets failed rows for admin retry", async () => {
    const { service, deliveries, queue } = setup();
    deliveries.findById.mockResolvedValue({ id: "d-1", status: WebhookDeliveryStatus.FAILED });

    await service.retryDelivery("d-1");

    expect(deliveries.save).toHaveBeenCalledWith(
      expect.objectContaining({ status: WebhookDeliveryStatus.PENDING, attempts: 0 }),
    );
    expect(queue.add).toHaveBeenCalledWith("deliver", { deliveryId: "d-1" }, expect.anything());
  });

  it("refuses retry on missing or live rows", async () => {
    const { service, deliveries } = setup();
    deliveries.findById.mockResolvedValue(null);
    await expect(service.retryDelivery("missing")).rejects.toBeInstanceOf(NotFoundException);

    deliveries.findById.mockResolvedValue({ id: "d-1", status: WebhookDeliveryStatus.PENDING });
    await expect(service.retryDelivery("d-1")).rejects.toBeInstanceOf(ConflictException);
  });
});

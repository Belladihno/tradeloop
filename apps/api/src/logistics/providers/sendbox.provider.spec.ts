import { createHmac } from "crypto";
import { afterEach, describe, expect, it, vi } from "vitest";
import { ShipmentStatus } from "@tradeloop/types";
import { SendboxProvider, mapSendboxStatus } from "./sendbox.provider";

const config = (values: Record<string, string>) => ({
  get: (key: string) => values[key],
});

function stubFetch(handler: (url: string, init?: { body?: string }) => unknown) {
  vi.stubGlobal(
    "fetch",
    vi.fn(async (url: string, init?: { body?: string }) => ({
      ok: true,
      status: 200,
      json: async () => handler(url, init),
    })),
  );
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("SendboxProvider", () => {
  it("requires an API key at construction", () => {
    expect(() => new SendboxProvider(config({}) as never)).toThrow("SENDBOX_API_KEY");
  });

  it("quotes, creates, and tracks through the Sendbox API", async () => {
    stubFetch((url: string) => {
      if (url.endsWith("/shipments/quote")) {
        return { status: true, data: { amount: 220000, currency: "NGN", estimated_days: 3 } };
      }
      if (url.endsWith("/shipments")) {
        return { status: true, data: { tracking_number: "SBX-1", label_url: null } };
      }
      return {
        status: true,
        data: {
          status: "in_transit",
          events: [
            {
              status: "in_transit",
              description: "Left hub",
              location: "Ikeja",
              occurred_at: "2026-01-01T00:00:00.000Z",
            },
          ],
        },
      };
    });
    const provider = new SendboxProvider(
      config({ SENDBOX_API_KEY: "key", SENDBOX_WEBHOOK_SECRET: "secret" }) as never,
    );

    await expect(
      provider.calculateRate({ pickupLga: "Ikeja", deliveryLga: "Lekki", weightKg: 1 }),
    ).resolves.toEqual({ amount: "2200.00", currency: "NGN", estimatedDays: 3 });

    const created = await provider.createShipment({
      orderId: "o-1",
      pickupLga: "Ikeja",
      deliveryLga: "Lekki",
      weightKg: 1,
      recipientName: "Ada",
      recipientPhone: "0803",
      recipientAddress: "1 Adeola St",
    });
    expect(created.trackingNumber).toBe("SBX-1");

    const tracked = await provider.trackShipment("SBX-1");
    expect(tracked.status).toBe(ShipmentStatus.IN_TRANSIT);
    expect(tracked.events).toHaveLength(1);
  });

  it("verifies webhook signatures", () => {
    const provider = new SendboxProvider(
      config({ SENDBOX_API_KEY: "key", SENDBOX_WEBHOOK_SECRET: "secret" }) as never,
    );
    const rawBody = Buffer.from(JSON.stringify({ trackingNumber: "SBX-1", status: "delivered" }));
    const signature = createHmac("sha256", "secret").update(rawBody).digest("hex");

    expect(provider.verifyWebhook(rawBody, signature)).toBe(true);
    expect(provider.verifyWebhook(rawBody, "forged")).toBe(false);
    expect(provider.verifyWebhook(undefined, signature)).toBe(false);
  });

  it("maps sendbox statuses and rejects unknowns", () => {
    expect(mapSendboxStatus("delivered")).toBe(ShipmentStatus.DELIVERED);
    expect(mapSendboxStatus("out_for_delivery")).toBe(ShipmentStatus.OUT_FOR_DELIVERY);
    expect(mapSendboxStatus("teleported")).toBeNull();
  });
});

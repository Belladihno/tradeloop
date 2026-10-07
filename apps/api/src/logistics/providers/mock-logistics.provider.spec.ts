import { describe, expect, it } from "vitest";
import { ShipmentStatus } from "@tradeloop/types";
import { MockLogisticsProvider } from "./mock-logistics.provider";

describe("MockLogisticsProvider", () => {
  it("quotes rates from weight and lane", async () => {
    const provider = new MockLogisticsProvider();

    const same = await provider.calculateRate({ pickupLga: "Ikeja", deliveryLga: "Ikeja", weightKg: 1 });
    expect(same).toEqual({ amount: "1850.00", currency: "NGN", estimatedDays: 2 });

    const far = await provider.calculateRate({ pickupLga: "Ikeja", deliveryLga: "Lekki", weightKg: 2.4 });
    expect(far).toEqual({ amount: "2550.00", currency: "NGN", estimatedDays: 4 });
  });

  it("advances tracking on each poll through to delivery", async () => {
    const provider = new MockLogisticsProvider();
    const { trackingNumber } = await provider.createShipment({
      orderId: "o-1",
      pickupLga: "Ikeja",
      deliveryLga: "Lekki",
      weightKg: 1,
      recipientName: "Ada",
      recipientPhone: "0803",
      recipientAddress: "1 Adeola St",
    });
    expect(trackingNumber.startsWith("MOCK-")).toBe(true);

    const seen: string[] = [];
    for (let i = 0; i < 5; i += 1) {
      seen.push((await provider.trackShipment(trackingNumber)).status);
    }
    expect(seen).toEqual(["PICKED_UP", "IN_TRANSIT", "OUT_FOR_DELIVERY", "DELIVERED", "DELIVERED"]);
  });

  it("reports exceptions for unknown tracking numbers", async () => {
    const provider = new MockLogisticsProvider();
    const result = await provider.trackShipment("MOCK-NOPE");
    expect(result.status).toBe(ShipmentStatus.EXCEPTION);
    expect(result.events).toEqual([]);
  });
});

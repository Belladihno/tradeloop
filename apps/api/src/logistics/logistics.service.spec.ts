import { describe, expect, it, vi } from "vitest";
import { OrderStatus, ShipmentStatus } from "@tradeloop/types";
import { ForbiddenException, NotFoundException } from "@nestjs/common";
import { OrdersRepository } from "../orders/orders.repository";
import { InvalidStateTransitionException } from "../common/exceptions/invalid-state-transition.exception";
import { LogisticsService } from "./logistics.service";
import { ShipmentsRepository } from "./shipments.repository";

const INPUT = {
  orderId: "o-1",
  pickupLga: "Ikeja",
  deliveryLga: "Lekki",
  weightKg: 2,
  recipientName: "Ada Buyer",
  recipientPhone: "08030000000",
  recipientAddress: "1 Adeola St, Lagos",
};

function setup() {
  const shipments = {
    create: vi.fn(async (data: Record<string, unknown>) => ({ id: "s-1", ...data })),
    findById: vi.fn(),
    findByOrder: vi.fn(),
    findByTrackingNumber: vi.fn(),
    save: vi.fn(async (shipment: unknown) => shipment),
  };
  const orders = { findById: vi.fn() };
  const provider = {
    name: "mock",
    calculateRate: vi.fn(async () => ({ amount: "2200.00", currency: "NGN", estimatedDays: 4 })),
    createShipment: vi.fn(async () => ({ trackingNumber: "MOCK-1", labelUrl: null })),
    trackShipment: vi.fn(),
  };
  const service = new LogisticsService(
    shipments as unknown as ShipmentsRepository,
    orders as unknown as OrdersRepository,
    provider as never,
  );
  return { service, shipments, orders, provider };
}

function shippedOrder() {
  return { id: "o-1", sellerId: "seller-1", buyerId: "buyer-1", status: OrderStatus.SHIPPED };
}

describe("LogisticsService", () => {
  it("creates shipments for shipped seller orders", async () => {
    const { service, shipments, orders } = setup();
    orders.findById.mockResolvedValue(shippedOrder());

    const shipment = await service.createShipment("seller-1", INPUT);

    expect(shipment.provider).toBe("mock");
    expect(shipment.status).toBe(ShipmentStatus.PENDING);
    expect(shipments.create).toHaveBeenCalledWith(
      expect.objectContaining({ orderId: "o-1", trackingNumber: "MOCK-1", rateAmount: "2200.00" }),
    );
  });

  it("refuses shipments for missing, foreign, or unshipped orders", async () => {
    const { service, orders } = setup();
    orders.findById.mockResolvedValue(null);
    await expect(service.createShipment("seller-1", INPUT)).rejects.toBeInstanceOf(NotFoundException);

    orders.findById.mockResolvedValue({ ...shippedOrder(), sellerId: "other" });
    await expect(service.createShipment("seller-1", INPUT)).rejects.toBeInstanceOf(ForbiddenException);

    orders.findById.mockResolvedValue({ ...shippedOrder(), status: OrderStatus.CONFIRMED });
    await expect(service.createShipment("seller-1", INPUT)).rejects.toBeInstanceOf(
      InvalidStateTransitionException,
    );
  });

  it("rejects duplicate shipments per order", async () => {
    const { service, shipments, orders, provider } = setup();
    orders.findById.mockResolvedValue(shippedOrder());
    shipments.findByOrder.mockResolvedValue({ id: "s-0" });

    await expect(service.createShipment("seller-1", INPUT)).rejects.toThrow("already has a shipment");
    expect(provider.createShipment).not.toHaveBeenCalled();
  });

  it("tracks shipments and persists status changes", async () => {
    const { service, shipments, provider } = setup();
    const stored = { id: "s-1", trackingNumber: "MOCK-1", status: ShipmentStatus.PENDING };
    shipments.findByTrackingNumber.mockResolvedValue(stored);
    provider.trackShipment.mockResolvedValue({
      trackingNumber: "MOCK-1",
      status: ShipmentStatus.IN_TRANSIT,
      events: [],
    });

    const result = await service.trackShipment("MOCK-1");

    expect(result.tracking.status).toBe(ShipmentStatus.IN_TRANSIT);
    expect(shipments.save).toHaveBeenCalledWith(
      expect.objectContaining({ status: ShipmentStatus.IN_TRANSIT }),
    );
  });

  it("returns 404 for unknown tracking numbers", async () => {
    const { service, shipments } = setup();
    shipments.findByTrackingNumber.mockResolvedValue(null);

    await expect(service.trackShipment("NOPE")).rejects.toBeInstanceOf(NotFoundException);
  });
});

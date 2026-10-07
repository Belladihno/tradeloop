import { Injectable } from "@nestjs/common";
import { v7 as uuidv7 } from "uuid";
import {
  ShipmentStatus,
  type CreatedShipment,
  type CreateShipmentInput,
  type RateInput,
  type ShippingRate,
  type TrackingEvent,
  type TrackingResult,
} from "@tradeloop/types";
import type { LogisticsProvider } from "../interfaces/logistics-provider.interface";

interface MockShipment {
  input: CreateShipmentInput;
  step: number;
}

const STEPS = [
  ShipmentStatus.PICKED_UP,
  ShipmentStatus.IN_TRANSIT,
  ShipmentStatus.OUT_FOR_DELIVERY,
  ShipmentStatus.DELIVERED,
];

const HUBS = ["Ikeja Sorting Hub", "Oshodi Interchange", "Yaba Distribution Centre", "Marina Final Mile"];

@Injectable()
export class MockLogisticsProvider implements LogisticsProvider {
  readonly name = "mock" as const;
  private readonly shipments = new Map<string, MockShipment>();

  async calculateRate(input: RateInput): Promise<ShippingRate> {
    const base = 1500_00;
    const perKg = 350_00;
    const amount = (base + Math.ceil(input.weightKg) * perKg) / 100;
    return {
      amount: amount.toFixed(2),
      currency: "NGN",
      estimatedDays: input.pickupLga === input.deliveryLga ? 2 : 4,
    };
  }

  async createShipment(input: CreateShipmentInput): Promise<CreatedShipment> {
    const trackingNumber = `MOCK-${uuidv7().replace(/-/g, "").slice(0, 12).toUpperCase()}`;
    this.shipments.set(trackingNumber, { input, step: -1 });
    return { trackingNumber, labelUrl: null };
  }

  async trackShipment(trackingNumber: string): Promise<TrackingResult> {
    const stored = this.shipments.get(trackingNumber);
    if (!stored) {
      return { trackingNumber, status: ShipmentStatus.EXCEPTION, events: [] };
    }
    stored.step = Math.min(stored.step + 1, STEPS.length - 1);
    const status = STEPS[stored.step] ?? ShipmentStatus.PENDING;
    const events: TrackingEvent[] = STEPS.slice(0, stored.step + 1).map((step, index) => ({
      status: step,
      description: `Parcel ${step.toLowerCase().replace(/_/g, " ")}`,
      location: HUBS[index % HUBS.length] ?? null,
      occurredAt: new Date().toISOString(),
    }));
    return { trackingNumber, status, events };
  }
}

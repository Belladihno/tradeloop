export enum ShipmentStatus {
  PENDING = "PENDING",
  PICKED_UP = "PICKED_UP",
  IN_TRANSIT = "IN_TRANSIT",
  OUT_FOR_DELIVERY = "OUT_FOR_DELIVERY",
  DELIVERED = "DELIVERED",
  EXCEPTION = "EXCEPTION",
  CANCELLED = "CANCELLED",
}

export type LogisticsProviderName = "mock" | "sendbox";

export interface Shipment {
  id: string;
  orderId: string;
  provider: string;
  trackingNumber: string;
  status: ShipmentStatus;
  rateAmount: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface TrackingEvent {
  status: string;
  description: string;
  location: string | null;
  occurredAt: string;
}

export interface TrackingResult {
  trackingNumber: string;
  status: ShipmentStatus;
  events: TrackingEvent[];
}

export interface ShippingRate {
  amount: string;
  currency: string;
  estimatedDays: number;
}

export interface CreateShipmentInput {
  orderId: string;
  pickupLga: string;
  deliveryLga: string;
  weightKg: number;
  recipientName: string;
  recipientPhone: string;
  recipientAddress: string;
}

export interface CreatedShipment {
  trackingNumber: string;
  labelUrl: string | null;
}

export interface RateInput {
  pickupLga: string;
  deliveryLga: string;
  weightKg: number;
}

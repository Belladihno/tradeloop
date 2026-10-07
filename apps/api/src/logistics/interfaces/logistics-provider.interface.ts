import type {
  CreatedShipment,
  CreateShipmentInput,
  LogisticsProviderName,
  RateInput,
  ShippingRate,
  TrackingResult,
} from "@tradeloop/types";

export type { CreatedShipment, CreateShipmentInput, RateInput, ShippingRate, TrackingResult };

export interface LogisticsProvider {
  readonly name: LogisticsProviderName;
  calculateRate(input: RateInput): Promise<ShippingRate>;
  createShipment(input: CreateShipmentInput): Promise<CreatedShipment>;
  trackShipment(trackingNumber: string): Promise<TrackingResult>;
}

export const LOGISTICS_PROVIDER = "LOGISTICS_PROVIDER";

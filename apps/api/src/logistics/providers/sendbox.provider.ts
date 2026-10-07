import { Injectable } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { createHmac, timingSafeEqual } from "crypto";
import type { Env } from "../../config/env.validation";
import { LogisticsProviderException } from "../../common/exceptions/logistics-provider.exception";
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

const SENDBOX_BASE_URL = "https://api.sendbox.co/v1";

interface SendboxApiResponse<T> {
  status: boolean;
  message: string;
  data: T;
}

const STATUS_MAP: Record<string, ShipmentStatus> = {
  pending: ShipmentStatus.PENDING,
  picked_up: ShipmentStatus.PICKED_UP,
  in_transit: ShipmentStatus.IN_TRANSIT,
  out_for_delivery: ShipmentStatus.OUT_FOR_DELIVERY,
  delivered: ShipmentStatus.DELIVERED,
  exception: ShipmentStatus.EXCEPTION,
  cancelled: ShipmentStatus.CANCELLED,
};

export function mapSendboxStatus(status: string): ShipmentStatus | null {
  return STATUS_MAP[status] ?? null;
}

@Injectable()
export class SendboxProvider implements LogisticsProvider {
  readonly name = "sendbox" as const;
  private readonly apiKey: string;

  constructor(private readonly config: ConfigService<Env, true>) {
    const key = config.get("SENDBOX_API_KEY", { infer: true });
    if (!key) {
      throw new LogisticsProviderException("SENDBOX_API_KEY is required for the sendbox provider");
    }
    this.apiKey = key;
  }

  verifyWebhook(rawBody: Buffer | undefined, signature: string | undefined): boolean {
    if (!rawBody || !signature) return false;
    const secret = this.config.get("SENDBOX_WEBHOOK_SECRET", { infer: true });
    if (!secret) return false;
    const digest = createHmac("sha256", secret).update(rawBody).digest("hex");
    const expected = Buffer.from(digest);
    const actual = Buffer.from(signature);
    return expected.length === actual.length && timingSafeEqual(expected, actual);
  }

  async calculateRate(input: RateInput): Promise<ShippingRate> {
    const body = await this.post<{ amount: number; currency: string; estimated_days: number }>(
      "/shipments/quote",
      {
        origin: input.pickupLga,
        destination: input.deliveryLga,
        weight_kg: input.weightKg,
      },
    );
    return {
      amount: (body.amount / 100).toFixed(2),
      currency: body.currency,
      estimatedDays: body.estimated_days,
    };
  }

  async createShipment(input: CreateShipmentInput): Promise<CreatedShipment> {
    const body = await this.post<{ tracking_number: string; label_url: string | null }>(
      "/shipments",
      {
        order_id: input.orderId,
        origin: input.pickupLga,
        destination: input.deliveryLga,
        weight_kg: input.weightKg,
        recipient_name: input.recipientName,
        recipient_phone: input.recipientPhone,
        recipient_address: input.recipientAddress,
      },
    );
    return { trackingNumber: body.tracking_number, labelUrl: body.label_url };
  }

  async trackShipment(trackingNumber: string): Promise<TrackingResult> {
    const body = await this.get<{ status: string; events: SendboxEvent[] }>(
      `/shipments/track/${trackingNumber}`,
    );
    const events: TrackingEvent[] = body.events.map((event) => ({
      status: event.status,
      description: event.description,
      location: event.location ?? null,
      occurredAt: event.occurred_at,
    }));
    return {
      trackingNumber,
      status: mapSendboxStatus(body.status) ?? ShipmentStatus.EXCEPTION,
      events,
    };
  }

  private async post<T>(path: string, payload: unknown): Promise<T> {
    return this.request<T>(path, {
      method: "POST",
      body: JSON.stringify(payload),
    });
  }

  private async get<T>(path: string): Promise<T> {
    return this.request<T>(path, { method: "GET" });
  }

  private async request<T>(path: string, init: { method: string; body?: string }): Promise<T> {
    const res = await fetch(`${SENDBOX_BASE_URL}${path}`, {
      method: init.method,
      headers: {
        authorization: `Bearer ${this.apiKey}`,
        "content-type": "application/json",
      },
      body: init.body,
    });
    if (!res.ok) {
      throw new LogisticsProviderException(`Sendbox request failed with status ${res.status}`);
    }
    const parsed = (await res.json()) as SendboxApiResponse<T>;
    if (!parsed.status) {
      throw new LogisticsProviderException(parsed.message || "Sendbox request failed");
    }
    return parsed.data;
  }
}

interface SendboxEvent {
  status: string;
  description: string;
  location?: string;
  occurred_at: string;
}

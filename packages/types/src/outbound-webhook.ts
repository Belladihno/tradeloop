export type WebhookEventType =
  | "order.created"
  | "order.paid"
  | "order.shipped"
  | "order.delivered"
  | "payout.completed";

export enum WebhookDeliveryStatus {
  PENDING = "PENDING",
  DELIVERED = "DELIVERED",
  FAILED = "FAILED",
}

export interface OutboundWebhookPayload {
  event: WebhookEventType;
  data: Record<string, unknown>;
  timestamp: string;
  deliveryId: string;
}

export interface WebhookDelivery {
  id: string;
  sellerId: string;
  eventType: WebhookEventType;
  payload: Record<string, unknown>;
  targetUrl: string;
  status: WebhookDeliveryStatus;
  attempts: number;
  lastError: string | null;
  createdAt: Date;
  updatedAt: Date;
}

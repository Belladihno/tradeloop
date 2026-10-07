import { WebhookDeliveryStatus, type WebhookEventType } from "@tradeloop/types";
import { Column, Entity } from "typeorm";
import { BaseEntity } from "../../../common/base/base.entity";

@Entity("webhook_deliveries")
export class WebhookDelivery extends BaseEntity {
  @Column({ type: "uuid" })
  sellerId!: string;

  @Column({ type: "varchar", length: 50 })
  eventType!: WebhookEventType;

  @Column({ type: "jsonb" })
  payload!: Record<string, unknown>;

  @Column({ type: "varchar", length: 500 })
  targetUrl!: string;

  @Column({
    type: "enum",
    enum: WebhookDeliveryStatus,
    enumName: "webhook_delivery_status",
    default: WebhookDeliveryStatus.PENDING,
  })
  status!: WebhookDeliveryStatus;

  @Column({ type: "int", default: 0 })
  attempts!: number;

  @Column({ type: "text", nullable: true })
  lastError!: string | null;
}

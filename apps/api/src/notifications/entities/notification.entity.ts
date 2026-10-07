import { NotificationChannel, NotificationStatus } from "@tradeloop/types";
import { Column, Entity } from "typeorm";
import { BaseEntity } from "../../common/base/base.entity";

@Entity("notifications")
export class Notification extends BaseEntity {
  @Column({ type: "uuid" })
  userId!: string;

  @Column({
    type: "enum",
    enum: NotificationChannel,
    enumName: "notification_channel",
  })
  channel!: NotificationChannel;

  @Column({ type: "varchar", length: 200 })
  subject!: string;

  @Column({ type: "text" })
  body!: string;

  @Column({ type: "jsonb", nullable: true })
  data!: Record<string, unknown> | null;

  @Column({
    type: "enum",
    enum: NotificationStatus,
    enumName: "notification_status",
    default: NotificationStatus.PENDING,
  })
  status!: NotificationStatus;

  @Column({ type: "timestamptz", nullable: true })
  sentAt!: Date | null;
}

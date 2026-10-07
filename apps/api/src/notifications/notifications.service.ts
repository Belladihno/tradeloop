import { Injectable, Logger } from "@nestjs/common";
import { InjectQueue } from "@nestjs/bullmq";
import type { Queue } from "bullmq";
import {
  NotificationChannel,
  NotificationStatus,
  type NotifyInput,
} from "@tradeloop/types";
import type { Notification } from "./entities/notification.entity";
import { EmailChannel } from "./email.channel";
import { NotificationStream } from "./notification-stream";
import { NotificationsRepository } from "./notifications.repository";

@Injectable()
export class NotificationsService {
  private readonly logger = new Logger(NotificationsService.name);

  constructor(
    private readonly notifications: NotificationsRepository,
    private readonly email: EmailChannel,
    private readonly stream: NotificationStream,
    @InjectQueue("notifications") private readonly notificationsQueue: Queue,
  ) {}

  async notify(input: NotifyInput): Promise<Notification[]> {
    const created: Notification[] = [];
    for (const channel of input.channels) {
      const record = await this.notifications.create({
        userId: input.userId,
        channel,
        subject: input.subject,
        body: input.body,
        data: input.data ?? null,
        status: NotificationStatus.PENDING,
      });
      await this.notificationsQueue.add("send", { notificationId: record.id });
      created.push(record);
    }
    return created;
  }

  async listMine(userId: string): Promise<Notification[]> {
    return this.notifications.findByUser(userId);
  }

  async send(notificationId: string): Promise<"sent" | "failed" | "duplicate"> {
    const record = await this.notifications.findById(notificationId);
    if (!record || record.status !== NotificationStatus.PENDING) return "duplicate";
    try {
      if (record.channel === NotificationChannel.EMAIL) {
        await this.email.send({ userId: record.userId, subject: record.subject, body: record.body });
      } else {
        this.stream.publish(record.userId, record);
      }
      record.status = NotificationStatus.SENT;
      record.sentAt = new Date();
      await this.notifications.save(record);
      return "sent";
    } catch (error) {
      this.logger.warn(`Notification ${notificationId} failed: ${(error as Error).message}`);
      record.status = NotificationStatus.FAILED;
      await this.notifications.save(record);
      return "failed";
    }
  }
}

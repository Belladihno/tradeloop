import { Injectable } from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { IsNull, Repository, type QueryRunner } from "typeorm";
import { NotificationStatus } from "@tradeloop/types";
import { Notification } from "./entities/notification.entity";

@Injectable()
export class NotificationsRepository {
  constructor(
    @InjectRepository(Notification) private readonly notifications: Repository<Notification>,
  ) {}

  create(data: Partial<Notification>, runner?: QueryRunner): Promise<Notification> {
    const writer = runner ? runner.manager.getRepository(Notification) : this.notifications;
    return writer.save(this.notifications.create(data));
  }

  findById(id: string): Promise<Notification | null> {
    return this.notifications.findOne({ where: { id, deletedAt: IsNull() } });
  }

  findByUser(userId: string): Promise<Notification[]> {
    return this.notifications.find({
      where: { userId, deletedAt: IsNull() },
      order: { createdAt: "DESC" },
    });
  }

  save(notification: Notification, runner?: QueryRunner): Promise<Notification> {
    const writer = runner ? runner.manager.getRepository(Notification) : this.notifications;
    return writer.save(notification);
  }
}

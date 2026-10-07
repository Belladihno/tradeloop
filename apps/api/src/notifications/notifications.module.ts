import { Module } from "@nestjs/common";
import { TypeOrmModule } from "@nestjs/typeorm";
import { QueuesModule } from "../queues/queues.module";
import { UsersModule } from "../users/users.module";
import { EmailChannel } from "./email.channel";
import { Notification } from "./entities/notification.entity";
import { NotificationStream } from "./notification-stream";
import { NotificationsController } from "./notifications.controller";
import { NotificationsProcessor } from "./notifications.processor";
import { NotificationsRepository } from "./notifications.repository";
import { NotificationsService } from "./notifications.service";

@Module({
  imports: [TypeOrmModule.forFeature([Notification]), UsersModule, QueuesModule],
  controllers: [NotificationsController],
  providers: [
    NotificationsService,
    NotificationsRepository,
    EmailChannel,
    NotificationStream,
    NotificationsProcessor,
  ],
  exports: [NotificationsService],
})
export class NotificationsModule {}

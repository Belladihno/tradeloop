import { Module } from "@nestjs/common";
import { TypeOrmModule } from "@nestjs/typeorm";
import { QueuesModule } from "../../queues/queues.module";
import { SellerProfilesModule } from "../../seller-profiles/seller-profiles.module";
import { WebhookDelivery } from "./entities/webhook-delivery.entity";
import { WebhookDeliveriesRepository } from "./webhook-deliveries.repository";
import { WebhookDeliveryProcessor } from "./webhook-delivery.processor";
import { WebhookDeliveryService } from "./webhook-delivery.service";

@Module({
  imports: [TypeOrmModule.forFeature([WebhookDelivery]), SellerProfilesModule, QueuesModule],
  providers: [WebhookDeliveryService, WebhookDeliveriesRepository, WebhookDeliveryProcessor],
  exports: [WebhookDeliveryService],
})
export class OutboundWebhooksModule {}

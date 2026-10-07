import { Module } from "@nestjs/common";
import { LogisticsModule } from "../logistics/logistics.module";
import { PaymentsModule } from "../payments/payments.module";
import { WalletModule } from "../wallet/wallet.module";
import { WebhookHandlerService } from "./webhook-handler.service";
import { WebhooksController } from "./webhooks.controller";

@Module({
  imports: [PaymentsModule, WalletModule, LogisticsModule],
  controllers: [WebhooksController],
  providers: [WebhookHandlerService],
})
export class WebhooksModule {}

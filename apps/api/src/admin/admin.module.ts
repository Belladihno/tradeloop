import { Module } from "@nestjs/common";
import { DisputesModule } from "../disputes/disputes.module";
import { PayoutsModule } from "../payouts/payouts.module";
import { SellerProfilesModule } from "../seller-profiles/seller-profiles.module";
import { OutboundWebhooksModule } from "../webhooks/outbound/outbound-webhooks.module";
import { AdminController } from "./admin.controller";

@Module({
  imports: [SellerProfilesModule, DisputesModule, PayoutsModule, OutboundWebhooksModule],
  controllers: [AdminController],
})
export class AdminModule {}

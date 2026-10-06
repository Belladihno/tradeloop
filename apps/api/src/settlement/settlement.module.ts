import { Module } from "@nestjs/common";
import { EscrowModule } from "../escrow/escrow.module";
import { OrdersModule } from "../orders/orders.module";
import { QueuesModule } from "../queues/queues.module";
import { SellerProfilesModule } from "../seller-profiles/seller-profiles.module";
import { WalletModule } from "../wallet/wallet.module";
import { OrderDeliveredListener } from "./order-delivered.listener";
import { SettlementService } from "./settlement.service";
import { SettlementsProcessor } from "./settlements.processor";

@Module({
  imports: [OrdersModule, WalletModule, SellerProfilesModule, EscrowModule, QueuesModule],
  providers: [SettlementService, SettlementsProcessor, OrderDeliveredListener],
  exports: [SettlementService],
})
export class SettlementModule {}

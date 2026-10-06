import { Module } from "@nestjs/common";
import { TypeOrmModule } from "@nestjs/typeorm";
import { EscrowModule } from "../escrow/escrow.module";
import { OrdersModule } from "../orders/orders.module";
import { ProductsModule } from "../products/products.module";
import { QueuesModule } from "../queues/queues.module";
import { SettlementModule } from "../settlement/settlement.module";
import { WalletModule } from "../wallet/wallet.module";
import { Dispute } from "./entities/dispute.entity";
import { DisputesController } from "./disputes.controller";
import { DisputesProcessor } from "./disputes.processor";
import { DisputeService } from "./disputes.service";
import { DisputesRepository } from "./disputes.repository";

@Module({
  imports: [
    TypeOrmModule.forFeature([Dispute]),
    OrdersModule,
    ProductsModule,
    WalletModule,
    EscrowModule,
    SettlementModule,
    QueuesModule,
  ],
  controllers: [DisputesController],
  providers: [DisputeService, DisputesRepository, DisputesProcessor],
  exports: [DisputeService],
})
export class DisputesModule {}

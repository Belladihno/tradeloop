import { Module } from "@nestjs/common";
import { TypeOrmModule } from "@nestjs/typeorm";
import { QueuesModule } from "../queues/queues.module";
import { SellerProfilesModule } from "../seller-profiles/seller-profiles.module";
import { WalletModule } from "../wallet/wallet.module";
import { PayoutRequest } from "./entities/payout-request.entity";
import { PAYOUT_FRAUD_CHECK, PermissivePayoutFraudCheck } from "./payout-fraud-check.port";
import { PayoutsController } from "./payouts.controller";
import { PayoutsProcessor } from "./payouts.processor";
import { PayoutsRepository } from "./payouts.repository";
import { PayoutsService } from "./payouts.service";

@Module({
  imports: [
    TypeOrmModule.forFeature([PayoutRequest]),
    WalletModule,
    SellerProfilesModule,
    QueuesModule,
  ],
  controllers: [PayoutsController],
  providers: [
    PayoutsService,
    PayoutsRepository,
    PayoutsProcessor,
    { provide: PAYOUT_FRAUD_CHECK, useClass: PermissivePayoutFraudCheck },
  ],
  exports: [PayoutsService],
})
export class PayoutsModule {}

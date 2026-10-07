import { Module } from "@nestjs/common";
import { TypeOrmModule } from "@nestjs/typeorm";
import { FraudModule } from "../fraud/fraud.module";
import { PaymentsModule } from "../payments/payments.module";
import { UsersModule } from "../users/users.module";
import { Transaction } from "./entities/transaction.entity";
import { Wallet } from "./entities/wallet.entity";
import { WalletController } from "./wallet.controller";
import { WalletRepository } from "./wallet.repository";
import { WalletService } from "./wallet.service";

@Module({
  imports: [TypeOrmModule.forFeature([Wallet, Transaction]), PaymentsModule, UsersModule, FraudModule],
  controllers: [WalletController],
  providers: [WalletService, WalletRepository],
  exports: [WalletService, WalletRepository],
})
export class WalletModule {}

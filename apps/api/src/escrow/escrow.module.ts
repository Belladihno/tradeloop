import { Module } from "@nestjs/common";
import { WalletModule } from "../wallet/wallet.module";
import { EscrowService } from "./escrow.service";

@Module({
  imports: [WalletModule],
  providers: [EscrowService],
  exports: [EscrowService],
})
export class EscrowModule {}

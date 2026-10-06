import { Injectable } from "@nestjs/common";
import type { QueryRunner } from "typeorm";
import { TransactionType } from "@tradeloop/types";
import { WalletRepository } from "../wallet/wallet.repository";

export interface HoldFundsInput {
  buyerWalletId: string;
  escrowWalletId: string;
  amount: string;
  orderId: string;
  runner: QueryRunner;
}

export interface ReleaseFundsInput {
  escrowWalletId: string;
  sellerWalletId: string;
  platformWalletId: string;
  totalAmount: string;
  netAmount: string;
  commissionAmount: string;
  orderId: string;
  runner: QueryRunner;
}

export interface RefundFundsInput {
  escrowWalletId: string;
  buyerWalletId: string;
  amount: string;
  orderId: string;
  runner: QueryRunner;
}

@Injectable()
export class EscrowService {
  constructor(private readonly wallets: WalletRepository) {}

  async holdFunds(input: HoldFundsInput): Promise<void> {
    await this.wallets.debitAtomic(input.buyerWalletId, input.amount, input.runner);
    await this.wallets.creditAtomic(input.escrowWalletId, input.amount, input.runner);
    await this.wallets.recordTransaction(
      {
        fromWalletId: input.buyerWalletId,
        toWalletId: input.escrowWalletId,
        amount: input.amount,
        type: TransactionType.ESCROW_HOLD,
        referenceId: input.orderId,
        referenceType: "Order",
      },
      input.runner,
    );
  }

  async releaseFunds(input: ReleaseFundsInput): Promise<void> {
    await this.wallets.debitAtomic(input.escrowWalletId, input.totalAmount, input.runner);
    await this.wallets.creditAtomic(input.platformWalletId, input.commissionAmount, input.runner);
    await this.wallets.creditAtomic(input.sellerWalletId, input.netAmount, input.runner);
    await this.wallets.recordTransaction(
      {
        fromWalletId: input.escrowWalletId,
        toWalletId: input.platformWalletId,
        amount: input.commissionAmount,
        type: TransactionType.COMMISSION,
        referenceId: input.orderId,
        referenceType: "Order",
      },
      input.runner,
    );
    await this.wallets.recordTransaction(
      {
        fromWalletId: input.escrowWalletId,
        toWalletId: input.sellerWalletId,
        amount: input.netAmount,
        type: TransactionType.ESCROW_RELEASE,
        referenceId: input.orderId,
        referenceType: "Order",
      },
      input.runner,
    );
  }

  async refundFunds(input: RefundFundsInput): Promise<void> {
    await this.wallets.debitAtomic(input.escrowWalletId, input.amount, input.runner);
    await this.wallets.creditAtomic(input.buyerWalletId, input.amount, input.runner);
    await this.wallets.recordTransaction(
      {
        fromWalletId: input.escrowWalletId,
        toWalletId: input.buyerWalletId,
        amount: input.amount,
        type: TransactionType.REFUND,
        referenceId: input.orderId,
        referenceType: "Order",
      },
      input.runner,
    );
  }
}

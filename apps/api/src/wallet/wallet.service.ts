import { Injectable } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { DataSource, type QueryRunner } from "typeorm";
import { v7 as uuidv7 } from "uuid";
import { TransactionStatus, TransactionType, WalletType } from "@tradeloop/types";
import type { Env } from "../config/env.validation";
import { toMinorUnits } from "../common/utils/money";
import { FraudService } from "../fraud/fraud.service";
import { PaymentService } from "../payments/payment.service";
import { UsersService } from "../users/users.service";
import type { Wallet } from "./entities/wallet.entity";
import { WalletRepository } from "./wallet.repository";

@Injectable()
export class WalletService {
  constructor(
    private readonly wallets: WalletRepository,
    private readonly payments: PaymentService,
    private readonly config: ConfigService<Env, true>,
    private readonly fraud: FraudService,
    private readonly users: UsersService,
    private readonly dataSource: DataSource,
  ) {}

  async ensureBuyerWallet(userId: string): Promise<Wallet> {
    const existing = await this.wallets.findByUserAndType(userId, WalletType.BUYER);
    if (existing) return existing;
    return this.wallets.createUserWallet(userId, WalletType.BUYER);
  }

  async ensureSellerWallet(userId: string): Promise<Wallet> {
    const existing = await this.wallets.findByUserAndType(userId, WalletType.SELLER);
    if (existing) return existing;
    return this.wallets.createUserWallet(userId, WalletType.SELLER);
  }

  async getBalance(userId: string): Promise<string> {
    const wallet = await this.ensureBuyerWallet(userId);
    return wallet.balance;
  }

  verifyLedger(walletId: string, runner: QueryRunner): Promise<string> {
    return this.wallets.verifyBalance(walletId, runner);
  }

  async initiateFunding(
    userId: string,
    email: string,
    amount: string,
  ): Promise<{ paymentUrl: string; reference: string }> {
    const wallet = await this.ensureBuyerWallet(userId);
    const reference = uuidv7();
    const runner = this.dataSource.createQueryRunner();
    await runner.connect();
    await runner.startTransaction();
    try {
      await this.wallets.recordTransaction(
        {
          fromWalletId: wallet.id,
          toWalletId: wallet.id,
          amount,
          type: TransactionType.WALLET_FUND,
          referenceId: reference,
          referenceType: "WalletFund",
        },
        runner,
        TransactionStatus.PENDING,
      );
      await runner.commitTransaction();
    } catch (error) {
      await runner.rollbackTransaction();
      throw error;
    } finally {
      await runner.release();
    }
    const webUrl = this.config.get("WEB_URL", { infer: true });
    const { paymentUrl } = await this.payments.initializeTransaction({
      amount,
      email,
      callbackUrl: `${webUrl}/wallet`,
      reference,
    });
    return { paymentUrl, reference };
  }

  async confirmFunding(
    reference: string,
    amount: string,
  ): Promise<"completed" | "duplicate"> {
    const runner = this.dataSource.createQueryRunner();
    await runner.connect();
    await runner.startTransaction();
    try {
      const pending = await this.wallets.findPendingFunding(reference, runner);
      if (!pending) {
        await runner.rollbackTransaction();
        return "duplicate";
      }
      if (pending.amount !== amount) {
        throw new Error(
          `Funding amount mismatch for ${reference}: expected ${pending.amount}, got ${amount}`,
        );
      }
      await this.wallets.creditAtomic(pending.toWalletId, amount, runner);
      await this.wallets.markTransactionCompleted(pending.id, runner);
      await runner.commitTransaction();
      const funded = await this.wallets.findWalletById(pending.toWalletId);
      const fundedUser = funded?.userId ? await this.users.findById(funded.userId) : null;
      if (funded?.userId && fundedUser) {
        await this.fraud.checkAmountAnomaly(funded.userId, toMinorUnits(amount));
        await this.fraud.checkNewAccount(funded.userId, fundedUser.createdAt, toMinorUnits(amount));
      }
      return "completed";
    } catch (error) {
      await runner.rollbackTransaction();
      throw error;
    } finally {
      await runner.release();
    }
  }
}

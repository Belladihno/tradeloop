import { Injectable } from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { IsNull, Repository, type QueryRunner } from "typeorm";
import { TransactionStatus, TransactionType, WalletType } from "@tradeloop/types";
import { InsufficientFundsException } from "../common/exceptions/insufficient-funds.exception";
import { Transaction } from "./entities/transaction.entity";
import { Wallet } from "./entities/wallet.entity";

export interface RecordTransactionData {
  fromWalletId: string;
  toWalletId: string;
  amount: string;
  type: TransactionType;
  referenceId: string;
  referenceType: string;
}

@Injectable()
export class WalletRepository {
  constructor(
    @InjectRepository(Wallet) private readonly wallets: Repository<Wallet>,
    @InjectRepository(Transaction)
    private readonly transactions: Repository<Transaction>,
  ) {}

  findByUserAndType(userId: string, type: WalletType): Promise<Wallet | null> {
    return this.wallets.findOne({ where: { userId, type, deletedAt: IsNull() } });
  }

  findSystemWallet(type: WalletType.PLATFORM | WalletType.ESCROW): Promise<Wallet | null> {
    return this.wallets.findOne({ where: { type, deletedAt: IsNull() } });
  }

  createUserWallet(userId: string, type: WalletType): Promise<Wallet> {
    return this.wallets.save(
      this.wallets.create({ userId, type, balance: "0.00" }),
    );
  }

  async debitAtomic(
    walletId: string,
    amount: string,
    runner: QueryRunner,
  ): Promise<void> {
    const rows = await runner.query(
      `UPDATE "wallets" SET "balance" = "balance" - $1, "updated_at" = now()
       WHERE "id" = $2 AND "balance" >= $1 RETURNING "id"`,
      [amount, walletId],
    );
    if (rows.length === 0) throw new InsufficientFundsException();
  }

  async creditAtomic(
    walletId: string,
    amount: string,
    runner: QueryRunner,
  ): Promise<void> {
    await runner.query(
      `UPDATE "wallets" SET "balance" = "balance" + $1, "updated_at" = now()
       WHERE "id" = $2`,
      [amount, walletId],
    );
  }

  recordTransaction(
    data: RecordTransactionData,
    runner: QueryRunner,
  ): Promise<Transaction> {
    return runner.manager.save(
      runner.manager.create(Transaction, {
        ...data,
        status: TransactionStatus.COMPLETED,
      }),
    );
  }

  async verifyBalance(walletId: string, runner: QueryRunner): Promise<string> {
    const rows = await runner.query(
      `SELECT COALESCE(SUM(CASE WHEN "to_wallet_id" = $1 THEN "amount" ELSE -"amount" END), 0) AS "computed"
       FROM "transactions"
       WHERE ("from_wallet_id" = $1 OR "to_wallet_id" = $1) AND "status" = 'COMPLETED'`,
      [walletId],
    );
    return String(rows[0]?.computed ?? "0");
  }
}

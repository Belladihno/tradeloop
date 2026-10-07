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

export interface PendingFunding {
  id: string;
  amount: string;
  toWalletId: string;
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

  findWalletById(id: string): Promise<Wallet | null> {
    return this.wallets.findOne({ where: { id, deletedAt: IsNull() } });
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
    const [records, affected] = (await runner.query(
      `UPDATE "wallets" SET "balance" = "balance" - $1, "updated_at" = now()
       WHERE "id" = $2 AND "balance" >= $1 RETURNING "id"`,
      [amount, walletId],
    )) as [{ id: string }[], number];
    if (affected === 0 || records.length === 0) throw new InsufficientFundsException();
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
    status: TransactionStatus = TransactionStatus.COMPLETED,
  ): Promise<Transaction> {
    return runner.manager.save(
      runner.manager.create(Transaction, { ...data, status }),
    );
  }

  async findPendingFunding(
    reference: string,
    runner: QueryRunner,
  ): Promise<PendingFunding | null> {
    if (
      !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(reference)
    ) {
      return null;
    }
    const rows = await runner.query(
      `SELECT "id", "amount", "to_wallet_id" FROM "transactions"
       WHERE "reference_id" = $1 AND "status" = 'PENDING' FOR UPDATE`,
      [reference],
    );
    const row = rows[0] as
      | { id: string; amount: string; to_wallet_id: string }
      | undefined;
    if (!row) return null;
    return { id: row.id, amount: String(row.amount), toWalletId: row.to_wallet_id };
  }

  async markTransactionCompleted(id: string, runner: QueryRunner): Promise<void> {
    await runner.query(
      `UPDATE "transactions" SET "status" = 'COMPLETED', "updated_at" = now()
       WHERE "id" = $1`,
      [id],
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

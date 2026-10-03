import { Injectable } from "@nestjs/common";
import type { QueryRunner } from "typeorm";
import { WalletType } from "@tradeloop/types";
import type { Wallet } from "./entities/wallet.entity";
import { WalletRepository } from "./wallet.repository";

@Injectable()
export class WalletService {
  constructor(private readonly wallets: WalletRepository) {}

  async ensureBuyerWallet(userId: string): Promise<Wallet> {
    const existing = await this.wallets.findByUserAndType(userId, WalletType.BUYER);
    if (existing) return existing;
    return this.wallets.createUserWallet(userId, WalletType.BUYER);
  }

  async getBalance(userId: string): Promise<string> {
    const wallet = await this.ensureBuyerWallet(userId);
    return wallet.balance;
  }

  verifyLedger(walletId: string, runner: QueryRunner): Promise<string> {
    return this.wallets.verifyBalance(walletId, runner);
  }
}

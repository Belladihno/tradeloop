import { ConfigService } from "@nestjs/config";
import { DataSource } from "typeorm";
import { describe, expect, it, vi, type Mock } from "vitest";
import { WalletType } from "@tradeloop/types";
import { PaymentService } from "../payments/payment.service";
import type { Wallet } from "./entities/wallet.entity";
import { WalletRepository } from "./wallet.repository";
import { WalletService } from "./wallet.service";

interface MockWalletRepository {
  findByUserAndType: Mock;
  createUserWallet: Mock;
  verifyBalance: Mock;
}

function setup() {
  const wallets: MockWalletRepository = {
    findByUserAndType: vi.fn(),
    createUserWallet: vi.fn(),
    verifyBalance: vi.fn(),
  };
  const service = new WalletService(
    wallets as unknown as WalletRepository,
    {} as PaymentService,
    {} as ConfigService,
    {} as DataSource,
  );
  return { service, wallets };
}

function wallet(balance: string): Wallet {
  return { id: "w1", balance } as Wallet;
}

describe("WalletService", () => {
  it("returns the existing buyer wallet without creating one", async () => {
    const { service, wallets } = setup();
    wallets.findByUserAndType.mockResolvedValue(wallet("20.00"));

    const result = await service.ensureBuyerWallet("u1");

    expect(result.balance).toBe("20.00");
    expect(wallets.findByUserAndType).toHaveBeenCalledWith("u1", WalletType.BUYER);
    expect(wallets.createUserWallet).not.toHaveBeenCalled();
  });

  it("creates the buyer wallet on first use", async () => {
    const { service, wallets } = setup();
    wallets.findByUserAndType.mockResolvedValue(null);
    wallets.createUserWallet.mockResolvedValue(wallet("0.00"));

    const result = await service.ensureBuyerWallet("u1");

    expect(result.balance).toBe("0.00");
    expect(wallets.createUserWallet).toHaveBeenCalledWith("u1", WalletType.BUYER);
  });

  it("reads balances as stored strings", async () => {
    const { service, wallets } = setup();
    wallets.findByUserAndType.mockResolvedValue(wallet("1500.50"));

    await expect(service.getBalance("u1")).resolves.toBe("1500.50");
  });
});

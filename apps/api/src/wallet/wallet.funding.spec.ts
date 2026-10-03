import { ConfigService } from "@nestjs/config";
import { DataSource } from "typeorm";
import { describe, expect, it, vi, type Mock } from "vitest";
import { TransactionStatus } from "@tradeloop/types";
import { PaymentService } from "../payments/payment.service";
import { WalletRepository } from "./wallet.repository";
import { WalletService } from "./wallet.service";

interface MockWalletRepository {
  findByUserAndType: Mock;
  createUserWallet: Mock;
  recordTransaction: Mock;
  findPendingFunding: Mock;
  markTransactionCompleted: Mock;
  creditAtomic: Mock;
}

function runner() {
  return {
    connect: vi.fn(async () => undefined),
    startTransaction: vi.fn(async () => undefined),
    commitTransaction: vi.fn(async () => undefined),
    rollbackTransaction: vi.fn(async () => undefined),
    release: vi.fn(async () => undefined),
  };
}

function setup() {
  const wallets: MockWalletRepository = {
    findByUserAndType: vi.fn(),
    createUserWallet: vi.fn(),
    recordTransaction: vi.fn(),
    findPendingFunding: vi.fn(),
    markTransactionCompleted: vi.fn(),
    creditAtomic: vi.fn(),
  };
  const payments = { initializeTransaction: vi.fn() };
  const config = { get: () => "http://localhost:3001" };
  const queryRunner = runner();
  const dataSource = { createQueryRunner: vi.fn(() => queryRunner) };
  const service = new WalletService(
    wallets as unknown as WalletRepository,
    payments as unknown as PaymentService,
    config as unknown as ConfigService,
    dataSource as unknown as DataSource,
  );
  return { service, wallets, payments, queryRunner };
}

describe("wallet funding", () => {
  it("records a pending intent before redirecting to the provider", async () => {
    const { service, wallets, payments } = setup();
    wallets.findByUserAndType.mockResolvedValue({ id: "w-1", balance: "0.00" });
    wallets.recordTransaction.mockResolvedValue({});
    payments.initializeTransaction.mockResolvedValue({
      paymentUrl: "https://paystack.test/pay/x",
      reference: "ignored",
    });

    const result = await service.initiateFunding("u-1", "buyer@tradeloop.test", "2500.00");

    expect(result.paymentUrl).toBe("https://paystack.test/pay/x");
    expect(result.reference).toBeTruthy();
    expect(wallets.recordTransaction).toHaveBeenCalledWith(
      expect.objectContaining({
        fromWalletId: "w-1",
        toWalletId: "w-1",
        amount: "2500.00",
        referenceId: result.reference,
      }),
      expect.anything(),
      TransactionStatus.PENDING,
    );
    expect(payments.initializeTransaction).toHaveBeenCalledWith(
      expect.objectContaining({ amount: "2500.00", reference: result.reference }),
    );
  });

  it("credits and completes on first confirmation", async () => {
    const { service, wallets } = setup();
    wallets.findPendingFunding.mockResolvedValue({
      id: "tx-1",
      amount: "2500.00",
      toWalletId: "w-1",
    });

    const result = await service.confirmFunding("ref-1", "2500.00");

    expect(result).toBe("completed");
    expect(wallets.creditAtomic).toHaveBeenCalledWith("w-1", "2500.00", expect.anything());
    expect(wallets.markTransactionCompleted).toHaveBeenCalledWith("tx-1", expect.anything());
  });

  it("ignores duplicate confirmations without touching balances", async () => {
    const { service, wallets } = setup();
    wallets.findPendingFunding.mockResolvedValue(null);

    const result = await service.confirmFunding("ref-1", "2500.00");

    expect(result).toBe("duplicate");
    expect(wallets.creditAtomic).not.toHaveBeenCalled();
    expect(wallets.markTransactionCompleted).not.toHaveBeenCalled();
  });

  it("rejects confirmations with mismatched amounts", async () => {
    const { service, wallets } = setup();
    wallets.findPendingFunding.mockResolvedValue({
      id: "tx-1",
      amount: "100.00",
      toWalletId: "w-1",
    });

    await expect(service.confirmFunding("ref-1", "2500.00")).rejects.toThrow(
      "Funding amount mismatch",
    );
    expect(wallets.creditAtomic).not.toHaveBeenCalled();
  });
});

import { DataSource } from "typeorm";
import { describe, expect, it, vi } from "vitest";
import { PayoutStatus } from "@tradeloop/types";
import { SellerProfilesService } from "../seller-profiles/seller-profiles.service";
import { WalletRepository } from "../wallet/wallet.repository";
import { WalletService } from "../wallet/wallet.service";
import { InsufficientFundsException } from "../common/exceptions/insufficient-funds.exception";
import { EncryptionService } from "../common/crypto/encryption.service";
import { PayoutsRepository } from "./payouts.repository";
import { PayoutsService } from "./payouts.service";

function setup(fraudSuspicious = false) {
  const payouts = {
    create: vi.fn(async (data: Record<string, unknown>) => ({ id: "p-1", ...data })),
    findById: vi.fn(),
    findBySeller: vi.fn(),
    save: vi.fn(async (payout: unknown) => payout),
  };
  const wallets = { debitAtomic: vi.fn(), findSystemWallet: vi.fn() };
  const walletService = { ensureSellerWallet: vi.fn(async () => ({ id: "seller-w", balance: "5000.00" })) };
  const sellers = {
    assertSellerActive: vi.fn(async () => undefined),
    myProfile: vi.fn(async () => ({ bankCode: "058", bankAccountNumber: "enc:0123456789" })),
  };
  const crypto = { decrypt: vi.fn(() => "0123456789") };
  const notifications = { notify: vi.fn(async () => []) };
  const webhooks = { dispatch: vi.fn(async () => null) };
  const audit = { record: vi.fn() };
  const fraudCheck = { screen: vi.fn(async () => ({ suspicious: fraudSuspicious })) };
  const queue = { add: vi.fn(async () => ({ id: "job-1" })) };
  const runner = {
    connect: vi.fn(),
    startTransaction: vi.fn(),
    commitTransaction: vi.fn(),
    rollbackTransaction: vi.fn(),
    release: vi.fn(),
  };
  const dataSource = { createQueryRunner: vi.fn(() => runner) };
  const service = new PayoutsService(
    payouts as unknown as PayoutsRepository,
    wallets as unknown as WalletRepository,
    walletService as unknown as WalletService,
    sellers as unknown as SellerProfilesService,
    crypto as unknown as EncryptionService,
    notifications as never,
    webhooks as never,
    audit as never,
    dataSource as unknown as DataSource,
    fraudCheck,
    queue as never,
  );
  return { service, payouts, wallets, walletService, sellers, fraudCheck, queue, runner };
}

describe("PayoutsService", () => {
  it("requests a payout and snapshots the bank destination", async () => {
    const { service, payouts, queue } = setup();

    const payout = await service.request("seller-1", "2500");

    expect(payout.status).toBe(PayoutStatus.PENDING);
    expect(payout.bankCode).toBe("058");
    expect(payout.bankAccountLast4).toBe("6789");
    expect(payouts.create).toHaveBeenCalledWith(
      expect.objectContaining({ sellerId: "seller-1", amount: "2500.00" }),
    );
    expect(queue.add).not.toHaveBeenCalled();
  });

  it("rejects requests that exceed the seller balance", async () => {
    const { service, walletService } = setup();
    walletService.ensureSellerWallet.mockResolvedValue({ id: "seller-w", balance: "100.00" });

    await expect(service.request("seller-1", "2500.00")).rejects.toBeInstanceOf(
      InsufficientFundsException,
    );
  });

  it("auto-rejects requests flagged by fraud screening", async () => {
    const { service, payouts } = setup(true);

    const payout = await service.request("seller-1", "100.00");

    expect(payout.status).toBe(PayoutStatus.REJECTED);
    expect(payout.failureReason).toBe("Flagged by fraud screening");
    expect(payouts.create).toHaveBeenCalledWith(
      expect.objectContaining({ status: PayoutStatus.REJECTED }),
    );
  });

  it("approves pending payouts and enqueues processing", async () => {
    const { service, payouts, queue } = setup();
    payouts.findById.mockResolvedValue({ id: "p-1", status: PayoutStatus.PENDING });

    const payout = await service.approve("p-1", "admin-1");

    expect(payout.status).toBe(PayoutStatus.APPROVED);
    expect(queue.add).toHaveBeenCalledWith("process", { payoutId: "p-1" }, expect.anything());
  });

  it("rejects pending payouts with a reason", async () => {
    const { service, payouts } = setup();
    payouts.findById.mockResolvedValue({ id: "p-1", status: PayoutStatus.PENDING });

    const payout = await service.reject("p-1", "admin-1", "Bad bank details");

    expect(payout.status).toBe(PayoutStatus.REJECTED);
    expect(payout.failureReason).toBe("Bad bank details");
  });

  it("processes approved payouts by debiting the seller wallet", async () => {
    const { service, payouts, wallets } = setup();
    payouts.findById.mockResolvedValue({
      id: "p-1",
      status: PayoutStatus.APPROVED,
      sellerId: "seller-1",
      amount: "2500.00",
    });

    expect(await service.process("p-1")).toBe("completed");
    expect(wallets.debitAtomic).toHaveBeenCalledWith("seller-w", "2500.00", expect.anything());
    expect(payouts.save).toHaveBeenCalledWith(
      expect.objectContaining({ status: PayoutStatus.COMPLETED }),
      expect.anything(),
    );
  });

  it("marks payouts failed when the balance is gone at processing time", async () => {
    const { service, payouts, wallets } = setup();
    payouts.findById.mockResolvedValue({
      id: "p-1",
      status: PayoutStatus.APPROVED,
      sellerId: "seller-1",
      amount: "2500.00",
    });
    wallets.debitAtomic.mockRejectedValue(new InsufficientFundsException());

    expect(await service.process("p-1")).toBe("failed");
    expect(payouts.save).toHaveBeenCalledWith(
      expect.objectContaining({ status: PayoutStatus.FAILED }),
      expect.anything(),
    );
  });

  it("treats reprocessing as a duplicate", async () => {
    const { service, wallets } = setup();

    expect(await service.process("missing")).toBe("duplicate");
    expect(wallets.debitAtomic).not.toHaveBeenCalled();
  });
});

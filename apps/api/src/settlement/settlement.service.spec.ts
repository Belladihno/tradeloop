import { NotFoundException } from "@nestjs/common";
import { DataSource } from "typeorm";
import { describe, expect, it, vi } from "vitest";
import { OrderStatus } from "@tradeloop/types";
import { EscrowService } from "../escrow/escrow.service";
import { OrdersRepository } from "../orders/orders.repository";
import type { Order } from "../orders/entities/order.entity";
import { SellerProfilesService } from "../seller-profiles/seller-profiles.service";
import { WalletRepository } from "../wallet/wallet.repository";
import { WalletService } from "../wallet/wallet.service";
import { SettlementService } from "./settlement.service";

function order(overrides: Partial<Order> = {}): Order {
  return {
    id: "o-1",
    buyerId: "buyer-1",
    sellerId: "seller-1",
    status: OrderStatus.DELIVERED,
    originalAmount: "5000.00",
    discountedAmount: null,
    totalAmount: "5000.00",
    commissionAmount: null,
    ...overrides,
  } as Order;
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
  const orders = { findById: vi.fn(), markCompleted: vi.fn() };
  const wallets = { findSystemWallet: vi.fn() };
  const walletService = { ensureSellerWallet: vi.fn() };
  const sellers = { myProfile: vi.fn() };
  const escrow = { releaseFunds: vi.fn() };
  const audit = { record: vi.fn() };
  const queryRunner = runner();
  const dataSource = { createQueryRunner: vi.fn(() => queryRunner) };
  const service = new SettlementService(
    orders as unknown as OrdersRepository,
    wallets as unknown as WalletRepository,
    walletService as unknown as WalletService,
    sellers as unknown as SellerProfilesService,
    escrow as unknown as EscrowService,
    audit as never,
    dataSource as unknown as DataSource,
  );
  return { service, orders, wallets, walletService, sellers, escrow, dataSource };
}

describe("SettlementService", () => {
  it("splits escrow into commission and seller net at the profile rate", async () => {
    const ctx = setup();
    ctx.orders.findById.mockResolvedValue(order());
    ctx.sellers.myProfile.mockResolvedValue({ commissionRate: "0.10" });
    ctx.walletService.ensureSellerWallet.mockResolvedValue({ id: "seller-w" });
    ctx.wallets.findSystemWallet.mockImplementation(async (type: string) => ({
      id: `${type}-wallet`,
    }));

    const result = await ctx.service.settle("o-1");

    expect(result).toBe("completed");
    expect(ctx.escrow.releaseFunds).toHaveBeenCalledWith(
      expect.objectContaining({
        escrowWalletId: "ESCROW-wallet",
        sellerWalletId: "seller-w",
        platformWalletId: "PLATFORM-wallet",
        totalAmount: "5000.00",
        netAmount: "4500.00",
        commissionAmount: "500.00",
        orderId: "o-1",
      }),
    );
    expect(ctx.orders.markCompleted).toHaveBeenCalledWith(
      "o-1",
      "500.00",
      expect.anything(),
    );
  });

  it("treats non-delivered and missing orders as duplicates", async () => {
    const ctx = setup();
    ctx.orders.findById.mockResolvedValue(order({ status: OrderStatus.SHIPPED }));

    expect(await ctx.service.settle("o-1")).toBe("duplicate");
    expect(ctx.dataSource.createQueryRunner).not.toHaveBeenCalled();

    ctx.orders.findById.mockResolvedValue(null);
    expect(await ctx.service.settle("o-1")).toBe("duplicate");
  });

  it("rechecks status inside the transaction against races", async () => {
    const ctx = setup();
    ctx.orders.findById
      .mockResolvedValueOnce(order())
      .mockResolvedValueOnce(order({ status: OrderStatus.COMPLETED }));
    ctx.sellers.myProfile.mockResolvedValue({ commissionRate: "0.10" });
    ctx.walletService.ensureSellerWallet.mockResolvedValue({ id: "seller-w" });
    ctx.wallets.findSystemWallet.mockResolvedValue({ id: "system-w" });

    expect(await ctx.service.settle("o-1")).toBe("duplicate");
    expect(ctx.escrow.releaseFunds).not.toHaveBeenCalled();
  });

  it("fails loudly without system wallets", async () => {
    const ctx = setup();
    ctx.orders.findById.mockResolvedValue(order());
    ctx.sellers.myProfile.mockResolvedValue({ commissionRate: "0.10" });
    ctx.walletService.ensureSellerWallet.mockResolvedValue({ id: "seller-w" });
    ctx.wallets.findSystemWallet.mockResolvedValue(null);

    await expect(ctx.service.settle("o-1")).rejects.toBeInstanceOf(NotFoundException);
  });
});

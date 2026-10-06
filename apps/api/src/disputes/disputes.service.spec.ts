import {
  ConflictException,
  ForbiddenException,
  NotFoundException,
} from "@nestjs/common";
import { DataSource } from "typeorm";
import { describe, expect, it, vi, type Mock } from "vitest";
import { DisputeStatus, OrderStatus } from "@tradeloop/types";
import { EscrowService } from "../escrow/escrow.service";
import { InvalidStateTransitionException } from "../common/exceptions/invalid-state-transition.exception";
import { OrdersRepository } from "../orders/orders.repository";
import type { Order } from "../orders/entities/order.entity";
import { ProductsRepository } from "../products/products.repository";
import { SettlementService } from "../settlement/settlement.service";
import { WalletRepository } from "../wallet/wallet.repository";
import { WalletService } from "../wallet/wallet.service";
import type { Dispute } from "./entities/dispute.entity";
import { DisputesRepository } from "./disputes.repository";
import { DisputeService } from "./disputes.service";

interface MockDisputesRepository {
  create: Mock;
  findById: Mock;
  findOpenByOrder: Mock;
  save: Mock;
}

function dispute(overrides: Partial<Dispute> = {}): Dispute {
  return {
    id: "dis-1",
    orderId: "o-1",
    raisedBy: "buyer-1",
    reason: "Item arrived damaged",
    status: DisputeStatus.OPEN,
    adminId: null,
    resolvedAt: null,
    expiryJobId: null,
    expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
    ...overrides,
  } as Dispute;
}

function order(overrides: Partial<Order> = {}): Order {
  return {
    id: "o-1",
    buyerId: "buyer-1",
    sellerId: "seller-1",
    status: OrderStatus.SHIPPED,
    totalAmount: "5000.00",
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
  const disputes: MockDisputesRepository = {
    create: vi.fn(),
    findById: vi.fn(),
    findOpenByOrder: vi.fn(),
    save: vi.fn(async (entity: unknown) => entity),
  };
  const orders = {
    findById: vi.fn(),
    findItemsByOrder: vi.fn(async () => []),
    updateStatus: vi.fn(),
  };
  const products = { restoreStock: vi.fn() };
  const wallets = { findSystemWallet: vi.fn() };
  const walletService = { ensureBuyerWallet: vi.fn() };
  const escrow = { refundFunds: vi.fn() };
  const settlement = { settle: vi.fn() };
  const queryRunner = runner();
  const dataSource = { createQueryRunner: vi.fn(() => queryRunner) };
  const expiryQueue = { add: vi.fn(), getJob: vi.fn() };
  const service = new DisputeService(
    disputes as unknown as DisputesRepository,
    orders as unknown as OrdersRepository,
    products as unknown as ProductsRepository,
    wallets as unknown as WalletRepository,
    walletService as unknown as WalletService,
    escrow as unknown as EscrowService,
    settlement as unknown as SettlementService,
    dataSource as unknown as DataSource,
    expiryQueue as never,
  );
  return { service, disputes, orders, products, wallets, walletService, escrow, settlement, expiryQueue };
}

describe("DisputeService", () => {
  it("raises disputes and schedules expiry", async () => {
    const ctx = setup();
    ctx.orders.findById.mockResolvedValue(order());
    ctx.disputes.findOpenByOrder.mockResolvedValue(null);
    ctx.disputes.create.mockImplementation(async (data: Partial<Dispute>) => ({
      ...dispute(),
      ...data,
      id: "dis-1",
    }));
    ctx.expiryQueue.add.mockResolvedValue({ id: "job-1" });

    const result = await ctx.service.raise("buyer-1", "o-1", "Item arrived damaged");

    expect(result.status).toBe(DisputeStatus.OPEN);
    expect(result.expiryJobId).toBe("job-1");
    expect(ctx.orders.updateStatus).toHaveBeenCalledWith(
      "o-1",
      OrderStatus.DISPUTED,
      expect.anything(),
    );
    expect(ctx.expiryQueue.add).toHaveBeenCalledWith(
      "expire",
      { disputeId: "dis-1" },
      expect.objectContaining({ jobId: expect.stringContaining("dis-1") }),
    );
  });

  it("guards raising with ownership, status, and uniqueness", async () => {
    const ctx = setup();
    ctx.orders.findById.mockResolvedValue(null);
    await expect(ctx.service.raise("buyer-1", "missing", "reason here!")).rejects.toBeInstanceOf(
      NotFoundException,
    );

    ctx.orders.findById.mockResolvedValue(order({ buyerId: "buyer-2" }));
    await expect(ctx.service.raise("buyer-1", "o-1", "reason here!")).rejects.toBeInstanceOf(
      ForbiddenException,
    );

    ctx.orders.findById.mockResolvedValue(order({ status: OrderStatus.PENDING }));
    await expect(ctx.service.raise("buyer-1", "o-1", "reason here!")).rejects.toBeInstanceOf(
      InvalidStateTransitionException,
    );

    ctx.orders.findById.mockResolvedValue(order());
    ctx.disputes.findOpenByOrder.mockResolvedValue(dispute());
    await expect(ctx.service.raise("buyer-1", "o-1", "reason here!")).rejects.toBeInstanceOf(
      ConflictException,
    );
  });

  it("resolves for buyers with refunds and restocking", async () => {
    const ctx = setup();
    ctx.disputes.findById.mockResolvedValue(
      dispute({ expiryJobId: "dispute-expiry-dis-1" }),
    );
    ctx.orders.findById.mockResolvedValue(order());
    ctx.wallets.findSystemWallet.mockResolvedValue({ id: "escrow-w" });
    ctx.walletService.ensureBuyerWallet.mockResolvedValue({ id: "buyer-w" });
    ctx.orders.findItemsByOrder.mockResolvedValue([
      { productId: "p-1", quantity: 2, unitPrice: "2500.00", productName: "Ankara" },
    ]);
    ctx.expiryQueue.getJob.mockResolvedValue({ remove: vi.fn() });

    const result = await ctx.service.resolve("dis-1", "admin-1", "BUYER");

    expect(result.status).toBe(DisputeStatus.RESOLVED_BUYER);
    expect(result.adminId).toBe("admin-1");
    expect(result.resolvedAt).toBeInstanceOf(Date);
    expect(ctx.escrow.refundFunds).toHaveBeenCalledWith(
      expect.objectContaining({ escrowWalletId: "escrow-w", buyerWalletId: "buyer-w" }),
    );
    expect(ctx.products.restoreStock).toHaveBeenCalledWith("p-1", 2, expect.anything());
    expect(ctx.orders.updateStatus).toHaveBeenCalledWith(
      "o-1",
      OrderStatus.CANCELLED,
      expect.anything(),
    );
    expect(ctx.expiryQueue.getJob).toHaveBeenCalled();
  });

  it("resolves for sellers through settlement", async () => {
    const ctx = setup();
    ctx.disputes.findById.mockResolvedValue(dispute());
    ctx.expiryQueue.getJob.mockResolvedValue(null);

    const result = await ctx.service.resolve("dis-1", "admin-1", "SELLER");

    expect(result.status).toBe(DisputeStatus.RESOLVED_SELLER);
    expect(ctx.orders.updateStatus).toHaveBeenCalledWith("o-1", OrderStatus.DELIVERED);
    expect(ctx.settlement.settle).toHaveBeenCalledWith("o-1");
  });

  it("rejects resolving settled disputes", async () => {
    const ctx = setup();
    ctx.disputes.findById.mockResolvedValue(
      dispute({ status: DisputeStatus.RESOLVED_BUYER }),
    );

    await expect(ctx.service.resolve("dis-1", "admin-1", "SELLER")).rejects.toBeInstanceOf(
      InvalidStateTransitionException,
    );
    expect(ctx.expiryQueue.getJob).not.toHaveBeenCalled();
  });

  it("expires neglected disputes in the seller's favour", async () => {
    const ctx = setup();
    ctx.disputes.findById.mockResolvedValue(dispute());
    ctx.expiryQueue.getJob.mockResolvedValue(null);

    expect(await ctx.service.expire("dis-1")).toBe("expired");
    expect(ctx.settlement.settle).toHaveBeenCalledWith("o-1");
  });

  it("treats already-resolved expiries as duplicates", async () => {
    const ctx = setup();
    ctx.disputes.findById.mockResolvedValue(
      dispute({ status: DisputeStatus.EXPIRED }),
    );

    expect(await ctx.service.expire("dis-1")).toBe("duplicate");
    expect(ctx.settlement.settle).not.toHaveBeenCalled();

    ctx.disputes.findById.mockResolvedValue(null);
    expect(await ctx.service.expire("missing")).toBe("duplicate");
  });
});

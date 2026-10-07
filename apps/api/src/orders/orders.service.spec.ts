import {
  BadRequestException,
  ForbiddenException,
  NotFoundException,
} from "@nestjs/common";
import { DataSource } from "typeorm";
import { EventEmitter2 } from "@nestjs/event-emitter";
import { describe, expect, it, vi, type Mock } from "vitest";
import { OrderStatus, UserRole } from "@tradeloop/types";
import { CartRepository } from "../cart/cart.repository";
import { EscrowService } from "../escrow/escrow.service";
import { IdempotencyService } from "../idempotency/idempotency.service";
import { DiscountRejectedException } from "../common/exceptions/discount-rejected.exception";
import { InvalidStateTransitionException } from "../common/exceptions/invalid-state-transition.exception";
import { ProductsRepository } from "../products/products.repository";
import type { Product } from "../products/entities/product.entity";
import { SellerProfilesService } from "../seller-profiles/seller-profiles.service";
import { DiscountService } from "../discounts/discount.service";
import { WalletRepository } from "../wallet/wallet.repository";
import { WalletService } from "../wallet/wallet.service";
import type { Order } from "./entities/order.entity";
import { OrdersRepository } from "./orders.repository";
import { OrdersService } from "./orders.service";

function product(overrides: Partial<Product> = {}): Product {
  return {
    id: "p-1",
    sellerId: "seller-1",
    categoryId: "cat-1",
    name: "Ankara",
    slug: "ankara-p1",
    description: "",
    price: "2500.00",
    stock: 10,
    imageUrl: null,
    ...overrides,
  } as Product;
}

function order(overrides: Partial<Order> = {}): Order {
  return {
    id: "o-1",
    buyerId: "buyer-1",
    sellerId: "seller-1",
    status: OrderStatus.PENDING,
    originalAmount: "5000.00",
    discountedAmount: null,
    totalAmount: "5000.00",
    commissionAmount: null,
    shippingAddress: { line1: "1 Adeola St", city: "Lagos", country: "NG" },
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
  const orders: Record<string, Mock> = {
    createOrder: vi.fn(),
    addItems: vi.fn(),
    findById: vi.fn(),
    findItemsByOrder: vi.fn(),
    findItemsByOrders: vi.fn(),
    updateStatus: vi.fn(),
    listByBuyer: vi.fn(),
    listBySeller: vi.fn(),
  };
  const carts = { findByBuyer: vi.fn(), findItems: vi.fn(), clearCart: vi.fn() };
  const products = {
    findByIds: vi.fn(),
    decrementStock: vi.fn(),
    restoreStock: vi.fn(),
  };
  const wallets = {
    debitAtomic: vi.fn(),
    creditAtomic: vi.fn(),
    recordTransaction: vi.fn(),
    findSystemWallet: vi.fn(),
  };
  const walletService = { ensureBuyerWallet: vi.fn() };
  const sellers = { assertSellerActive: vi.fn(async () => undefined) };
  const discounts = {
    resolveForGroup: vi.fn(async () => null),
    claimUsage: vi.fn(),
    recordRedemption: vi.fn(),
  };
  const idempotency = { findResponse: vi.fn(), saveResponse: vi.fn() };
  const escrow = { holdFunds: vi.fn(), refundFunds: vi.fn(), releaseFunds: vi.fn() };
  const emitter = { emit: vi.fn() };
  const webhooks = { dispatch: vi.fn() };
  const queryRunner = runner();
  const dataSource = { createQueryRunner: vi.fn(() => queryRunner) };
  const state: { current?: OrderStatus } = {};  const service = new OrdersService(
    orders as unknown as OrdersRepository,
    carts as unknown as CartRepository,
    products as unknown as ProductsRepository,
    wallets as unknown as WalletRepository,
    walletService as unknown as WalletService,
    sellers as unknown as SellerProfilesService,
    discounts as unknown as DiscountService,
    idempotency as unknown as IdempotencyService,
    escrow as unknown as EscrowService,
    emitter as unknown as EventEmitter2,
    webhooks as never,
    dataSource as unknown as DataSource,
  );
  return { service, orders, carts, products, wallets, walletService, sellers, discounts, idempotency, escrow, emitter, webhooks, state };
}

const ADDRESS = { line1: "1 Adeola St", city: "Lagos", country: "NG" };

describe("OrdersService", () => {
  it("splits multi-seller checkouts into one escrow-held order per seller", async () => {
    const ctx = setup();
    ctx.products.findByIds.mockResolvedValue([
      product({ id: "p-1", sellerId: "seller-1", price: "2500.00" }),
      product({ id: "p-2", sellerId: "seller-2", price: "1000.00" }),
    ]);
    ctx.walletService.ensureBuyerWallet.mockResolvedValue({ id: "buyer-wallet" });
    ctx.wallets.findSystemWallet.mockResolvedValue({ id: "escrow-wallet" });
    ctx.orders.createOrder.mockImplementation(async (data: Partial<Order>) => ({
      ...order(),
      ...data,
      id: `order-for-${(data as Order).sellerId}`,
    }));
    ctx.orders.addItems.mockImplementation(async (items: unknown[]) => items);

    const result = await ctx.service.create("buyer-1", {
      items: [
        { productId: "p-1", quantity: 2 },
        { productId: "p-2", quantity: 1 },
      ],
      shippingAddress: ADDRESS,
    });

    expect(result.orders).toHaveLength(2);
    const first = result.orders.find((o) => o.sellerId === "seller-1");
    expect(first?.totalAmount).toBe("5000.00");
    expect(first?.items[0]).toMatchObject({ unitPrice: "2500.00", productName: "Ankara" });
    expect(ctx.products.decrementStock).toHaveBeenCalledTimes(2);
    expect(ctx.escrow.holdFunds).toHaveBeenCalledTimes(2);
    expect(ctx.escrow.holdFunds).toHaveBeenCalledWith(
      expect.objectContaining({
        buyerWalletId: "buyer-wallet",
        escrowWalletId: "escrow-wallet",
        amount: "5000.00",
      }),
    );
    expect(ctx.sellers.assertSellerActive).toHaveBeenCalledWith("seller-1");
    expect(ctx.sellers.assertSellerActive).toHaveBeenCalledWith("seller-2");
  });

  it("returns stored responses for repeated idempotency keys", async () => {
    const ctx = setup();
    const stored = { orders: [order()] };
    ctx.idempotency.findResponse.mockResolvedValue(stored);

    const result = await ctx.service.create(
      "buyer-1",
      { items: [{ productId: "p-1", quantity: 1 }], shippingAddress: ADDRESS },
      "key-123",
    );

    expect(result).toBe(stored);
    expect(ctx.products.findByIds).not.toHaveBeenCalled();
  });

  it("rejects unavailable products and inactive sellers", async () => {
    const ctx = setup();
    ctx.products.findByIds.mockResolvedValue([product({ id: "p-1" })]);

    await expect(
      ctx.service.create(
        "buyer-1",
        { items: [{ productId: "missing", quantity: 1 }], shippingAddress: ADDRESS },
        undefined,
      ),
    ).rejects.toBeInstanceOf(BadRequestException);

    ctx.sellers.assertSellerActive.mockRejectedValue(
      new ForbiddenException("Seller account is not active"),
    );
    await expect(
      ctx.service.create(
        "buyer-1",
        { items: [{ productId: "p-1", quantity: 1 }], shippingAddress: ADDRESS },
        undefined,
      ),
    ).rejects.toBeInstanceOf(ForbiddenException);
  });

  it("walks the seller and buyer transitions in order", async () => {
    const ctx = setup();
    ctx.orders.findById.mockImplementation(async (id: string) =>
      order({ id, status: ctx.state.current ?? OrderStatus.PENDING }),
    );
    ctx.orders.findItemsByOrders.mockResolvedValue([]);
    ctx.orders.updateStatus.mockImplementation(async (id: string, status: OrderStatus) => {
      ctx.state.current = status;
    });

    await ctx.service.confirmBySeller("seller-1", "o-1");
    expect(ctx.state.current).toBe(OrderStatus.CONFIRMED);
    await ctx.service.shipBySeller("seller-1", "o-1");
    expect(ctx.state.current).toBe(OrderStatus.SHIPPED);
    await ctx.service.confirmDelivery("buyer-1", "o-1");
    expect(ctx.state.current).toBe(OrderStatus.DELIVERED);
    expect(ctx.emitter.emit).toHaveBeenCalledWith("order.delivered", { orderId: "o-1" });
  });

  it("rejects out-of-order transitions and wrong parties", async () => {
    const ctx = setup();
    ctx.orders.findById.mockResolvedValue(order({ status: OrderStatus.PENDING }));

    await expect(ctx.service.shipBySeller("seller-1", "o-1")).rejects.toBeInstanceOf(
      InvalidStateTransitionException,
    );
    await expect(ctx.service.confirmBySeller("seller-2", "o-1")).rejects.toBeInstanceOf(
      ForbiddenException,
    );
    await expect(ctx.service.confirmDelivery("buyer-2", "o-1")).rejects.toBeInstanceOf(
      ForbiddenException,
    );
    await expect(ctx.service.confirmDelivery("buyer-1", "o-1")).rejects.toBeInstanceOf(
      InvalidStateTransitionException,
    );
  });

  it("cancels with escrow refund and stock restoration", async () => {
    const ctx = setup();
    ctx.orders.findById.mockResolvedValue(order({ status: OrderStatus.SHIPPED }));
    ctx.orders.findItemsByOrder.mockResolvedValue([
      { productId: "p-1", quantity: 2, unitPrice: "2500.00", productName: "Ankara" },
    ]);
    ctx.wallets.findSystemWallet.mockResolvedValue({ id: "escrow-wallet" });
    ctx.walletService.ensureBuyerWallet.mockResolvedValue({ id: "buyer-wallet" });
    ctx.orders.findItemsByOrders.mockResolvedValue([]);

    await ctx.service.cancelByBuyer("buyer-1", "o-1");

    expect(ctx.orders.updateStatus).toHaveBeenCalledWith(
      "o-1",
      OrderStatus.CANCELLED,
      expect.anything(),
    );
    expect(ctx.escrow.refundFunds).toHaveBeenCalledWith(
      expect.objectContaining({
        escrowWalletId: "escrow-wallet",
        buyerWalletId: "buyer-wallet",
        amount: "5000.00",
        orderId: "o-1",
      }),
    );
    expect(ctx.products.restoreStock).toHaveBeenCalledWith("p-1", 2, expect.anything());
  });

  it("refuses cancellation after delivery", async () => {
    const ctx = setup();
    ctx.orders.findById.mockResolvedValue(order({ status: OrderStatus.DELIVERED }));

    await expect(ctx.service.cancelByBuyer("buyer-1", "o-1")).rejects.toBeInstanceOf(
      InvalidStateTransitionException,
    );
  });

  it("rejects empty carts at checkout", async () => {
    const ctx = setup();
    ctx.carts.findByBuyer.mockResolvedValue({ id: "cart-1" });
    ctx.carts.findItems.mockResolvedValue([]);

    await expect(ctx.service.createFromCart("buyer-1", ADDRESS)).rejects.toBeInstanceOf(
      BadRequestException,
    );
  });

  it("throws not found for missing orders", async () => {
    const ctx = setup();
    ctx.orders.findById.mockResolvedValue(null);

    await expect(
      ctx.service.getForUser("buyer-1", UserRole.BUYER, "missing"),
    ).rejects.toBeInstanceOf(NotFoundException);
  });

  it("applies discount codes and records redemptions with request metadata", async () => {
    const ctx = setup();
    ctx.products.findByIds.mockResolvedValue([
      product({ id: "p-1", sellerId: "seller-1", price: "2500.00" }),
    ]);
    ctx.walletService.ensureBuyerWallet.mockResolvedValue({ id: "buyer-wallet" });
    ctx.wallets.findSystemWallet.mockResolvedValue({ id: "escrow-wallet" });
    ctx.orders.createOrder.mockImplementation(async (data: Partial<Order>) => ({
      ...order(),
      ...data,
      id: "order-1",
    }));
    ctx.orders.addItems.mockImplementation(async (items: unknown[]) => items);
    ctx.discounts.resolveForGroup.mockResolvedValue({
      discount: { id: "discount-1" },
      deductionMinor: 50000,
    });

    const result = await ctx.service.create(
      "buyer-1",
      {
        items: [{ productId: "p-1", quantity: 2 }],
        shippingAddress: ADDRESS,
        discountCode: "SAVE10",
      },
      undefined,
      { ipAddress: "1.2.3.4", userAgent: "test-agent" },
    );

    expect(result.orders[0].totalAmount).toBe("4500.00");
    expect(result.orders[0].discountedAmount).toBe("500.00");
    expect(result.orders[0].discountId).toBe("discount-1");
    expect(ctx.escrow.holdFunds).toHaveBeenCalledWith(
      expect.objectContaining({
        buyerWalletId: "buyer-wallet",
        escrowWalletId: "escrow-wallet",
        amount: "4500.00",
      }),
    );
    expect(ctx.discounts.claimUsage).toHaveBeenCalledWith("discount-1", expect.anything());
    expect(ctx.discounts.recordRedemption).toHaveBeenCalledWith(
      expect.objectContaining({
        discountId: "discount-1",
        orderId: "order-1",
        userId: "buyer-1",
        amountDeducted: "500.00",
        ipAddress: "1.2.3.4",
        userAgent: "test-agent",
      }),
      expect.anything(),
    );
  });

  it("rejects invalid discount codes without charging", async () => {
    const ctx = setup();
    ctx.products.findByIds.mockResolvedValue([
      product({ id: "p-1", sellerId: "seller-1", price: "2500.00" }),
    ]);
    ctx.walletService.ensureBuyerWallet.mockResolvedValue({ id: "buyer-wallet" });
    ctx.wallets.findSystemWallet.mockResolvedValue({ id: "escrow-wallet" });
    ctx.discounts.resolveForGroup.mockRejectedValue(
      new DiscountRejectedException("Discount code is invalid"),
    );

    await expect(
      ctx.service.create("buyer-1", {
        items: [{ productId: "p-1", quantity: 1 }],
        shippingAddress: ADDRESS,
        discountCode: "NOPE",
      }),
    ).rejects.toBeInstanceOf(DiscountRejectedException);
    expect(ctx.orders.createOrder).not.toHaveBeenCalled();
  });
});

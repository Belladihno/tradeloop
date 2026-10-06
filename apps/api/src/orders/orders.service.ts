import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import { DataSource } from "typeorm";
import { EventEmitter2 } from "@nestjs/event-emitter";
import {
  OrderStatus,
  UserRole,
  WalletType,
  type OrderWithItems,
  type ShippingAddress,
} from "@tradeloop/types";
import type { CreateOrderInput } from "@tradeloop/validators";
import { InvalidStateTransitionException } from "../common/exceptions/invalid-state-transition.exception";
import { fromMinorUnits, toMinorUnits } from "../common/utils/money";
import { CartRepository } from "../cart/cart.repository";
import { DiscountService } from "../discounts/discount.service";
import { EscrowService } from "../escrow/escrow.service";
import { IdempotencyService } from "../idempotency/idempotency.service";
import { ORDER_DELIVERED_EVENT } from "./events";
import { ProductsRepository } from "../products/products.repository";
import type { Product } from "../products/entities/product.entity";
import { SellerProfilesService } from "../seller-profiles/seller-profiles.service";
import { WalletRepository } from "../wallet/wallet.repository";
import { WalletService } from "../wallet/wallet.service";
import { OrdersRepository } from "./orders.repository";
import type { Order } from "./entities/order.entity";

export interface CheckoutLine {
  productId: string;
  quantity: number;
}

export interface CreateOrderResult {
  orders: OrderWithItems[];
}

export interface RequestMeta {
  ipAddress?: string;
  userAgent?: string;
}

const CANCELLABLE = [OrderStatus.PENDING, OrderStatus.CONFIRMED, OrderStatus.SHIPPED];

@Injectable()
export class OrdersService {
  constructor(
    private readonly orders: OrdersRepository,
    private readonly carts: CartRepository,
    private readonly products: ProductsRepository,
    private readonly wallets: WalletRepository,
    private readonly walletService: WalletService,
    private readonly sellers: SellerProfilesService,
    private readonly discounts: DiscountService,
    private readonly idempotency: IdempotencyService,
    private readonly escrow: EscrowService,
    private readonly emitter: EventEmitter2,
    private readonly dataSource: DataSource,
  ) {}

  async create(
    buyerId: string,
    input: CreateOrderInput,
    idempotencyKey?: string,
    meta: RequestMeta = {},
  ): Promise<CreateOrderResult> {
    if (idempotencyKey) {
      const stored = await this.idempotency.findResponse(idempotencyKey, buyerId);
      if (stored) return stored as unknown as CreateOrderResult;
    }
    const result = await this.runCheckout(
      buyerId,
      input.items,
      input.shippingAddress,
      input.discountCode,
      meta,
    );
    if (idempotencyKey) {
      const saved = await this.idempotency.saveResponse(
        idempotencyKey,
        buyerId,
        result as unknown as Record<string, unknown>,
      );
      return saved as unknown as CreateOrderResult;
    }
    return result;
  }

  async createFromCart(
    buyerId: string,
    shippingAddress: ShippingAddress,
    discountCode?: string,
    idempotencyKey?: string,
    meta: RequestMeta = {},
  ): Promise<CreateOrderResult> {
    const cart = await this.carts.findByBuyer(buyerId);
    const items = cart ? await this.carts.findItems(cart.id) : [];
    if (items.length === 0) throw new BadRequestException("Cart is empty");
    if (idempotencyKey) {
      const stored = await this.idempotency.findResponse(idempotencyKey, buyerId);
      if (stored) return stored as unknown as CreateOrderResult;
    }
    const result = await this.runCheckout(
      buyerId,
      items.map((item) => ({ productId: item.productId, quantity: item.quantity })),
      shippingAddress,
      discountCode,
      meta,
      cart?.id,
    );
    if (idempotencyKey) {
      const saved = await this.idempotency.saveResponse(
        idempotencyKey,
        buyerId,
        result as unknown as Record<string, unknown>,
      );
      return saved as unknown as CreateOrderResult;
    }
    return result;
  }

  async listMine(buyerId: string): Promise<OrderWithItems[]> {
    const orders = await this.orders.listByBuyer(buyerId);
    return this.attachItems(orders);
  }

  async listIncoming(sellerId: string): Promise<OrderWithItems[]> {
    const orders = await this.orders.listBySeller(sellerId);
    return this.attachItems(orders);
  }

  async getForUser(userId: string, role: UserRole, orderId: string): Promise<OrderWithItems> {
    const order = await this.requireOrder(orderId);
    if (order.buyerId !== userId && order.sellerId !== userId && role !== UserRole.ADMIN) {
      throw new ForbiddenException("You do not have access to this order");
    }
    const [withItems] = await this.attachItems([order]);
    return withItems;
  }

  async confirmBySeller(sellerId: string, orderId: string): Promise<OrderWithItems> {
    const order = await this.requireSellerOrder(sellerId, orderId);
    if (order.status !== OrderStatus.PENDING) {
      throw new InvalidStateTransitionException(order.status, OrderStatus.CONFIRMED);
    }
    await this.orders.updateStatus(orderId, OrderStatus.CONFIRMED);
    return this.getForUser(sellerId, UserRole.SELLER, orderId);
  }

  async shipBySeller(sellerId: string, orderId: string): Promise<OrderWithItems> {
    const order = await this.requireSellerOrder(sellerId, orderId);
    if (order.status !== OrderStatus.CONFIRMED) {
      throw new InvalidStateTransitionException(order.status, OrderStatus.SHIPPED);
    }
    await this.orders.updateStatus(orderId, OrderStatus.SHIPPED);
    return this.getForUser(sellerId, UserRole.SELLER, orderId);
  }

  async confirmDelivery(buyerId: string, orderId: string): Promise<OrderWithItems> {
    const order = await this.requireOrder(orderId);
    if (order.buyerId !== buyerId) {
      throw new ForbiddenException("Only the buyer can confirm delivery");
    }
    if (order.status !== OrderStatus.SHIPPED) {
      throw new InvalidStateTransitionException(order.status, OrderStatus.DELIVERED);
    }
    await this.orders.updateStatus(orderId, OrderStatus.DELIVERED);
    this.emitter.emit(ORDER_DELIVERED_EVENT, { orderId });
    return this.getForUser(buyerId, UserRole.BUYER, orderId);
  }

  async cancelByBuyer(buyerId: string, orderId: string): Promise<OrderWithItems> {
    const order = await this.requireOrder(orderId);
    if (order.buyerId !== buyerId) {
      throw new ForbiddenException("Only the buyer can cancel this order");
    }
    if (!CANCELLABLE.includes(order.status)) {
      throw new InvalidStateTransitionException(order.status, OrderStatus.CANCELLED);
    }
    const runner = this.dataSource.createQueryRunner();
    await runner.connect();
    await runner.startTransaction();
    try {
      await this.orders.updateStatus(orderId, OrderStatus.CANCELLED, runner);
      const items = await this.orders.findItemsByOrder(orderId);
      const escrow = await this.escrowWallet();
      const buyerWallet = await this.walletService.ensureBuyerWallet(buyerId);
      await this.escrow.refundFunds({
        escrowWalletId: escrow.id,
        buyerWalletId: buyerWallet.id,
        amount: order.totalAmount,
        orderId,
        runner,
      });
      for (const item of items) {
        await this.products.restoreStock(item.productId, item.quantity, runner);
      }
      await runner.commitTransaction();
    } catch (error) {
      await runner.rollbackTransaction();
      throw error;
    } finally {
      await runner.release();
    }
    return this.getForUser(buyerId, UserRole.BUYER, orderId);
  }

  private async runCheckout(
    buyerId: string,
    lines: CheckoutLine[],
    shippingAddress: ShippingAddress,
    discountCode?: string,
    meta: RequestMeta = {},
    clearCartId?: string,
  ): Promise<CreateOrderResult> {
    const catalog = await this.products.findByIds(lines.map((line) => line.productId));
    const byId = new Map(catalog.map((product) => [product.id, product]));
    for (const line of lines) {
      if (!byId.has(line.productId)) {
        throw new BadRequestException(`Product ${line.productId} is unavailable`);
      }
    }
    const groups = new Map<string, { product: Product; quantity: number }[]>();
    for (const line of lines) {
      const product = byId.get(line.productId) as Product;
      const group = groups.get(product.sellerId) ?? [];
      group.push({ product, quantity: line.quantity });
      groups.set(product.sellerId, group);
    }
    for (const sellerId of groups.keys()) {
      await this.sellers.assertSellerActive(sellerId);
    }

    const buyerWallet = await this.walletService.ensureBuyerWallet(buyerId);
    const escrow = await this.escrowWallet();
    const created: OrderWithItems[] = [];

    const runner = this.dataSource.createQueryRunner();
    await runner.connect();
    await runner.startTransaction();
    try {
      for (const [sellerId, entries] of groups) {
        const subtotalMinor = entries.reduce(
          (sum, entry) => sum + toMinorUnits(entry.product.price) * entry.quantity,
          0,
        );
        const evaluation = await this.discounts.resolveForGroup(
          buyerId,
          discountCode,
          sellerId,
          entries.map((entry) => ({
            productId: entry.product.id,
            categoryId: entry.product.categoryId,
            sellerId,
            lineTotalMinor: toMinorUnits(entry.product.price) * entry.quantity,
          })),
        );
        const deductionMinor = evaluation?.deductionMinor ?? 0;
        const total = fromMinorUnits(subtotalMinor - deductionMinor);
        const discounted = deductionMinor > 0 ? fromMinorUnits(deductionMinor) : null;
        for (const entry of entries) {
          await this.products.decrementStock(entry.product.id, entry.quantity, runner);
        }
        const order = await this.orders.createOrder(
          {
            buyerId,
            sellerId,
            status: OrderStatus.PENDING,
            originalAmount: fromMinorUnits(subtotalMinor),
            discountedAmount: discounted,
            totalAmount: total,
            commissionAmount: null,
            discountId: evaluation?.discount.id ?? null,
            shippingAddress,
          },
          runner,
        );
        const items = await this.orders.addItems(
          entries.map((entry) => ({
            orderId: order.id,
            productId: entry.product.id,
            quantity: entry.quantity,
            unitPrice: entry.product.price,
            productName: entry.product.name,
          })),
          runner,
        );
        await this.escrow.holdFunds({
          buyerWalletId: buyerWallet.id,
          escrowWalletId: escrow.id,
          amount: total,
          orderId: order.id,
          runner,
        });
        if (evaluation && discounted) {
          await this.discounts.claimUsage(evaluation.discount.id, runner);
          await this.discounts.recordRedemption(
            {
              discountId: evaluation.discount.id,
              orderId: order.id,
              userId: buyerId,
              amountDeducted: discounted,
              ipAddress: meta.ipAddress,
              userAgent: meta.userAgent,
            },
            runner,
          );
        }
        created.push({ ...order, items });
      }
      if (clearCartId) {
        await this.carts.clearCart(clearCartId, runner);
      }
      await runner.commitTransaction();
    } catch (error) {
      await runner.rollbackTransaction();
      throw error;
    } finally {
      await runner.release();
    }
    return { orders: created };
  }

  private async escrowWallet(): Promise<{ id: string }> {
    const escrow = await this.wallets.findSystemWallet(WalletType.ESCROW);
    if (!escrow) throw new NotFoundException("Escrow wallet is not configured");
    return escrow;
  }

  private async requireOrder(orderId: string): Promise<Order> {
    const order = await this.orders.findById(orderId);
    if (!order) throw new NotFoundException("Order not found");
    return order;
  }

  private async requireSellerOrder(sellerId: string, orderId: string): Promise<Order> {
    const order = await this.requireOrder(orderId);
    if (order.sellerId !== sellerId) {
      throw new ForbiddenException("You do not have access to this order");
    }
    return order;
  }

  private async attachItems(orders: Order[]): Promise<OrderWithItems[]> {
    if (orders.length === 0) return [];
    const items = await this.orders.findItemsByOrders(orders.map((order) => order.id));
    const byOrder = new Map<string, typeof items>();
    for (const item of items) {
      const group = byOrder.get(item.orderId) ?? [];
      group.push(item);
      byOrder.set(item.orderId, group);
    }
    return orders.map((order) => ({ ...order, items: byOrder.get(order.id) ?? [] }));
  }
}

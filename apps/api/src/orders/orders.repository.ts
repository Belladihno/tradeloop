import { Injectable } from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { In, IsNull, Repository, type QueryRunner } from "typeorm";
import { OrderStatus } from "@tradeloop/types";
import { OrderItem } from "./entities/order-item.entity";
import { Order } from "./entities/order.entity";

@Injectable()
export class OrdersRepository {
  constructor(
    @InjectRepository(Order) private readonly orders: Repository<Order>,
    @InjectRepository(OrderItem) private readonly items: Repository<OrderItem>,
  ) {}

  createOrder(data: Partial<Order>, runner?: QueryRunner): Promise<Order> {
    const writer = runner ? runner.manager.getRepository(Order) : this.orders;
    return writer.save(this.orders.create(data));
  }

  addItems(items: Partial<OrderItem>[], runner?: QueryRunner): Promise<OrderItem[]> {
    const writer = runner ? runner.manager.getRepository(OrderItem) : this.items;
    return writer.save(items.map((item) => this.items.create(item)));
  }

  findById(id: string): Promise<Order | null> {
    return this.orders.findOne({ where: { id, deletedAt: IsNull() } });
  }

  findItemsByOrder(orderId: string): Promise<OrderItem[]> {
    return this.items.find({ where: { orderId } });
  }

  async findItemsByOrders(orderIds: string[]): Promise<OrderItem[]> {
    if (orderIds.length === 0) return [];
    return this.items.find({ where: { orderId: In(orderIds) } });
  }

  async updateStatus(id: string, status: Order["status"], runner?: QueryRunner): Promise<void> {
    const writer = runner ? runner.manager.getRepository(Order) : this.orders;
    await writer.update({ id }, { status });
  }

  async markCompleted(id: string, commissionAmount: string, runner?: QueryRunner): Promise<void> {
    const writer = runner ? runner.manager.getRepository(Order) : this.orders;
    await writer.update({ id }, { status: OrderStatus.COMPLETED, commissionAmount });
  }

  listByBuyer(buyerId: string, limit = 50): Promise<Order[]> {
    return this.orders.find({
      where: { buyerId, deletedAt: IsNull() },
      order: { createdAt: "DESC" },
      take: limit,
    });
  }

  listBySeller(sellerId: string, limit = 50): Promise<Order[]> {
    return this.orders.find({
      where: { sellerId, deletedAt: IsNull() },
      order: { createdAt: "DESC" },
      take: limit,
    });
  }
}

import { Injectable } from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { IsNull, Repository, type QueryRunner } from "typeorm";
import { CartItem } from "./entities/cart-item.entity";
import { Cart } from "./entities/cart.entity";

@Injectable()
export class CartRepository {
  constructor(
    @InjectRepository(Cart) private readonly carts: Repository<Cart>,
    @InjectRepository(CartItem) private readonly items: Repository<CartItem>,
  ) {}

  findByBuyer(buyerId: string): Promise<Cart | null> {
    return this.carts.findOne({ where: { buyerId, deletedAt: IsNull() } });
  }

  async getOrCreate(buyerId: string): Promise<Cart> {
    const existing = await this.findByBuyer(buyerId);
    if (existing) return existing;
    return this.carts.save(this.carts.create({ buyerId }));
  }

  findItems(cartId: string): Promise<CartItem[]> {
    return this.items.find({ where: { cartId, deletedAt: IsNull() } });
  }

  findItem(cartId: string, productId: string): Promise<CartItem | null> {
    return this.items.findOne({ where: { cartId, productId, deletedAt: IsNull() } });
  }

  async upsertItem(cartId: string, productId: string, quantity: number): Promise<CartItem> {
    const existing = await this.findItem(cartId, productId);
    if (existing) {
      existing.quantity = quantity;
      return this.items.save(existing);
    }
    return this.items.save(this.items.create({ cartId, productId, quantity }));
  }

  async removeItem(cartId: string, productId: string): Promise<void> {
    await this.items.delete({ cartId, productId });
  }

  async clearCart(cartId: string, runner?: QueryRunner): Promise<void> {
    if (runner) {
      await runner.manager.delete(CartItem, { cartId });
    } else {
      await this.items.delete({ cartId });
    }
  }
}

import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import type { CartDetails } from "@tradeloop/types";
import { ProductsRepository } from "../products/products.repository";
import { CartRepository } from "./cart.repository";
import type { CartItem } from "./entities/cart-item.entity";

@Injectable()
export class CartService {
  constructor(
    private readonly carts: CartRepository,
    private readonly products: ProductsRepository,
  ) {}

  async getCart(buyerId: string): Promise<CartDetails> {
    const cart = await this.carts.getOrCreate(buyerId);
    return this.withProducts(cart.id, buyerId);
  }

  async addItem(buyerId: string, productId: string, quantity: number): Promise<CartItem> {
    const product = await this.products.findById(productId);
    if (!product) throw new NotFoundException("Product not found");
    const cart = await this.carts.getOrCreate(buyerId);
    const existing = await this.carts.findItem(cart.id, productId);
    const nextQuantity = (existing?.quantity ?? 0) + quantity;
    if (nextQuantity > 99) {
      throw new BadRequestException("Cart quantity cannot exceed 99 per product");
    }
    return this.carts.upsertItem(cart.id, productId, nextQuantity);
  }

  async updateQuantity(
    buyerId: string,
    productId: string,
    quantity: number,
  ): Promise<CartItem> {
    const cart = await this.carts.getOrCreate(buyerId);
    const existing = await this.carts.findItem(cart.id, productId);
    if (!existing) throw new NotFoundException("Product is not in the cart");
    return this.carts.upsertItem(cart.id, productId, quantity);
  }

  async removeItem(buyerId: string, productId: string): Promise<void> {
    const cart = await this.carts.getOrCreate(buyerId);
    await this.carts.removeItem(cart.id, productId);
  }

  async clear(buyerId: string): Promise<void> {
    const cart = await this.carts.getOrCreate(buyerId);
    await this.carts.clearCart(cart.id);
  }

  private async withProducts(cartId: string, buyerId: string): Promise<CartDetails> {
    const items = await this.carts.findItems(cartId);
    const products = await this.products.findByIds(items.map((item) => item.productId));
    const byId = new Map(products.map((product) => [product.id, product]));
    return {
      id: cartId,
      buyerId,
      items: items.map((item) => {
        const product = byId.get(item.productId) ?? null;
        return {
          ...item,
          product: product
            ? {
                id: product.id,
                name: product.name,
                slug: product.slug,
                price: product.price,
                stock: product.stock,
                imageUrl: product.imageUrl,
              }
            : null,
        };
      }),
    };
  }
}

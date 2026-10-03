import {
  BadRequestException,
  NotFoundException,
} from "@nestjs/common";
import { describe, expect, it, vi, type Mock } from "vitest";
import { CartRepository } from "./cart.repository";
import { CartService } from "./cart.service";
import type { Product } from "../products/entities/product.entity";
import { ProductsRepository } from "../products/products.repository";

function setup() {
  const carts = {
    getOrCreate: vi.fn(),
    findItems: vi.fn(),
    findItem: vi.fn(),
    upsertItem: vi.fn(),
    removeItem: vi.fn(),
    clearCart: vi.fn(),
  };
  const products = { findById: vi.fn(), findByIds: vi.fn() };
  const service = new CartService(
    carts as unknown as CartRepository,
    products as unknown as ProductsRepository,
  );
  return { service, carts, products };
}

function product(overrides: Partial<Product> = {}): Product {
  return {
    id: "p-1",
    sellerId: "seller-1",
    categoryId: "cat-1",
    name: "Ankara",
    slug: "ankara-p1",
    price: "2500.00",
    stock: 10,
    imageUrl: null,
    ...overrides,
  } as Product;
}

describe("CartService", () => {
  it("adds new products to the cart", async () => {
    const { service, carts, products } = setup();
    products.findById.mockResolvedValue(product());
    carts.getOrCreate.mockResolvedValue({ id: "cart-1" });
    carts.findItem.mockResolvedValue(null);
    carts.upsertItem.mockImplementation(async (_c: string, _p: string, q: number) => ({ quantity: q }));

    const item = await service.addItem("buyer-1", "p-1", 2);

    expect(carts.upsertItem).toHaveBeenCalledWith("cart-1", "p-1", 2);
    expect(item.quantity).toBe(2);
  });

  it("accumulates quantities and caps at 99", async () => {
    const { service, carts, products } = setup();
    products.findById.mockResolvedValue(product());
    carts.getOrCreate.mockResolvedValue({ id: "cart-1" });
    carts.findItem.mockResolvedValue({ quantity: 98 });

    await expect(service.addItem("buyer-1", "p-1", 2)).rejects.toBeInstanceOf(
      BadRequestException,
    );
  });

  it("rejects unavailable products", async () => {
    const { service, products } = setup();
    products.findById.mockResolvedValue(null);

    await expect(service.addItem("buyer-1", "missing", 1)).rejects.toBeInstanceOf(
      NotFoundException,
    );
  });

  it("rejects quantity updates for items outside the cart", async () => {
    const { service, carts } = setup();
    carts.getOrCreate.mockResolvedValue({ id: "cart-1" });
    carts.findItem.mockResolvedValue(null);

    await expect(service.updateQuantity("buyer-1", "p-1", 3)).rejects.toBeInstanceOf(
      NotFoundException,
    );
  });

  it("returns cart lines with product snapshots", async () => {
    const { service, carts, products } = setup();
    carts.getOrCreate.mockResolvedValue({ id: "cart-1" });
    carts.findItems.mockResolvedValue([
      { id: "ci-1", cartId: "cart-1", productId: "p-1", quantity: 2 },
      { id: "ci-2", cartId: "cart-1", productId: "gone", quantity: 1 },
    ]);
    products.findByIds.mockResolvedValue([product()]);

    const cart = await service.getCart("buyer-1");

    expect(cart.items).toHaveLength(2);
    expect(cart.items[0].product?.name).toBe("Ankara");
    expect(cart.items[1].product).toBeNull();
  });
});

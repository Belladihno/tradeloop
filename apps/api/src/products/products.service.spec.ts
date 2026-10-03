import {
  BadRequestException,
  ForbiddenException,
  NotFoundException,
} from "@nestjs/common";
import { describe, expect, it, vi, type Mock } from "vitest";
import { UserRole } from "@tradeloop/types";
import { CategoryRepository } from "../categories/category.repository";
import type { Category } from "../categories/entities/category.entity";
import { SellerProfilesService } from "../seller-profiles/seller-profiles.service";
import type { Product } from "./entities/product.entity";
import { ProductsRepository } from "./products.repository";
import { ProductsService } from "./products.service";

interface MockProductsRepository {
  create: Mock;
  findById: Mock;
  findBySlug: Mock;
  updateFields: Mock;
  softDelete: Mock;
  listPage: Mock;
}

interface MockCategoryRepository {
  findById: Mock;
  findBySlug: Mock;
  findByIds: Mock;
}

function product(overrides: Partial<Product> = {}): Product {
  return {
    id: "01b0ffa2-product",
    sellerId: "seller-1",
    categoryId: "cat-1",
    name: "Ankara Fabric",
    slug: "ankara-fabric-01b0ffa2",
    description: "Woven cotton",
    price: "2500.00",
    stock: 10,
    imageUrl: null,
    createdAt: new Date(),
    updatedAt: new Date(),
    deletedAt: null,
    ...overrides,
  } as Product;
}

function category(overrides: Partial<Category> = {}): Category {
  return {
    id: "cat-1",
    name: "Fabrics",
    slug: "fabrics",
    parentId: null,
  } as Category;
}

function setup() {
  const products: MockProductsRepository = {
    create: vi.fn(),
    findById: vi.fn(),
    findBySlug: vi.fn(),
    updateFields: vi.fn(),
    softDelete: vi.fn(),
    listPage: vi.fn(),
  };
  const categories: MockCategoryRepository = {
    findById: vi.fn(),
    findBySlug: vi.fn(),
    findByIds: vi.fn(),
  };
  const sellers = { assertSellerActive: vi.fn(async () => undefined) };
  const service = new ProductsService(
    products as unknown as ProductsRepository,
    categories as unknown as CategoryRepository,
    sellers as unknown as SellerProfilesService,
  );
  return { service, products, categories, sellers };
}

describe("ProductsService", () => {
  it("creates products in an existing category", async () => {
    const { service, products, categories } = setup();
    categories.findById.mockResolvedValue(category());
    products.create.mockResolvedValue(product());

    const result = await service.create("seller-1", UserRole.SELLER, {
      name: "Ankara Fabric",
      description: "Woven cotton",
      price: "2500.00",
      categoryId: "cat-1",
      stock: 10,
    });

    expect(products.create).toHaveBeenCalledWith(
      expect.objectContaining({ sellerId: "seller-1", imageUrl: null }),
    );
    expect(result.slug).toBe("ankara-fabric-01b0ffa2");
    expect(result.category).toEqual({ id: "cat-1", name: "Fabrics", slug: "fabrics" });
  });

  it("blocks product creation for inactive sellers", async () => {
    const { service, products, sellers } = setup();
    sellers.assertSellerActive.mockRejectedValue(
      new ForbiddenException("Seller account is not active"),
    );

    await expect(
      service.create("seller-1", UserRole.SELLER, {
        name: "Ankara Fabric",
        price: "2500.00",
        categoryId: "cat-1",
        stock: 1,
      }),
    ).rejects.toBeInstanceOf(ForbiddenException);
    expect(products.create).not.toHaveBeenCalled();
  });

  it("rejects products in unknown categories", async () => {
    const { service, products, categories } = setup();
    categories.findById.mockResolvedValue(null);

    await expect(
      service.create("seller-1", UserRole.SELLER, {
        name: "Ankara Fabric",
        price: "2500.00",
        categoryId: "missing",
        stock: 1,
      }),
    ).rejects.toBeInstanceOf(BadRequestException);
    expect(products.create).not.toHaveBeenCalled();
  });

  it("returns an empty page for unknown category slugs", async () => {
    const { service, products, categories } = setup();
    categories.findBySlug.mockResolvedValue(null);

    const page = await service.list({ category: "nope", sort: "newest", limit: 20 });

    expect(page).toEqual({ items: [], nextCursor: null });
    expect(products.listPage).not.toHaveBeenCalled();
  });

  it("attaches categories to listed products", async () => {
    const { service, products, categories } = setup();
    products.listPage.mockResolvedValue({ items: [product()], nextCursor: "cursor" });
    categories.findByIds.mockResolvedValue([category()]);

    const page = await service.list({ sort: "newest", limit: 20 });

    expect(categories.findByIds).toHaveBeenCalledWith(["cat-1"]);
    expect(page.items[0].category?.slug).toBe("fabrics");
    expect(page.nextCursor).toBe("cursor");
  });

  it("finds products by slug", async () => {
    const { service, products, categories } = setup();
    products.findBySlug.mockResolvedValue(product());
    categories.findById.mockResolvedValue(category());

    const result = await service.getBySlug("ankara-fabric-01b0ffa2");

    expect(result.name).toBe("Ankara Fabric");
  });

  it("throws not found for unknown slugs", async () => {
    const { service, products } = setup();
    products.findBySlug.mockResolvedValue(null);

    await expect(service.getBySlug("missing")).rejects.toBeInstanceOf(NotFoundException);
  });

  it("lets owners update their products", async () => {
    const { service, products, categories } = setup();
    products.findById
      .mockResolvedValueOnce(product())
      .mockResolvedValueOnce(product({ price: "3000.00" }));
    products.updateFields.mockResolvedValue(undefined);
    categories.findById.mockResolvedValue(category());

    const result = await service.update("seller-1", UserRole.SELLER, "01b0ffa2-product", {
      price: "3000.00",
    });

    expect(products.updateFields).toHaveBeenCalledWith("01b0ffa2-product", {
      price: "3000.00",
      imageUrl: null,
    });
    expect(result.price).toBe("3000.00");
  });

  it("rejects updates from other sellers but allows admins", async () => {
    const { service, products, categories } = setup();
    products.findById.mockResolvedValue(product());
    categories.findById.mockResolvedValue(category());

    await expect(
      service.update("seller-2", UserRole.SELLER, "01b0ffa2-product", { stock: 5 }),
    ).rejects.toBeInstanceOf(ForbiddenException);

    products.updateFields.mockResolvedValue(undefined);
    await service.update("admin-1", UserRole.ADMIN, "01b0ffa2-product", { stock: 5 });
    expect(products.updateFields).toHaveBeenCalled();
  });

  it("rejects moving products into unknown categories", async () => {
    const { service, products, categories } = setup();
    products.findById.mockResolvedValue(product());
    categories.findById.mockResolvedValue(null);

    await expect(
      service.update("seller-1", UserRole.SELLER, "01b0ffa2-product", {
        categoryId: "missing",
      }),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it("lets owners delete and blocks strangers", async () => {
    const { service, products } = setup();
    products.findById.mockResolvedValue(product());
    products.softDelete.mockResolvedValue(undefined);

    await service.remove("seller-1", UserRole.SELLER, "01b0ffa2-product");
    expect(products.softDelete).toHaveBeenCalledWith("01b0ffa2-product");

    await expect(
      service.remove("seller-2", UserRole.SELLER, "01b0ffa2-product"),
    ).rejects.toBeInstanceOf(ForbiddenException);
  });
});

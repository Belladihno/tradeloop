import {
  BadRequestException,
  ConflictException,
  NotFoundException,
} from "@nestjs/common";
import { describe, expect, it, vi, type Mock } from "vitest";
import { CategoriesService } from "./categories.service";
import { CategoryRepository } from "./category.repository";
import type { Category } from "./entities/category.entity";
import type { ProductsRepository } from "../products/products.repository";

interface MockCategoryRepository {
  listActive: Mock;
  create: Mock;
  findById: Mock;
  updateFields: Mock;
  softDelete: Mock;
  countChildren: Mock;
}

function category(overrides: Partial<Category> = {}): Category {
  return {
    id: "cat-1",
    name: "Fabrics",
    slug: "fabrics",
    parentId: null,
    ...overrides,
  } as Category;
}

function setup() {
  const categories: MockCategoryRepository = {
    listActive: vi.fn(),
    create: vi.fn(),
    findById: vi.fn(),
    updateFields: vi.fn(),
    softDelete: vi.fn(),
    countChildren: vi.fn(),
  };
  const products = { countByCategory: vi.fn(async () => 0) };
  const service = new CategoriesService(
    categories as unknown as CategoryRepository,
    products as unknown as ProductsRepository,
  );
  return { service, categories, products };
}

describe("CategoriesService", () => {
  it("nests subcategories and keeps orphans at root", async () => {
    const { service, categories } = setup();
    categories.listActive.mockResolvedValue([
      category({ id: "root", name: "Root", slug: "root" }),
      category({ id: "child", name: "Child", slug: "child", parentId: "root" }),
      category({ id: "orphan", name: "Orphan", slug: "orphan", parentId: "gone" }),
    ]);

    const tree = await service.listTree();

    expect(tree.map((node) => node.slug)).toEqual(["root", "orphan"]);
    expect(tree[0].children.map((node) => node.slug)).toEqual(["child"]);
  });

  it("slugifies category names on creation", async () => {
    const { service, categories } = setup();
    categories.create.mockImplementation(async (data: Partial<Category>) => data);

    await service.create({ name: "Men's Wear" });

    expect(categories.create).toHaveBeenCalledWith(
      expect.objectContaining({ slug: "men-s-wear" }),
    );
  });

  it("rejects unknown parents on creation", async () => {
    const { service, categories } = setup();
    categories.findById.mockResolvedValue(null);

    await expect(
      service.create({ name: "Child", parentId: "missing" }),
    ).rejects.toBeInstanceOf(NotFoundException);
  });

  it("rejects self-parenting and cycles on update", async () => {
    const { service, categories } = setup();
    categories.findById.mockImplementation(async (id: string) =>
      id === "gone" ? null : category({ id }),
    );
    categories.listActive.mockResolvedValue([
      category({ id: "a", parentId: null }),
      category({ id: "b", parentId: "a" }),
      category({ id: "c", parentId: "b" }),
    ]);

    await expect(service.update("a", { parentId: "a" })).rejects.toBeInstanceOf(
      BadRequestException,
    );
    await expect(service.update("a", { parentId: "c" })).rejects.toBeInstanceOf(
      BadRequestException,
    );
  });

  it("blocks deletion of categories with children or products", async () => {
    const { service, categories, products } = setup();
    categories.findById.mockResolvedValue(category());

    categories.countChildren.mockResolvedValue(2);
    await expect(service.remove("cat-1")).rejects.toBeInstanceOf(ConflictException);

    categories.countChildren.mockResolvedValue(0);
    products.countByCategory.mockResolvedValue(3);
    await expect(service.remove("cat-1")).rejects.toBeInstanceOf(ConflictException);

    products.countByCategory.mockResolvedValue(0);
    categories.softDelete.mockResolvedValue(undefined);
    await service.remove("cat-1");
    expect(categories.softDelete).toHaveBeenCalledWith("cat-1");
  });
});

import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import { UserRole, type ProductPage, type ProductWithCategory } from "@tradeloop/types";
import type {
  CreateProductInput,
  ProductQueryInput,
  UpdateProductInput,
} from "@tradeloop/validators";
import { CategoryRepository } from "../categories/category.repository";
import type { Category } from "../categories/entities/category.entity";
import { SellerProfilesService } from "../seller-profiles/seller-profiles.service";
import type { Product } from "./entities/product.entity";
import { ProductsRepository } from "./products.repository";

@Injectable()
export class ProductsService {
  constructor(
    private readonly products: ProductsRepository,
    private readonly categories: CategoryRepository,
    private readonly sellers: SellerProfilesService,
  ) {}

  async create(
    sellerId: string,
    role: UserRole,
    input: CreateProductInput,
  ): Promise<ProductWithCategory> {
    if (role !== UserRole.ADMIN) {
      await this.sellers.assertSellerActive(sellerId);
    }
    const category = await this.requireCategory(input.categoryId);
    const product = await this.products.create({
      ...input,
      sellerId,
      imageUrl: input.imageUrl ?? null,
    });
    return this.toResponse(product, category);
  }

  async list(input: ProductQueryInput): Promise<ProductPage> {
    let categoryId: string | undefined;
    if (input.category) {
      const category = await this.categories.findBySlug(input.category);
      if (!category) return { items: [], nextCursor: null };
      categoryId = category.id;
    }
    const page = await this.products.listPage({
      q: input.q,
      categoryId,
      sellerId: input.seller,
      minPrice: input.minPrice,
      maxPrice: input.maxPrice,
      inStockOnly: input.inStock,
      sort: input.sort,
      cursor: input.cursor,
      limit: input.limit,
    });
    const categories = await this.categories.findByIds([
      ...new Set(page.items.map((item) => item.categoryId)),
    ]);
    const byId = new Map(categories.map((category) => [category.id, category]));
    return {
      items: page.items.map((item) => this.toResponse(item, byId.get(item.categoryId) ?? null)),
      nextCursor: page.nextCursor,
    };
  }

  async getBySlug(slug: string): Promise<ProductWithCategory> {
    const product = await this.products.findBySlug(slug);
    if (!product) throw new NotFoundException("Product not found");
    const category = await this.categories.findById(product.categoryId);
    return this.toResponse(product, category);
  }

  async update(
    sellerId: string,
    role: UserRole,
    id: string,
    input: UpdateProductInput,
  ): Promise<ProductWithCategory> {
    const product = await this.requireOwnedProduct(sellerId, role, id);
    if (input.categoryId && input.categoryId !== product.categoryId) {
      await this.requireCategory(input.categoryId);
    }
    await this.products.updateFields(id, {
      ...input,
      imageUrl: input.imageUrl ?? product.imageUrl,
    });
    const updated = await this.requireProduct(id);
    const category = await this.categories.findById(updated.categoryId);
    return this.toResponse(updated, category);
  }

  async remove(sellerId: string, role: UserRole, id: string): Promise<void> {
    await this.requireOwnedProduct(sellerId, role, id);
    await this.products.softDelete(id);
  }

  private async requireProduct(id: string): Promise<Product> {
    const product = await this.products.findById(id);
    if (!product) throw new NotFoundException("Product not found");
    return product;
  }

  private async requireOwnedProduct(
    sellerId: string,
    role: UserRole,
    id: string,
  ): Promise<Product> {
    const product = await this.requireProduct(id);
    if (product.sellerId !== sellerId && role !== UserRole.ADMIN) {
      throw new ForbiddenException("You do not own this product");
    }
    return product;
  }

  private async requireCategory(id: string): Promise<Category> {
    const category = await this.categories.findById(id);
    if (!category) throw new BadRequestException("Category does not exist");
    return category;
  }

  private toResponse(product: Product, category: Category | null): ProductWithCategory {
    return {
      id: product.id,
      sellerId: product.sellerId,
      categoryId: product.categoryId,
      name: product.name,
      slug: product.slug,
      description: product.description,
      price: product.price,
      stock: product.stock,
      imageUrl: product.imageUrl,
      createdAt: product.createdAt,
      updatedAt: product.updatedAt,
      category: category
        ? { id: category.id, name: category.name, slug: category.slug }
        : null,
    };
  }
}

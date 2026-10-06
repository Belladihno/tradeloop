import { Injectable } from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { In, IsNull, Repository, type QueryRunner } from "typeorm";
import type { ProductSort } from "@tradeloop/types";
import { InsufficientStockException } from "../common/exceptions/insufficient-stock.exception";
import { uniqueSlug } from "../common/utils/slug";
import { Product } from "./entities/product.entity";
import { decodeCursor, encodeCursor, InvalidCursorException, type ProductCursor } from "./cursor";

export interface ProductListFilters {
  q?: string;
  categoryId?: string;
  sellerId?: string;
  minPrice?: string;
  maxPrice?: string;
  inStockOnly?: boolean;
  sort: ProductSort;
  cursor?: string;
  limit: number;
}

export interface ProductListPage {
  items: Product[];
  nextCursor: string | null;
}

@Injectable()
export class ProductsRepository {
  constructor(
    @InjectRepository(Product) private readonly products: Repository<Product>,
  ) {}

  create(data: Omit<Partial<Product>, "slug"> & { name: string }): Promise<Product> {
    const entity = this.products.create(data);
    entity.slug = uniqueSlug(entity.name, entity.id);
    return this.products.save(entity);
  }

  findById(id: string): Promise<Product | null> {
    return this.products.findOne({ where: { id, deletedAt: IsNull() } });
  }

  findBySlug(slug: string): Promise<Product | null> {
    return this.products.findOne({ where: { slug, deletedAt: IsNull() } });
  }

  async findByIds(ids: string[]): Promise<Product[]> {
    if (ids.length === 0) return [];
    return this.products.find({ where: { id: In(ids), deletedAt: IsNull() } });
  }

  async updateFields(id: string, data: Partial<Product>): Promise<void> {
    await this.products.update({ id }, data);
  }

  async softDelete(id: string): Promise<void> {
    await this.products.update({ id }, { deletedAt: new Date() });
  }

  countByCategory(categoryId: string): Promise<number> {
    return this.products.count({ where: { categoryId, deletedAt: IsNull() } });
  }

  async decrementStock(
    productId: string,
    quantity: number,
    runner: QueryRunner,
  ): Promise<void> {
    const [records, affected] = (await runner.query(
      `UPDATE "products" SET "stock" = "stock" - $1, "updated_at" = now()
       WHERE "id" = $2 AND "stock" >= $1 AND "deleted_at" IS NULL RETURNING "id"`,
      [quantity, productId],
    )) as [{ id: string }[], number];
    if (affected === 0 || records.length === 0) throw new InsufficientStockException();
  }

  async restoreStock(
    productId: string,
    quantity: number,
    runner: QueryRunner,
  ): Promise<void> {
    await runner.query(
      `UPDATE "products" SET "stock" = "stock" + $1, "updated_at" = now()
       WHERE "id" = $2`,
      [quantity, productId],
    );
  }

  async listPage(filters: ProductListFilters): Promise<ProductListPage> {
    const searching = filters.q !== undefined && filters.q.length > 0;
    const cursor = this.parseCursor(filters.cursor, searching ? "search" : filters.sort);

    const qb = this.products
      .createQueryBuilder("p")
      .where("p.deletedAt IS NULL");

    if (filters.categoryId) {
      qb.andWhere("p.categoryId = :categoryId", { categoryId: filters.categoryId });
    }
    if (filters.sellerId) {
      qb.andWhere("p.sellerId = :sellerId", { sellerId: filters.sellerId });
    }
    if (filters.minPrice !== undefined) {
      qb.andWhere("p.price >= :minPrice", { minPrice: filters.minPrice });
    }
    if (filters.maxPrice !== undefined) {
      qb.andWhere("p.price <= :maxPrice", { maxPrice: filters.maxPrice });
    }
    if (filters.inStockOnly) {
      qb.andWhere("p.stock > 0");
    }

    if (searching) {
      qb.andWhere(`p.searchVector @@ plainto_tsquery('english', :q)`, {
        q: filters.q,
      });
      qb.addSelect(
        `ts_rank(p.searchVector, plainto_tsquery('english', :q))`,
        "rank",
      );
      qb.orderBy(`ts_rank(p.searchVector, plainto_tsquery('english', :q))`, "DESC");
      qb.addOrderBy("p.id", "DESC");
      if (cursor) {
        qb.andWhere(
          `(ts_rank(p.searchVector, plainto_tsquery('english', :q)), p.id) < (:rank, :cursorId)`,
          { rank: cursor.rank ?? 0, cursorId: cursor.id },
        );
      }
    } else if (filters.sort === "price_asc") {
      qb.orderBy("p.price", "ASC").addOrderBy("p.id", "ASC");
      if (cursor) {
        qb.andWhere(`(p.price, p.id) > (:price, :cursorId)`, {
          price: cursor.price,
          cursorId: cursor.id,
        });
      }
    } else if (filters.sort === "price_desc") {
      qb.orderBy("p.price", "DESC").addOrderBy("p.id", "DESC");
      if (cursor) {
        qb.andWhere(`(p.price, p.id) < (:price, :cursorId)`, {
          price: cursor.price,
          cursorId: cursor.id,
        });
      }
    } else {
      qb.orderBy("p.id", "DESC");
      if (cursor) {
        qb.andWhere("p.id < :cursorId", { cursorId: cursor.id });
      }
    }

    const { entities, raw } = await qb.take(filters.limit + 1).getRawAndEntities();
    const hasMore = entities.length > filters.limit;
    const items = hasMore ? entities.slice(0, filters.limit) : entities;
    if (items.length === 0) return { items, nextCursor: null };

    const last = items[items.length - 1];
    let next: ProductCursor;
    if (searching) {
      const rank = Number(raw[items.length - 1]?.rank ?? 0);
      next = { sort: "search", rank, id: last.id };
    } else if (filters.sort === "newest") {
      next = { sort: filters.sort, id: last.id };
    } else {
      next = { sort: filters.sort, price: last.price, id: last.id };
    }
    return { items, nextCursor: hasMore ? encodeCursor(next) : null };
  }

  private parseCursor(raw: string | undefined, sort: ProductCursor["sort"]): ProductCursor | null {
    if (!raw) return null;
    const cursor = decodeCursor(raw);
    if (cursor.sort !== sort) throw new InvalidCursorException();
    return cursor;
  }
}

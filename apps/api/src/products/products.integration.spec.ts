import Redis from "ioredis";
import { startTestDatabase, type TestDatabase } from "../test/test-database";
import type { NestFastifyApplication } from "@nestjs/platform-fastify";
import { FastifyAdapter } from "@nestjs/platform-fastify";
import { ThrottlerStorage } from "@nestjs/throttler";
import { inertThrottlerStorage } from "../test/no-throttle";
import { Test } from "@nestjs/testing";
import { ZodValidationPipe } from "nestjs-zod";
import { DataSource } from "typeorm";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { UserRole } from "@tradeloop/types";
import { AppModule } from "../app.module";
import { CategoriesService } from "../categories/categories.service";
import { SnakeNamingStrategy } from "../common/database/snake-naming.strategy";
import { InsufficientStockException } from "../common/exceptions/insufficient-stock.exception";
import { SanitizePipe } from "../common/pipes/sanitize.pipe";
import { User } from "../users/entities/user.entity";
import { UsersService } from "../users/users.service";
import { Init1759400000000 } from "../migrations/1759400000000-Init";
import { CreateUsers1759500000000 } from "../migrations/1759500000000-CreateUsers";
import { ConfigService } from "@nestjs/config";
import { REDIS_CLIENT } from "../redis/redis.module";
import { Category } from "../categories/entities/category.entity";
import { Product } from "./entities/product.entity";
import { ProductsRepository } from "./products.repository";
import { ProductsService } from "./products.service";
import { SellerProfilesService } from "../seller-profiles/seller-profiles.service";

vi.setConfig({ testTimeout: 120_000, hookTimeout: 180_000 });

let app: NestFastifyApplication | undefined;
let container: TestDatabase | undefined;
let dataSource: DataSource | undefined;
let products: ProductsService;
let categories: CategoriesService;
let users: UsersService;
let repository: ProductsRepository;
let sellerId = "";

const redisClient = new Redis(
  process.env.REDIS_URL ?? "redis://localhost:16379",
  { maxRetriesPerRequest: 5 },
);

beforeAll(async () => {
  container = await startTestDatabase();
  process.env.DATABASE_URL = container.getConnectionUri();
  process.env.JWT_SECRET = "integration-test-secret-minimum-32-chars";
  process.env.JWT_ACCESS_EXPIRY = "15m";
  process.env.JWT_REFRESH_EXPIRY = "7d";

  const { Wallets1759600000000 } = await import("../migrations/1759600000000-Wallets");
  const { Categories1759700000000 } = await import("../migrations/1759700000000-Categories");
  const { Products1759800000000 } = await import("../migrations/1759800000000-Products");
  const { SellerProfiles1759900000000 } = await import("../migrations/1759900000000-SellerProfiles");
  const { BuyerProfiles1759910000000 } = await import("../migrations/1759910000000-BuyerProfiles");
  const { Carts1760000000000 } = await import("../migrations/1760000000000-Carts");
  const { Orders1760010000000 } = await import("../migrations/1760010000000-Orders");
  const { IdempotencyKeys1760020000000 } = await import("../migrations/1760020000000-IdempotencyKeys");
  const { Discounts1760100000000 } = await import("../migrations/1760100000000-Discounts");
  const { Disputes1760200000000 } = await import("../migrations/1760200000000-Disputes");
  const { Payouts1760300000000 } = await import("../migrations/1760300000000-Payouts");
  const { Notifications1760400000000 } = await import("../migrations/1760400000000-Notifications");
  const { Shipments1760500000000 } = await import("../migrations/1760500000000-Shipments");
  const { SellerWebhooks1760600000000 } = await import("../migrations/1760600000000-SellerWebhooks");
  const { WebhookDeliveries1760600000001 } = await import("../migrations/1760600000001-WebhookDeliveries");

  dataSource = new DataSource({
    type: "postgres",
    url: container.getConnectionUri(),
    entities: [User, Category, Product],
    migrations: [
      Init1759400000000,
      CreateUsers1759500000000,
      Wallets1759600000000,
      Categories1759700000000,
      Products1759800000000,
      SellerProfiles1759900000000,
      BuyerProfiles1759910000000,
      Carts1760000000000,
      Orders1760010000000,
      IdempotencyKeys1760020000000,
      Discounts1760100000000,
      Disputes1760200000000,
      Payouts1760300000000,
      Notifications1760400000000,
      Shipments1760500000000,
      SellerWebhooks1760600000000,
      WebhookDeliveries1760600000001,
    ],
    namingStrategy: new SnakeNamingStrategy(),
    synchronize: false,
  });
  await dataSource.initialize();
  await dataSource.runMigrations();

  const moduleRef = await Test.createTestingModule({ imports: [AppModule] })
    .overrideProvider(REDIS_CLIENT)
    .useValue(redisClient)
    .overrideProvider(ConfigService)
    .useValue({ get: (key: string) => process.env[key] })
    .overrideProvider(ThrottlerStorage)
    .useValue(inertThrottlerStorage)
    .compile();

  app = moduleRef.createNestApplication<NestFastifyApplication>(
    new FastifyAdapter(),
  );
  app.setGlobalPrefix("api/v1");
  app.useGlobalPipes(new ZodValidationPipe(), new SanitizePipe());
  await app.init();
  await app.getHttpAdapter().getInstance().ready();

  products = moduleRef.get(ProductsService);
  categories = moduleRef.get(CategoriesService);
  users = moduleRef.get(UsersService);
  repository = moduleRef.get(ProductsRepository);

  const seller = await users.create({
    email: "seller@tradeloop.test",
    passwordHash: "hashed",
    role: UserRole.BUYER,
  });
  const profiles = moduleRef.get(SellerProfilesService);
  const profile = await profiles.onboard(seller.id, {
    storeName: "Catalog Store",
    bankAccountNumber: "0123456789",
    bankCode: "058",
  });
  await profiles.review(profile.id);
  await profiles.approve(profile.id);
  sellerId = seller.id;
});

afterAll(async () => {
  await app?.close();
  await dataSource?.destroy();
  await redisClient.quit().catch(() => undefined);
  await container?.stop();
});

function client() {
  if (!app) throw new Error("App not initialized");
  return app.inject.bind(app);
}

describe("catalog", () => {
  let fabricsId = "";

  it("creates categories and nests the tree", async () => {
    const root = await categories.create({ name: "Fashion" });
    const child = await categories.create({ name: "Fabrics", parentId: root.id });
    fabricsId = child.id;

    const tree = await categories.listTree();
    const fashion = tree.find((node) => node.slug === "fashion");
    expect(fashion?.children.map((node) => node.slug)).toEqual(["fabrics"]);
  });

  it("finds products through full-text search", async () => {
    await products.create(sellerId, UserRole.SELLER, {
      name: "Ankara Cotton Fabric",
      description: "Vibrant woven cotton for traditional wear",
      price: "2500.00",
      categoryId: fabricsId,
      stock: 10,
    });

    const res = await client()({
      method: "GET",
      url: "/api/v1/products?q=ankara cotton",
    });

    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.success).toBe(true);
    expect(body.data.items.length).toBeGreaterThan(0);
    expect(body.data.items[0].name).toContain("Ankara");
    expect(body.data.items[0].category.slug).toBe("fabrics");
  });

  it("filters by price range and stock", async () => {
    await products.create(sellerId, UserRole.SELLER, {
      name: "Aso Oke Prestige",
      description: "Hand-woven ceremonial cloth",
      price: "15000.00",
      categoryId: fabricsId,
      stock: 0,
    });

    const inBudget = await client()({
      method: "GET",
      url: "/api/v1/products?minPrice=1000&maxPrice=5000",
    });
    const prices = inBudget.json().data.items.map((item: { price: string }) =>
      Number(item.price),
    ) as number[];
    expect(prices.length).toBeGreaterThan(0);
    expect(prices.every((price) => price >= 1000 && price <= 5000)).toBe(true);
    expect(prices).not.toContain(15000);

    const inStock = await client()({
      method: "GET",
      url: "/api/v1/products?inStock=true&limit=100",
    });
    expect(
      inStock.json().data.items.every((item: { stock: number }) => item.stock > 0),
    ).toBe(true);
  });

  it("pages cursors without duplicates or gaps", async () => {
    for (let index = 0; index < 25; index++) {
      await products.create(sellerId, UserRole.SELLER, {
        name: `Paged Cloth ${index}`,
        description: "Bulk listing",
        price: `${1000 + index}.00`,
        categoryId: fabricsId,
        stock: 5,
      });
    }

    const seen = new Set<string>();
    let cursor: string | null | undefined;
    let pages = 0;
    do {
      const params = new URLSearchParams({ limit: "10", sort: "newest" });
      if (cursor) params.set("cursor", cursor);
      const res = await client()({ method: "GET", url: `/api/v1/products?${params}` });
      expect(res.statusCode).toBe(200);
      const body = res.json().data as { items: { id: string }[]; nextCursor: string | null };
      for (const item of body.items) {
        expect(seen.has(item.id)).toBe(false);
        seen.add(item.id);
      }
      cursor = body.nextCursor;
      pages += 1;
    } while (cursor && pages < 10);

    expect(seen.size).toBeGreaterThanOrEqual(27);
    expect(cursor).toBeNull();
  });

  it("rejects malformed cursors with a 400 envelope", async () => {
    const res = await client()({
      method: "GET",
      url: "/api/v1/products?cursor=!!!",
    });

    expect(res.statusCode).toBe(400);
    expect(res.json().success).toBe(false);
    expect(res.json().error).toBe("INVALID_CURSOR");
  });

  it("lets only one buyer take the last unit", async () => {
    const product = await products.create(sellerId, UserRole.SELLER, {
      name: "Last Piece Shirt",
      description: "One unit only",
      price: "5000.00",
      categoryId: fabricsId,
      stock: 1,
    });

    if (!dataSource) throw new Error("DataSource not initialized");
    const ds = dataSource;
    const attempt = async (): Promise<void> => {
      const runner = ds.createQueryRunner();
      await runner.connect();
      await runner.startTransaction();
      try {
        await repository.decrementStock(product.id, 1, runner);
        await runner.commitTransaction();
      } catch (error) {
        await runner.rollbackTransaction();
        throw error;
      } finally {
        await runner.release();
      }
    };

    const [first, second] = await Promise.allSettled([attempt(), attempt()]);
    expect([first.status, second.status].sort()).toEqual(["fulfilled", "rejected"]);
    const rejected = [first, second].find((r) => r.status === "rejected") as PromiseRejectedResult;
    expect(rejected.reason).toBeInstanceOf(InsufficientStockException);
  });

  it("hides soft-deleted products from listing and detail", async () => {
    const product = await products.create(sellerId, UserRole.SELLER, {
      name: "Vanishing Vase",
      description: "Here today",
      price: "3000.00",
      categoryId: fabricsId,
      stock: 2,
    });
    await products.remove(sellerId, UserRole.SELLER, product.id);

    const listing = await client()({
      method: "GET",
      url: `/api/v1/products?q=vanishing&limit=100`,
    });
    expect(
      listing.json().data.items.some((item: { id: string }) => item.id === product.id),
    ).toBe(false);

    const detail = await client()({
      method: "GET",
      url: `/api/v1/products/${product.slug}`,
    });
    expect(detail.statusCode).toBe(404);
  });
});

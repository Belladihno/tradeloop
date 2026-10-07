import Redis from "ioredis";
import { startTestDatabase, type TestDatabase } from "../test/test-database";
import type { NestFastifyApplication } from "@nestjs/platform-fastify";
import { FastifyAdapter } from "@nestjs/platform-fastify";
import { ThrottlerGuard } from "@nestjs/throttler";
import { Test } from "@nestjs/testing";
import { hash } from "argon2";
import { createHmac } from "crypto";
import { ZodValidationPipe } from "nestjs-zod";
import { DataSource } from "typeorm";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { DiscountScope, DiscountType, OrderStatus, UserRole } from "@tradeloop/types";
import { AppModule } from "../app.module";
import { SnakeNamingStrategy } from "../common/database/snake-naming.strategy";
import { SanitizePipe } from "../common/pipes/sanitize.pipe";
import { User } from "../users/entities/user.entity";
import { Init1759400000000 } from "../migrations/1759400000000-Init";
import { CreateUsers1759500000000 } from "../migrations/1759500000000-CreateUsers";
import { ConfigService } from "@nestjs/config";
import { REDIS_CLIENT } from "../redis/redis.module";
import { Wallet } from "../wallet/entities/wallet.entity";
import { Transaction } from "../wallet/entities/transaction.entity";
import { Category } from "../categories/entities/category.entity";
import { Product } from "../products/entities/product.entity";
import { SellerProfile } from "../seller-profiles/entities/seller-profile.entity";
import { BuyerProfile } from "../buyer-profiles/entities/buyer-profile.entity";
import { Cart } from "../cart/entities/cart.entity";
import { CartItem } from "../cart/entities/cart-item.entity";
import { Order } from "../orders/entities/order.entity";
import { OrderItem } from "../orders/entities/order-item.entity";
import { IdempotencyKey } from "../idempotency/entities/idempotency-key.entity";
import { Discount } from "./entities/discount.entity";
import { DiscountRedemption } from "./entities/discount-redemption.entity";

vi.setConfig({ testTimeout: 120_000, hookTimeout: 180_000 });

const PAYSTACK_TEST_SECRET = "paystack-test-webhook-secret";

let app: NestFastifyApplication | undefined;
let container: TestDatabase | undefined;
let dataSource: DataSource | undefined;

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
  process.env.PAYSTACK_SECRET_KEY = PAYSTACK_TEST_SECRET;
  process.env.PAYMENT_PROVIDER = "paystack";

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
    entities: [
      User, Wallet, Transaction, Category, Product, SellerProfile, BuyerProfile,
      Cart, CartItem, Order, OrderItem, IdempotencyKey, Discount, DiscountRedemption,
    ],
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

  vi.stubGlobal(
    "fetch",
    vi.fn(async (url: string, init?: { body?: string }) => {
      const body = JSON.parse(init?.body ?? "{}") as { reference?: string };
      return {
        ok: true,
        json: async () => ({
          status: true,
          data: {
            authorization_url: "https://paystack.test/pay/checkout",
            reference: body.reference,
          },
        }),
      };
    }),
  );

  const moduleRef = await Test.createTestingModule({ imports: [AppModule] })
    .overrideProvider(REDIS_CLIENT)
    .useValue(redisClient)
    .overrideProvider(ConfigService)
    .useValue({ get: (key: string) => process.env[key] })
    .overrideGuard(ThrottlerGuard)
    .useValue({ canActivate: () => true })
    .compile();

  app = moduleRef.createNestApplication<NestFastifyApplication>(
    new FastifyAdapter(),
    { rawBody: true },
  );
  app.setGlobalPrefix("api/v1");
  app.useGlobalPipes(new ZodValidationPipe(), new SanitizePipe());
  await app.init();
  await app.getHttpAdapter().getInstance().ready();

  if (!dataSource) throw new Error("DataSource not initialized");
  const userRepository = dataSource.getRepository(User);
  const admin = userRepository.create({
    email: "admin@tradeloop.test",
    role: UserRole.ADMIN,
  });
  admin.passwordHash = await hash("admin-password");
  await userRepository.save(admin);
});

afterAll(async () => {
  vi.unstubAllGlobals();
  await app?.close();
  await dataSource?.destroy();
  await redisClient.quit().catch(() => undefined);
  await container?.stop();
});

function client() {
  if (!app) throw new Error("App not initialized");
  return app.inject.bind(app);
}

const ADDRESS = { line1: "1 Adeola St", city: "Lagos", country: "NG" };

async function register(email: string, role: "BUYER" | "SELLER" = "BUYER"): Promise<string> {
  const res = await client()({
    method: "POST",
    url: "/api/v1/auth/register",
    payload: { email, password: "password123", role },
  });
  if (res.statusCode !== 201) throw new Error(`Register failed for ${email}`);
  return res.json().data.accessToken as string;
}
async function buyerIdOf(token: string): Promise<string> {
  const res = await client()({
    method: "GET",
    url: "/api/v1/users/me",
    headers: { authorization: `Bearer ${token}` },
  });
  return res.json().data.id as string;
}

async function login(email: string, password: string): Promise<string> {
  const res = await client()({
    method: "POST",
    url: "/api/v1/auth/login",
    payload: { email, password },
  });
  if (res.statusCode !== 200) throw new Error(`Login failed for ${email}`);
  return res.json().data.accessToken as string;
}

async function fundWallet(token: string, amount: string): Promise<void> {
  const funded = await client()({
    method: "POST",
    url: "/api/v1/wallet/fund",
    headers: { authorization: `Bearer ${token}` },
    payload: { amount },
  });
  if (funded.statusCode !== 201) throw new Error("Funding failed");
  const reference = funded.json().data.reference as string;
  const rawBody = JSON.stringify({
    event: "charge.success",
    data: { reference, amount: Math.round(Number(amount) * 100) },
  });
  const delivered = await client()({
    method: "POST",
    url: "/api/v1/webhooks/paystack",
    headers: {
      "x-paystack-signature": createHmac("sha512", PAYSTACK_TEST_SECRET)
        .update(rawBody)
        .digest("hex"),
    },
    payload: JSON.parse(rawBody) as Record<string, unknown>,
  });
  if (delivered.statusCode !== 200) throw new Error("Webhook failed");
}

describe("discounts", () => {
  let adminToken = "";
  let sellerToken = "";
  let sellerId = "";
  let buyerToken = "";
  let categoryId = "";
  let productId = "";

  it("prepares an approved seller, category, product, and funded buyer", async () => {
    adminToken = await login("admin@tradeloop.test", "admin-password");

    sellerToken = await register("seller@tradeloop.test");
    sellerId = await buyerIdOf(sellerToken);
    const onboarded = await client()({
      method: "POST",
      url: "/api/v1/seller/onboard",
      headers: { authorization: `Bearer ${sellerToken}` },
      payload: { storeName: "Discount Store", bankAccountNumber: "0123456789", bankCode: "058" },
    });
    expect(onboarded.statusCode).toBe(201);
    const profileId = onboarded.json().data.id as string;
    const adminAuth = { authorization: `Bearer ${adminToken}` };
    await client()({
      method: "PATCH",
      url: `/api/v1/admin/sellers/${profileId}/review`,
      headers: adminAuth,
    });
    const approved = await client()({
      method: "PATCH",
      url: `/api/v1/admin/sellers/${profileId}/approve`,
      headers: adminAuth,
    });
    expect(approved.statusCode).toBe(200);
    sellerToken = await login("seller@tradeloop.test", "password123");

    buyerToken = await register("buyer@tradeloop.test");
    await fundWallet(buyerToken, "50000.00");

    const category = await client()({
      method: "POST",
      url: "/api/v1/categories",
      headers: adminAuth,
      payload: { name: "Fabrics" },
    });
    expect(category.statusCode).toBe(201);
    categoryId = category.json().data.id as string;

    const made = await client()({
      method: "POST",
      url: "/api/v1/products",
      headers: { authorization: `Bearer ${sellerToken}` },
      payload: { name: "Ankara Fabric", price: "2500.00", categoryId, stock: 10 },
    });
    expect(made.statusCode).toBe(201);
    productId = made.json().data.id as string;
  });

  it("lets sellers create store discounts but not platform ones", async () => {
    const created = await client()({
      method: "POST",
      url: "/api/v1/discounts",
      headers: { authorization: `Bearer ${sellerToken}` },
      payload: {
        code: "SAVE10",
        type: DiscountType.PERCENTAGE,
        value: "10.00",
        scope: DiscountScope.SELLER,
        scopeId: sellerId,
        maxUsageCount: 100,
      },
    });
    expect(created.statusCode).toBe(201);
    expect(created.json().data.scopeId).toBe(sellerId);

    const platform = await client()({
      method: "POST",
      url: "/api/v1/discounts",
      headers: { authorization: `Bearer ${sellerToken}` },
      payload: { type: DiscountType.FLAT_AMOUNT, value: "500.00", scope: DiscountScope.PLATFORM },
    });
    expect(platform.statusCode).toBe(403);
  });

  it("applies codes before escrow hold and records redemptions", async () => {
    const checkout = await client()({
      method: "POST",
      url: "/api/v1/orders",
      headers: { authorization: `Bearer ${buyerToken}` },
      payload: {
        items: [{ productId, quantity: 2 }],
        shippingAddress: ADDRESS,
        discountCode: "SAVE10",
      },
    });

    expect(checkout.statusCode).toBe(201);
    const [order] = checkout.json().data.orders as {
      totalAmount: string;
      discountedAmount: string;
      discountId: string;
      status: string;
    }[];
    expect(order.totalAmount).toBe("4500.00");
    expect(order.discountedAmount).toBe("500.00");
    expect(order.status).toBe(OrderStatus.PENDING);

    const balance = await client()({
      method: "GET",
      url: "/api/v1/wallet/balance",
      headers: { authorization: `Bearer ${buyerToken}` },
    });
    expect(balance.json().data.balance).toBe("45500.00");

    if (!dataSource) throw new Error("DataSource not initialized");
    const redemption = await dataSource.getRepository(DiscountRedemption).findOneOrFail({
      where: { discountId: order.discountId },
    });
    expect(redemption.amountDeducted).toBe("500.00");
    expect(redemption.ipAddress).toBeTruthy();
  });

  it("grants the last use to exactly one of two concurrent buyers", async () => {
    const limited = await client()({
      method: "POST",
      url: "/api/v1/discounts",
      headers: { authorization: `Bearer ${sellerToken}` },
      payload: {
        code: "ONCEONLY",
        type: DiscountType.PERCENTAGE,
        value: "50.00",
        scope: DiscountScope.SELLER,
        scopeId: sellerId,
        maxUsageCount: 1,
      },
    });
    expect(limited.statusCode).toBe(201);

    const secondToken = await register("buyer-two@tradeloop.test");
    await fundWallet(secondToken, "50000.00");
    const payload = {
      items: [{ productId, quantity: 1 }],
      shippingAddress: ADDRESS,
      discountCode: "ONCEONLY",
    };

    const [first, second] = await Promise.all([
      client()({
        method: "POST",
        url: "/api/v1/orders",
        headers: { authorization: `Bearer ${buyerToken}` },
        payload,
      }),
      client()({
        method: "POST",
        url: "/api/v1/orders",
        headers: { authorization: `Bearer ${secondToken}` },
        payload,
      }),
    ]);

    const codes = [first.statusCode, second.statusCode].sort();
    expect(codes).toEqual([201, 400]);
    const failed = first.statusCode === 409 ? first : second;
    expect(failed.json().error).toBe("DISCOUNT_REJECTED");
  });

  it("rejects expired codes", async () => {
    if (!dataSource) throw new Error("DataSource not initialized");
    const expired = dataSource.getRepository(Discount).create({
      code: "OLDDEAL",
      type: DiscountType.PERCENTAGE,
      value: "20.00",
      scope: DiscountScope.PLATFORM,
      scopeId: null,
      createdBy: sellerId,
      usageCount: 0,
      isActive: true,
      startsAt: new Date(Date.now() - 7200_000),
      expiresAt: new Date(Date.now() - 3600_000),
    });
    await dataSource.getRepository(Discount).save(expired);

    const res = await client()({
      method: "POST",
      url: "/api/v1/orders",
      headers: { authorization: `Bearer ${buyerToken}` },
      payload: {
        items: [{ productId, quantity: 1 }],
        shippingAddress: ADDRESS,
        discountCode: "OLDDEAL",
      },
    });

    expect(res.statusCode).toBe(400);
    expect(res.json().error).toBe("DISCOUNT_REJECTED");
  });

  it("auto-applies the best automatic discount without a code", async () => {
    const created = await client()({
      method: "POST",
      url: "/api/v1/discounts",
      headers: { authorization: `Bearer ${sellerToken}` },
      payload: {
        type: DiscountType.FLAT_AMOUNT,
        value: "200.00",
        scope: DiscountScope.SELLER,
        scopeId: sellerId,
      },
    });
    expect(created.statusCode).toBe(201);

    const checkout = await client()({
      method: "POST",
      url: "/api/v1/orders",
      headers: { authorization: `Bearer ${buyerToken}` },
      payload: { items: [{ productId, quantity: 1 }], shippingAddress: ADDRESS },
    });

    expect(checkout.statusCode).toBe(201);
    expect(checkout.json().data.orders[0].totalAmount).toBe("2300.00");
  });
});

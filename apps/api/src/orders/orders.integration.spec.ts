import Redis from "ioredis";
import { startTestDatabase, type TestDatabase } from "../test/test-database";
import { WebhookDelivery } from "../webhooks/outbound/entities/webhook-delivery.entity";import type { NestFastifyApplication } from "@nestjs/platform-fastify";
import { FastifyAdapter } from "@nestjs/platform-fastify";
import { ThrottlerStorage } from "@nestjs/throttler";
import { inertThrottlerStorage } from "../test/no-throttle";
import { Test } from "@nestjs/testing";
import { hash } from "argon2";
import { createHmac } from "crypto";
import { ZodValidationPipe } from "nestjs-zod";
import { DataSource } from "typeorm";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { OrderStatus, UserRole } from "@tradeloop/types";
import { AppModule } from "../app.module";
import { SnakeNamingStrategy } from "../common/database/snake-naming.strategy";
import { SanitizePipe } from "../common/pipes/sanitize.pipe";
import { User } from "../users/entities/user.entity";
import { UsersService } from "../users/users.service";
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
import { Order } from "./entities/order.entity";
import { OrderItem } from "./entities/order-item.entity";
import { IdempotencyKey } from "../idempotency/entities/idempotency-key.entity";

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
      Cart, CartItem, Order, OrderItem, IdempotencyKey, WebhookDelivery,
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
    .overrideProvider(ThrottlerStorage)
    .useValue(inertThrottlerStorage)
    .compile();

  app = moduleRef.createNestApplication<NestFastifyApplication>(
    new FastifyAdapter(),
    { rawBody: true },
  );
  app.setGlobalPrefix("api/v1");
  app.useGlobalPipes(new ZodValidationPipe(), new SanitizePipe());
  await app.init();
  await app.getHttpAdapter().getInstance().ready();

  const users = moduleRef.get(UsersService);
  await users.create({
    email: "admin@tradeloop.test",
    passwordHash: await hash("admin-password"),
    role: UserRole.ADMIN,
  });
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

async function login(email: string, password: string): Promise<string> {
  const res = await client()({
    method: "POST",
    url: "/api/v1/auth/login",
    payload: { email, password },
  });
  if (res.statusCode !== 200) throw new Error(`Login failed for ${email}`);
  return res.json().data.accessToken as string;
}

async function onboardSeller(
  email: string,
  storeName: string,
  adminToken: string,
): Promise<{ token: string; profileId: string }> {
  const password = "password123";
  const registered = await client()({
    method: "POST",
    url: "/api/v1/auth/register",
    payload: { email, password, role: "BUYER" },
  });
  if (registered.statusCode !== 201) throw new Error(`Register failed for ${email}`);
  const token = registered.json().data.accessToken as string;
  const onboarded = await client()({
    method: "POST",
    url: "/api/v1/seller/onboard",
    headers: { authorization: `Bearer ${token}` },
    payload: {
      storeName,
      bankAccountNumber: "0123456789",
      bankCode: "058",
      webhookUrl: "https://seller.test/hooks",
      webhookSecret: "supersecretvalue123",
    },
  });
  if (onboarded.statusCode !== 201) throw new Error(`Onboard failed for ${email}`);
  const profileId = onboarded.json().data.id as string;
  const auth = { authorization: `Bearer ${adminToken}` };
  await client()({ method: "PATCH", url: `/api/v1/admin/sellers/${profileId}/review`, headers: auth });
  const approved = await client()({
    method: "PATCH",
    url: `/api/v1/admin/sellers/${profileId}/approve`,
    headers: auth,
  });
  if (approved.statusCode !== 200) throw new Error(`Approve failed for ${email}`);
  const fresh = await login(email, password);
  return { token: fresh, profileId };
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
  const amountKobo = Math.round(Number(amount) * 100);
  const rawBody = JSON.stringify({
    event: "charge.success",
    data: { reference, amount: amountKobo },
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

describe("orders", () => {
  let adminToken = "";
  let sellerOne = "";
  let sellerTwo = "";
  let buyerToken = "";
  let categoryId = "";
  let productOne = "";
  let productTwo = "";
  let firstOrderId = "";

  it("prepares sellers, category, products, and a funded buyer", async () => {
    adminToken = await login("admin@tradeloop.test", "admin-password");
    sellerOne = (await onboardSeller("seller-one@tradeloop.test", "Store One", adminToken)).token;
    sellerTwo = (await onboardSeller("seller-two@tradeloop.test", "Store Two", adminToken)).token;

    const category = await client()({
      method: "POST",
      url: "/api/v1/categories",
      headers: { authorization: `Bearer ${adminToken}` },
      payload: { name: "Fabrics" },
    });
    expect(category.statusCode).toBe(201);
    categoryId = category.json().data.id as string;

    const makeProduct = async (token: string, name: string, price: string, stock: number) => {
      const res = await client()({
        method: "POST",
        url: "/api/v1/products",
        headers: { authorization: `Bearer ${token}` },
        payload: { name, price, categoryId, stock },
      });
      expect(res.statusCode).toBe(201);
      return res.json().data.id as string;
    };
    productOne = await makeProduct(sellerOne, "Ankara Fabric", "2500.00", 10);
    productTwo = await makeProduct(sellerTwo, "Aso Oke Cloth", "15000.00", 5);

    const registered = await client()({
      method: "POST",
      url: "/api/v1/auth/register",
      payload: { email: "buyer@tradeloop.test", password: "password123", role: "BUYER" },
    });
    expect(registered.statusCode).toBe(201);
    buyerToken = registered.json().data.accessToken as string;
    await fundWallet(buyerToken, "50000.00");
  });

  it("checks out the cart into one escrow-held order per seller", async () => {
    const auth = { authorization: `Bearer ${buyerToken}` };
    await client()({
      method: "POST",
      url: "/api/v1/cart/items",
      headers: auth,
      payload: { productId: productOne, quantity: 2 },
    });
    await client()({
      method: "POST",
      url: "/api/v1/cart/items",
      headers: auth,
      payload: { productId: productTwo, quantity: 1 },
    });

    const checkout = await client()({
      method: "POST",
      url: "/api/v1/orders/from-cart",
      headers: { ...auth, "idempotency-key": "checkout-1" },
      payload: { shippingAddress: { line1: "1 Adeola St", city: "Lagos", country: "NG" } },
    });

    expect(checkout.statusCode).toBe(201);
    const orders = checkout.json().data.orders as { id: string; sellerId: string; totalAmount: string; status: string }[];
    expect(orders).toHaveLength(2);
    expect(orders.every((order) => order.status === OrderStatus.PENDING)).toBe(true);
    const totals = orders.map((order) => order.totalAmount).sort();
    expect(totals).toEqual(["15000.00", "5000.00"]);
    firstOrderId = orders[0].id;

    const balance = await client()({ method: "GET", url: "/api/v1/wallet/balance", headers: auth });
    expect(balance.json().data.balance).toBe("30000.00");

    const cart = await client()({ method: "GET", url: "/api/v1/cart", headers: auth });
    expect(cart.json().data.items).toHaveLength(0);
  });

  it("replays idempotent checkouts without duplicating orders", async () => {
    const auth = { authorization: `Bearer ${buyerToken}` };
    const replay = await client()({
      method: "POST",
      url: "/api/v1/orders",
      headers: { ...auth, "idempotency-key": "checkout-1" },
      payload: {
        items: [{ productId: productOne, quantity: 2 }],
        shippingAddress: { line1: "1 Adeola St", city: "Lagos", country: "NG" },
      },
    });

    expect(replay.statusCode).toBe(201);
    expect(replay.json().data.orders).toHaveLength(2);

    const listing = await client()({ method: "GET", url: "/api/v1/orders", headers: auth });
    expect(listing.json().data).toHaveLength(2);
  });

  it("lets only one buyer take the last unit", async () => {
    const second = await client()({
      method: "POST",
      url: "/api/v1/auth/register",
      payload: { email: "buyer-two@tradeloop.test", password: "password123", role: "BUYER" },
    });
    const secondToken = second.json().data.accessToken as string;
    await fundWallet(secondToken, "50000.00");

    const solo = await client()({
      method: "POST",
      url: "/api/v1/products",
      headers: { authorization: `Bearer ${sellerOne}` },
      payload: { name: "Last Piece", price: "5000.00", categoryId, stock: 1 },
    });
    const soloId = solo.json().data.id as string;
    const address = { line1: "1 Adeola St", city: "Lagos", country: "NG" };

    const [first, secondResult] = await Promise.all([
      client()({
        method: "POST",
        url: "/api/v1/orders",
        headers: { authorization: `Bearer ${buyerToken}` },
        payload: { items: [{ productId: soloId, quantity: 1 }], shippingAddress: address },
      }),
      client()({
        method: "POST",
        url: "/api/v1/orders",
        headers: { authorization: `Bearer ${secondToken}` },
        payload: { items: [{ productId: soloId, quantity: 1 }], shippingAddress: address },
      }),
    ]);

    const codes = [first.statusCode, secondResult.statusCode].sort();
    expect(codes).toEqual([201, 409]);
    const failed = first.statusCode === 409 ? first : secondResult;
    expect(failed.json().error).toBe("INSUFFICIENT_STOCK");
  });

  it("walks confirm, ship, and deliver in order", async () => {
    const sellerAuth = { authorization: `Bearer ${sellerOne}` };
    const buyerAuth = { authorization: `Bearer ${buyerToken}` };

    const confirmed = await client()({
      method: "PATCH",
      url: `/api/v1/orders/${firstOrderId}/confirm`,
      headers: sellerAuth,
    });
    expect(confirmed.json().data.status).toBe(OrderStatus.CONFIRMED);

    const shipped = await client()({
      method: "PATCH",
      url: `/api/v1/orders/${firstOrderId}/ship`,
      headers: sellerAuth,
    });
    expect(shipped.json().data.status).toBe(OrderStatus.SHIPPED);

    const delivered = await client()({
      method: "PATCH",
      url: `/api/v1/orders/${firstOrderId}/deliver`,
      headers: buyerAuth,
    });
    expect(delivered.json().data.status).toBe(OrderStatus.DELIVERED);
  });

  it("rejects out-of-order transitions and wrong parties", async () => {
    const shipFirst = await client()({
      method: "PATCH",
      url: `/api/v1/orders/${firstOrderId}/ship`,
      headers: { authorization: `Bearer ${sellerTwo}` },
    });
    expect(shipFirst.statusCode).toBe(403);

    const doubleDeliver = await client()({
      method: "PATCH",
      url: `/api/v1/orders/${firstOrderId}/deliver`,
      headers: { authorization: `Bearer ${buyerToken}` },
    });
    expect(doubleDeliver.statusCode).toBe(409);
    expect(doubleDeliver.json().error).toBe("INVALID_STATE_TRANSITION");
  });

  it("cancels with escrow refund and stock restoration", async () => {
    const buyerAuth = { authorization: `Bearer ${buyerToken}` };
    const created = await client()({
      method: "POST",
      url: "/api/v1/orders",
      headers: buyerAuth,
      payload: {
        items: [{ productId: productOne, quantity: 1 }],
        shippingAddress: { line1: "1 Adeola St", city: "Lagos", country: "NG" },
      },
    });
    const orderId = created.json().data.orders[0].id as string;

    const before = await client()({ method: "GET", url: "/api/v1/wallet/balance", headers: buyerAuth });
    const cancelled = await client()({
      method: "PATCH",
      url: `/api/v1/orders/${orderId}/cancel`,
      headers: buyerAuth,
    });
    expect(cancelled.json().data.status).toBe(OrderStatus.CANCELLED);

    const after = await client()({ method: "GET", url: "/api/v1/wallet/balance", headers: buyerAuth });
    expect(Number(after.json().data.balance)).toBe(Number(before.json().data.balance) + 2500);

    const listing = await client()({
      method: "GET",
      url: "/api/v1/products?q=Ankara+Fabric&limit=100",
      headers: buyerAuth,
    });
    const restored = listing
      .json()
      .data.items.find((item: { id: string }) => item.id === productOne) as { stock: number };
    expect(restored.stock).toBe(8);
  });

  it("emits outbound webhook deliveries for the order lifecycle", async () => {
    if (!dataSource) throw new Error("DataSource not initialized");
    const rows = await dataSource.getRepository(WebhookDelivery).find();
    const events = rows
      .filter((row) => (row.payload as Record<string, unknown>).orderId === firstOrderId)
      .map((row) => row.eventType)
      .sort();
    expect(events).toEqual(["order.created", "order.delivered", "order.paid", "order.shipped"]);
  });
});

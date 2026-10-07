import Redis from "ioredis";
import { getQueueToken } from "@nestjs/bullmq";
import { ConfigService } from "@nestjs/config";
import type { NestFastifyApplication } from "@nestjs/platform-fastify";
import { FastifyAdapter } from "@nestjs/platform-fastify";
import { ThrottlerGuard } from "@nestjs/throttler";
import { Test } from "@nestjs/testing";
import { ZodValidationPipe } from "nestjs-zod";
import { DataSource } from "typeorm";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { ShipmentStatus, UserRole, WalletType } from "@tradeloop/types";
import { AppModule } from "../app.module";
import { SnakeNamingStrategy } from "../common/database/snake-naming.strategy";
import { SanitizePipe } from "../common/pipes/sanitize.pipe";
import { User } from "../users/entities/user.entity";
import { Init1759400000000 } from "../migrations/1759400000000-Init";
import { CreateUsers1759500000000 } from "../migrations/1759500000000-CreateUsers";
import { REDIS_CLIENT } from "../redis/redis.module";
import { Wallet } from "../wallet/entities/wallet.entity";
import { Transaction } from "../wallet/entities/transaction.entity";
import { WalletRepository } from "../wallet/wallet.repository";
import { Category } from "../categories/entities/category.entity";
import { Product } from "../products/entities/product.entity";
import { SellerProfile } from "../seller-profiles/entities/seller-profile.entity";
import { SellerProfilesService } from "../seller-profiles/seller-profiles.service";
import { BuyerProfile } from "../buyer-profiles/entities/buyer-profile.entity";
import { Cart } from "../cart/entities/cart.entity";
import { CartItem } from "../cart/entities/cart-item.entity";
import { Order } from "../orders/entities/order.entity";
import { OrderItem } from "../orders/entities/order-item.entity";
import { IdempotencyKey } from "../idempotency/entities/idempotency-key.entity";
import { Discount } from "../discounts/entities/discount.entity";
import { DiscountRedemption } from "../discounts/entities/discount-redemption.entity";
import { Dispute } from "../disputes/entities/dispute.entity";
import { PayoutRequest } from "../payouts/entities/payout-request.entity";
import { Notification } from "../notifications/entities/notification.entity";
import { Shipment } from "./entities/shipment.entity";
import { DisputesProcessor } from "../disputes/disputes.processor";
import { SettlementsProcessor } from "../settlement/settlements.processor";
import { PayoutsProcessor } from "../payouts/payouts.processor";
import { NotificationsProcessor } from "../notifications/notifications.processor";
import { startTestDatabase, type TestDatabase } from "../test/test-database";

vi.setConfig({ testTimeout: 120_000, hookTimeout: 180_000 });

let app: NestFastifyApplication | undefined;
let container: TestDatabase | undefined;
let dataSource: DataSource | undefined;
let wallets: WalletRepository;
let profiles: SellerProfilesService;

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
    entities: [
      User, Wallet, Transaction, Category, Product, SellerProfile, BuyerProfile,
      Cart, CartItem, Order, OrderItem, IdempotencyKey, Discount, DiscountRedemption, Dispute,
      PayoutRequest, Notification, Shipment,
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

  const moduleRef = await Test.createTestingModule({ imports: [AppModule] })
    .overrideProvider(REDIS_CLIENT)
    .useValue(redisClient)
    .overrideProvider(ConfigService)
    .useValue({ get: (key: string) => process.env[key] })
    .overrideProvider(SettlementsProcessor)
    .useValue({})
    .overrideProvider(DisputesProcessor)
    .useValue({})
    .overrideProvider(PayoutsProcessor)
    .useValue({})
    .overrideProvider(NotificationsProcessor)
    .useValue({})
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

  wallets = moduleRef.get(WalletRepository);
  profiles = moduleRef.get(SellerProfilesService);
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

const ADDRESS = { line1: "1 Adeola St", city: "Lagos", country: "NG" };
const SHIPMENT_INPUT = {
  pickupLga: "Ikeja",
  deliveryLga: "Lekki",
  weightKg: 2,
  recipientName: "Ada Buyer",
  recipientPhone: "08030000000",
  recipientAddress: "1 Adeola St, Lagos",
};

async function register(email: string, role: "BUYER" | "SELLER" = "BUYER"): Promise<string> {
  const res = await client()({
    method: "POST",
    url: "/api/v1/auth/register",
    payload: { email, password: "password123", role },
  });
  if (res.statusCode !== 201) throw new Error(`Register failed for ${email}`);
  return res.json().data.accessToken as string;
}

async function userIdOf(token: string): Promise<string> {
  const res = await client()({
    method: "GET",
    url: "/api/v1/users/me",
    headers: { authorization: `Bearer ${token}` },
  });
  return res.json().data.id as string;
}

async function fundBuyer(userId: string, amount: string): Promise<void> {
  if (!dataSource) throw new Error("DataSource not initialized");
  const buyerWallet = await wallets.findByUserAndType(userId, WalletType.BUYER);
  if (!buyerWallet) throw new Error("Buyer wallet missing");
  const runner = dataSource.createQueryRunner();
  await runner.connect();
  await runner.startTransaction();
  try {
    await wallets.creditAtomic(buyerWallet.id, amount, runner);
    await runner.commitTransaction();
  } catch (error) {
    await runner.rollbackTransaction();
    throw error;
  } finally {
    await runner.release();
  }
}

describe("logistics", () => {
  let sellerToken = "";
  let sellerId = "";
  let buyerToken = "";
  let buyerId = "";
  let productId = "";
  let orderId = "";
  let trackingNumber = "";

  it("prepares an approved seller, product, and funded buyer", async () => {
    sellerToken = await register("seller@tradeloop.test");
    sellerId = await userIdOf(sellerToken);
    const onboarded = await client()({
      method: "POST",
      url: "/api/v1/seller/onboard",
      headers: { authorization: `Bearer ${sellerToken}` },
      payload: { storeName: "Ship Store", bankAccountNumber: "0123456789", bankCode: "058" },
    });
    expect(onboarded.statusCode).toBe(201);
    const profileId = onboarded.json().data.id as string;
    await profiles.review(profileId);
    await profiles.approve(profileId);

    buyerToken = await register("buyer@tradeloop.test");
    buyerId = await userIdOf(buyerToken);
    await fundBuyer(buyerId, "50000.00");

    if (!dataSource) throw new Error("DataSource not initialized");
    const category = await dataSource.getRepository(Category).save(
      dataSource.getRepository(Category).create({ name: "Fabrics", slug: "fabrics" }),
    );
    const made = await client()({
      method: "POST",
      url: "/api/v1/products",
      headers: { authorization: `Bearer ${sellerToken}` },
      payload: { name: "Ankara", price: "2500.00", categoryId: category.id, stock: 10 },
    });
    expect(made.statusCode).toBe(201);
    productId = made.json().data.id as string;
  });

  it("quotes shipping rates", async () => {
    const res = await client()({
      method: "GET",
      url: "/api/v1/shipments/rate?pickupLga=Ikeja&deliveryLga=Lekki&weightKg=2",
      headers: { authorization: `Bearer ${sellerToken}` },
    });
    expect(res.statusCode).toBe(200);
    expect(res.json().data).toEqual({ amount: "2200.00", currency: "NGN", estimatedDays: 4 });
  });

  it("drives an order to shipped, then creates a shipment", async () => {
    const created = await client()({
      method: "POST",
      url: "/api/v1/orders",
      headers: { authorization: `Bearer ${buyerToken}` },
      payload: { items: [{ productId, quantity: 1 }], shippingAddress: ADDRESS },
    });
    expect(created.statusCode).toBe(201);
    orderId = created.json().data.orders[0].id as string;

    await client()({
      method: "PATCH",
      url: `/api/v1/orders/${orderId}/confirm`,
      headers: { authorization: `Bearer ${sellerToken}` },
    });
    await client()({
      method: "PATCH",
      url: `/api/v1/orders/${orderId}/ship`,
      headers: { authorization: `Bearer ${sellerToken}` },
    });

    const shipped = await client()({
      method: "POST",
      url: "/api/v1/shipments",
      headers: { authorization: `Bearer ${sellerToken}` },
      payload: { orderId, ...SHIPMENT_INPUT },
    });
    expect(shipped.statusCode).toBe(201);
    expect(shipped.json().data.status).toBe(ShipmentStatus.PENDING);
    expect(shipped.json().data.rateAmount).toBe("2200.00");
    trackingNumber = shipped.json().data.trackingNumber as string;
  });

  it("tracks the parcel through to delivery", async () => {
    const seen: string[] = [];
    for (let i = 0; i < 4; i += 1) {
      const tracked = await client()({
        method: "GET",
        url: `/api/v1/shipments/${trackingNumber}/track`,
        headers: { authorization: `Bearer ${buyerToken}` },
      });
      expect(tracked.statusCode).toBe(200);
      seen.push(tracked.json().data.tracking.status as string);
    }
    expect(seen).toEqual(["PICKED_UP", "IN_TRANSIT", "OUT_FOR_DELIVERY", "DELIVERED"]);

    const delivered = await client()({
      method: "PATCH",
      url: `/api/v1/orders/${orderId}/deliver`,
      headers: { authorization: `Bearer ${buyerToken}` },
    });
    expect(delivered.statusCode).toBe(200);
  });

  it("rejects duplicate shipments, foreign sellers, and unshipped orders", async () => {
    const duplicate = await client()({
      method: "POST",
      url: "/api/v1/shipments",
      headers: { authorization: `Bearer ${sellerToken}` },
      payload: { orderId, ...SHIPMENT_INPUT },
    });
    expect(duplicate.statusCode).toBe(409);

    const otherToken = await register("other-seller@tradeloop.test");
    const foreign = await client()({
      method: "POST",
      url: "/api/v1/shipments",
      headers: { authorization: `Bearer ${otherToken}` },
      payload: { orderId, ...SHIPMENT_INPUT },
    });
    expect(foreign.statusCode).toBe(403);

    const created = await client()({
      method: "POST",
      url: "/api/v1/orders",
      headers: { authorization: `Bearer ${buyerToken}` },
      payload: { items: [{ productId, quantity: 1 }], shippingAddress: ADDRESS },
    });
    const freshOrderId = created.json().data.orders[0].id as string;
    const early = await client()({
      method: "POST",
      url: "/api/v1/shipments",
      headers: { authorization: `Bearer ${sellerToken}` },
      payload: { orderId: freshOrderId, ...SHIPMENT_INPUT },
    });
    expect(early.statusCode).toBe(409);
  });

  it("returns 404 for unknown tracking numbers", async () => {
    const res = await client()({
      method: "GET",
      url: "/api/v1/shipments/MOCK-NOPE/track",
      headers: { authorization: `Bearer ${buyerToken}` },
    });
    expect(res.statusCode).toBe(404);
  });

  it("rejects sendbox webhooks while the mock provider is active", async () => {
    const rawBody = JSON.stringify({ trackingNumber, status: "delivered" });
    const res = await client()({
      method: "POST",
      url: "/api/v1/webhooks/sendbox",
      headers: { "x-sendbox-signature": "anything" },
      payload: JSON.parse(rawBody) as Record<string, unknown>,
    });
    expect(res.statusCode).toBe(401);
  });
});

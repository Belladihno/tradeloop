import { getQueueToken } from "@nestjs/bullmq";
import { ConfigService } from "@nestjs/config";
import type { NestFastifyApplication } from "@nestjs/platform-fastify";
import { FastifyAdapter } from "@nestjs/platform-fastify";
import { ThrottlerGuard } from "@nestjs/throttler";
import { Test } from "@nestjs/testing";
import { ZodValidationPipe } from "nestjs-zod";
import { DataSource } from "typeorm";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { DisputeStatus, OrderStatus, UserRole, WalletType } from "@tradeloop/types";
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
import { DisputeService } from "../disputes/disputes.service";
import { DisputesProcessor } from "../disputes/disputes.processor";
import { SettlementsProcessor } from "../settlement/settlements.processor";
import { SettlementService } from "../settlement/settlement.service";
import Redis from "ioredis";
import { AuditLog } from "../audit/entities/audit-log.entity";
import { startTestDatabase, type TestDatabase } from "../test/test-database";

vi.setConfig({ testTimeout: 120_000, hookTimeout: 180_000 });

let app: NestFastifyApplication | undefined;
let container: TestDatabase | undefined;
let dataSource: DataSource | undefined;
let settlement: SettlementService;
let disputes: DisputeService;
let wallets: WalletRepository;
let profiles: SellerProfilesService;

const redisClient = new Redis(
  process.env.REDIS_URL ?? "redis://localhost:16379",
  { maxRetriesPerRequest: 5 },
);

const settlementsQueue = { add: vi.fn(async () => ({ id: "job-1" })) };
const disputesQueue = {
  add: vi.fn(async (_name: string, _data: unknown, options?: { jobId?: string }) => ({
    id: options?.jobId ?? "job-1",
  })),
  getJob: vi.fn(async () => null),
};

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
  const { Fraud1760700000000 } = await import("../migrations/1760700000000-Fraud");
  const { AuditLogs1760800000000 } = await import("../migrations/1760800000000-AuditLogs");

  dataSource = new DataSource({
    type: "postgres",
    url: container.getConnectionUri(),
    entities: [
      User, Wallet, Transaction, Category, Product, SellerProfile, BuyerProfile,
      Cart, CartItem, Order, OrderItem, IdempotencyKey, Discount, DiscountRedemption, Dispute,
      AuditLog,
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
      Fraud1760700000000,
      AuditLogs1760800000000,
    ],
    namingStrategy: new SnakeNamingStrategy(),
    synchronize: false,
  });
  await dataSource.initialize();
  await dataSource.runMigrations();
  await dataSource.query(
    `INSERT INTO "users" ("id", "email", "role") VALUES
      ('01a0ffa2-e0d0-7736-be4b-2fe8db53ad01', 'phase9-admin@tradeloop.test', 'ADMIN')
     ON CONFLICT ("id") DO NOTHING`,
  );

  const moduleRef = await Test.createTestingModule({ imports: [AppModule] })
    .overrideProvider(REDIS_CLIENT)
    .useValue(redisClient)
    .overrideProvider(ConfigService)
    .useValue({ get: (key: string) => process.env[key] })
    .overrideProvider(getQueueToken("settlements"))
    .useValue(settlementsQueue)
    .overrideProvider(getQueueToken("disputes"))
    .useValue(disputesQueue)
    .overrideProvider(SettlementsProcessor)
    .useValue({})
    .overrideProvider(DisputesProcessor)
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

  settlement = moduleRef.get(SettlementService);
  disputes = moduleRef.get(DisputeService);
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
const ADMIN_ID = "01a0ffa2-e0d0-7736-be4b-2fe8db53ad01";

async function register(email: string): Promise<string> {
  const res = await client()({
    method: "POST",
    url: "/api/v1/auth/register",
    payload: { email, password: "password123", role: "BUYER" },
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

async function walletBalance(userId: string, type: WalletType): Promise<string> {
  const wallet = await wallets.findByUserAndType(userId, type);
  if (!wallet) throw new Error(`Wallet missing for ${userId}`);
  return wallet.balance;
}

describe("settlement and disputes", () => {
  let sellerToken = "";
  let sellerId = "";
  let buyerToken = "";
  let buyerId = "";
  let productId = "";
  let settledOrderId = "";

  it("prepares an approved seller, product, and funded buyer", async () => {
    sellerToken = await register("seller@tradeloop.test");
    sellerId = await userIdOf(sellerToken);
    const onboarded = await client()({
      method: "POST",
      url: "/api/v1/seller/onboard",
      headers: { authorization: `Bearer ${sellerToken}` },
      payload: { storeName: "Settlement Store", bankAccountNumber: "0123456789", bankCode: "058" },
    });
    expect(onboarded.statusCode).toBe(201);
    const profileId = onboarded.json().data.id as string;
    await profiles.review(profileId);
    await profiles.approve(profileId);
    sellerToken = await login("seller@tradeloop.test", "password123");

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

  it("drives an order to delivery and queues settlement", async () => {
    const created = await client()({
      method: "POST",
      url: "/api/v1/orders",
      headers: { authorization: `Bearer ${buyerToken}` },
      payload: { items: [{ productId, quantity: 2 }], shippingAddress: ADDRESS },
    });
    expect(created.statusCode).toBe(201);
    settledOrderId = created.json().data.orders[0].id as string;

    await client()({
      method: "PATCH",
      url: `/api/v1/orders/${settledOrderId}/confirm`,
      headers: { authorization: `Bearer ${sellerToken}` },
    });
    await client()({
      method: "PATCH",
      url: `/api/v1/orders/${settledOrderId}/ship`,
      headers: { authorization: `Bearer ${sellerToken}` },
    });
    await client()({
      method: "PATCH",
      url: `/api/v1/orders/${settledOrderId}/deliver`,
      headers: { authorization: `Bearer ${buyerToken}` },
    });

    await vi.waitFor(() => {
      expect(settlementsQueue.add).toHaveBeenCalledWith("settle", { orderId: settledOrderId });
    });
  });

  it("settles escrow into commission and seller net", async () => {
    expect(await settlement.settle(settledOrderId)).toBe("completed");
    expect(await settlement.settle(settledOrderId)).toBe("duplicate");

    expect(await walletBalance(buyerId, WalletType.BUYER)).toBe("45000.00");
    expect(await walletBalance(sellerId, WalletType.SELLER)).toBe("4500.00");
    const platform = await wallets.findSystemWallet(WalletType.PLATFORM);
    const escrow = await wallets.findSystemWallet(WalletType.ESCROW);
    expect(platform?.balance).toBe("500.00");
    expect(escrow?.balance).toBe("0.00");

    if (!dataSource) throw new Error("DataSource not initialized");
    const auditRows = await dataSource.getRepository(AuditLog).find({
      where: { action: "settlement.completed" },
    });
    expect(auditRows).toHaveLength(1);
    expect(auditRows[0].entityId).toBe(settledOrderId);
  });

  it("refunds buyers on dispute resolution", async () => {
    const created = await client()({
      method: "POST",
      url: "/api/v1/orders",
      headers: { authorization: `Bearer ${buyerToken}` },
      payload: { items: [{ productId, quantity: 1 }], shippingAddress: ADDRESS },
    });
    const orderId = created.json().data.orders[0].id as string;
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

    const raised = await client()({
      method: "POST",
      url: `/api/v1/orders/${orderId}/dispute`,
      headers: { authorization: `Bearer ${buyerToken}` },
      payload: { reason: "The fabric arrived torn and unusable" },
    });
    expect(raised.statusCode).toBe(201);
    expect(raised.json().data.status).toBe(DisputeStatus.OPEN);
    const disputeId = raised.json().data.id as string;

    const again = await client()({
      method: "POST",
      url: `/api/v1/orders/${orderId}/dispute`,
      headers: { authorization: `Bearer ${buyerToken}` },
      payload: { reason: "Trying to dispute twice in a row" },
    });
    expect(again.statusCode).toBe(409);

    const resolved = await disputes.resolve(disputeId, ADMIN_ID, "BUYER");
    expect(resolved.status).toBe(DisputeStatus.RESOLVED_BUYER);
    expect(await walletBalance(buyerId, WalletType.BUYER)).toBe("45000.00");
  });

  it("settles sellers on dispute resolution", async () => {
    const created = await client()({
      method: "POST",
      url: "/api/v1/orders",
      headers: { authorization: `Bearer ${buyerToken}` },
      payload: { items: [{ productId, quantity: 1 }], shippingAddress: ADDRESS },
    });
    const orderId = created.json().data.orders[0].id as string;
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
    const raised = await client()({
      method: "POST",
      url: `/api/v1/orders/${orderId}/dispute`,
      headers: { authorization: `Bearer ${buyerToken}` },
      payload: { reason: "Late delivery but item is fine overall" },
    });
    expect(raised.statusCode).toBe(201);

    const resolved = await disputes.resolve(raised.json().data.id as string, ADMIN_ID, "SELLER");
    expect(resolved.status).toBe(DisputeStatus.RESOLVED_SELLER);
    expect(await walletBalance(sellerId, WalletType.SELLER)).toBe("6750.00");
  });

  it("expires neglected disputes in the seller's favour", async () => {
    const created = await client()({
      method: "POST",
      url: "/api/v1/orders",
      headers: { authorization: `Bearer ${buyerToken}` },
      payload: { items: [{ productId, quantity: 1 }], shippingAddress: ADDRESS },
    });
    const orderId = created.json().data.orders[0].id as string;
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
    const raised = await client()({
      method: "POST",
      url: `/api/v1/orders/${orderId}/dispute`,
      headers: { authorization: `Bearer ${buyerToken}` },
      payload: { reason: "Nobody will resolve this dispute ever" },
    });
    expect(raised.statusCode).toBe(201);

    expect(await disputes.expire(raised.json().data.id as string)).toBe("expired");
    expect(await walletBalance(sellerId, WalletType.SELLER)).toBe("9000.00");
  });

  async function login(email: string, password: string): Promise<string> {
    const res = await client()({
      method: "POST",
      url: "/api/v1/auth/login",
      payload: { email, password },
    });
    if (res.statusCode !== 200) throw new Error(`Login failed for ${email}`);
    return res.json().data.accessToken as string;
  }
});

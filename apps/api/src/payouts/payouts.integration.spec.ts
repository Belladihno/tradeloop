import Redis from "ioredis";
import { getQueueToken } from "@nestjs/bullmq";
import { ConfigService } from "@nestjs/config";
import type { NestFastifyApplication } from "@nestjs/platform-fastify";
import { FastifyAdapter } from "@nestjs/platform-fastify";
import { ThrottlerGuard } from "@nestjs/throttler";
import { Test } from "@nestjs/testing";
import { hash } from "argon2";
import { ZodValidationPipe } from "nestjs-zod";
import { DataSource } from "typeorm";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { PayoutStatus, UserRole, WalletType } from "@tradeloop/types";
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
import { PayoutRequest } from "./entities/payout-request.entity";
import { WebhookDelivery } from "../webhooks/outbound/entities/webhook-delivery.entity";
import { Notification } from "../notifications/entities/notification.entity";
import { DisputesProcessor } from "../disputes/disputes.processor";
import { SettlementsProcessor } from "../settlement/settlements.processor";
import { PayoutsProcessor } from "./payouts.processor";
import { PayoutsService } from "./payouts.service";
import { startTestDatabase, type TestDatabase } from "../test/test-database";

vi.setConfig({ testTimeout: 120_000, hookTimeout: 180_000 });

let app: NestFastifyApplication | undefined;
let container: TestDatabase | undefined;
let dataSource: DataSource | undefined;
let payouts: PayoutsService;
let wallets: WalletRepository;
let profiles: SellerProfilesService;

const redisClient = new Redis(
  process.env.REDIS_URL ?? "redis://localhost:16379",
  { maxRetriesPerRequest: 5 },
);

const payoutsQueue = { add: vi.fn(async () => ({ id: "job-1" })) };

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
      PayoutRequest, Notification, WebhookDelivery,
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
    .overrideProvider(getQueueToken("payouts"))
    .useValue(payoutsQueue)
    .overrideProvider(PayoutsProcessor)
    .useValue({})
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

  payouts = moduleRef.get(PayoutsService);
  wallets = moduleRef.get(WalletRepository);
  profiles = moduleRef.get(SellerProfilesService);

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
  await app?.close();
  await dataSource?.destroy();
  await redisClient.quit().catch(() => undefined);
  await container?.stop();
});

function client() {
  if (!app) throw new Error("App not initialized");
  return app.inject.bind(app);
}

async function register(email: string, role: "BUYER" | "SELLER" = "BUYER"): Promise<string> {
  const res = await client()({
    method: "POST",
    url: "/api/v1/auth/register",
    payload: { email, password: "password123", role },
  });
  if (res.statusCode !== 201) throw new Error(`Register failed for ${email}`);
  return res.json().data.accessToken as string;
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

async function userIdOf(token: string): Promise<string> {
  const res = await client()({
    method: "GET",
    url: "/api/v1/users/me",
    headers: { authorization: `Bearer ${token}` },
  });
  return res.json().data.id as string;
}

async function creditSeller(userId: string, amount: string): Promise<void> {
  if (!dataSource) throw new Error("DataSource not initialized");
  const sellerWallet = await wallets.findByUserAndType(userId, WalletType.SELLER);
  if (!sellerWallet) throw new Error("Seller wallet missing");
  const runner = dataSource.createQueryRunner();
  await runner.connect();
  await runner.startTransaction();
  try {
    await wallets.creditAtomic(sellerWallet.id, amount, runner);
    await runner.commitTransaction();
  } catch (error) {
    await runner.rollbackTransaction();
    throw error;
  } finally {
    await runner.release();
  }
}

async function sellerBalance(userId: string): Promise<string> {
  const wallet = await wallets.findByUserAndType(userId, WalletType.SELLER);
  if (!wallet) throw new Error("Seller wallet missing");
  return wallet.balance;
}

describe("payouts", () => {
  let sellerToken = "";
  let sellerId = "";
  let adminToken = "";

  it("prepares an approved seller with a settled balance", async () => {
    adminToken = await login("admin@tradeloop.test", "admin-password");
    sellerToken = await register("seller@tradeloop.test");
    sellerId = await userIdOf(sellerToken);
    const onboarded = await client()({
      method: "POST",
      url: "/api/v1/seller/onboard",
      headers: { authorization: `Bearer ${sellerToken}` },
      payload: {
        storeName: "Payout Store",
        bankAccountNumber: "0123456789",
        bankCode: "058",
        webhookUrl: "https://seller.test/hooks",
        webhookSecret: "supersecretvalue123",
      },
    });
    expect(onboarded.statusCode).toBe(201);
    const profileId = onboarded.json().data.id as string;
    await profiles.review(profileId);
    await profiles.approve(profileId);
    await creditSeller(sellerId, "50000.00");
    expect(await sellerBalance(sellerId)).toBe("50000.00");
  });

  it("requests a payout and snapshots the bank destination", async () => {
    const res = await client()({
      method: "POST",
      url: "/api/v1/payouts",
      headers: { authorization: `Bearer ${sellerToken}` },
      payload: { amount: "2500.00" },
    });
    expect(res.statusCode).toBe(201);
    expect(res.json().data.status).toBe(PayoutStatus.PENDING);
    expect(res.json().data.bankCode).toBe("058");
    expect(res.json().data.bankAccountLast4).toBe("6789");

    const listed = await client()({
      method: "GET",
      url: "/api/v1/payouts/mine",
      headers: { authorization: `Bearer ${sellerToken}` },
    });
    expect(listed.statusCode).toBe(200);
    expect(listed.json().data).toHaveLength(1);
  });

  it("refuses requests above the seller balance", async () => {
    const res = await client()({
      method: "POST",
      url: "/api/v1/payouts",
      headers: { authorization: `Bearer ${sellerToken}` },
      payload: { amount: "99999.00" },
    });
    expect(res.statusCode).toBe(400);
  });

  it("approves payouts and processes them out of the seller wallet", async () => {
    const mine = await client()({
      method: "GET",
      url: "/api/v1/payouts/mine",
      headers: { authorization: `Bearer ${sellerToken}` },
    });
    const payoutId = mine.json().data[0].id as string;

    const approved = await client()({
      method: "PATCH",
      url: `/api/v1/admin/payouts/${payoutId}/approve`,
      headers: { authorization: `Bearer ${adminToken}` },
    });
    expect(approved.statusCode).toBe(200);
    expect(approved.json().data.status).toBe(PayoutStatus.APPROVED);
    expect(payoutsQueue.add).toHaveBeenCalledWith("process", { payoutId }, expect.anything());

    expect(await payouts.process(payoutId)).toBe("completed");
    expect(await payouts.process(payoutId)).toBe("duplicate");
    expect(await sellerBalance(sellerId)).toBe("47500.00");

    if (!dataSource) throw new Error("DataSource not initialized");
    const rows = await dataSource.getRepository(WebhookDelivery).find();
    const events = rows.map((row) => row.eventType);
    expect(events).toContain("payout.completed");
  });

  it("fails payouts when the balance is gone at processing time", async () => {
    const first = await client()({
      method: "POST",
      url: "/api/v1/payouts",
      headers: { authorization: `Bearer ${sellerToken}` },
      payload: { amount: "45000.00" },
    });
    expect(first.statusCode).toBe(201);
    const second = await client()({
      method: "POST",
      url: "/api/v1/payouts",
      headers: { authorization: `Bearer ${sellerToken}` },
      payload: { amount: "45000.00" },
    });
    expect(second.statusCode).toBe(201);
    const firstId = first.json().data.id as string;
    const secondId = second.json().data.id as string;

    await client()({
      method: "PATCH",
      url: `/api/v1/admin/payouts/${firstId}/approve`,
      headers: { authorization: `Bearer ${adminToken}` },
    });
    await client()({
      method: "PATCH",
      url: `/api/v1/admin/payouts/${secondId}/approve`,
      headers: { authorization: `Bearer ${adminToken}` },
    });

    expect(await payouts.process(firstId)).toBe("completed");
    expect(await payouts.process(secondId)).toBe("failed");
    expect(await sellerBalance(sellerId)).toBe("2500.00");
  });

  it("rejects payouts with a reason and blocks later approval", async () => {
    const made = await client()({
      method: "POST",
      url: "/api/v1/payouts",
      headers: { authorization: `Bearer ${sellerToken}` },
      payload: { amount: "100.00" },
    });
    expect(made.statusCode).toBe(201);
    const payoutId = made.json().data.id as string;

    const rejected = await client()({
      method: "PATCH",
      url: `/api/v1/admin/payouts/${payoutId}/reject`,
      headers: { authorization: `Bearer ${adminToken}` },
      payload: { reason: "Bank details need review" },
    });
    expect(rejected.statusCode).toBe(200);
    expect(rejected.json().data.status).toBe(PayoutStatus.REJECTED);

    const late = await client()({
      method: "PATCH",
      url: `/api/v1/admin/payouts/${payoutId}/approve`,
      headers: { authorization: `Bearer ${adminToken}` },
    });
    expect(late.statusCode).toBe(409);
  });
});

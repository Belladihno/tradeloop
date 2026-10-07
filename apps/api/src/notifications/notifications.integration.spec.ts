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
import {
  NotificationChannel,
  NotificationStatus,
  UserRole,
  WalletType,
} from "@tradeloop/types";
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
import { Notification } from "./entities/notification.entity";
import { EmailChannel } from "./email.channel";
import { NotificationStream } from "./notification-stream";
import { NotificationsProcessor } from "./notifications.processor";
import { NotificationsService } from "./notifications.service";
import { DisputesProcessor } from "../disputes/disputes.processor";
import { SettlementsProcessor } from "../settlement/settlements.processor";
import { PayoutsProcessor } from "../payouts/payouts.processor";
import { startTestDatabase, type TestDatabase } from "../test/test-database";

vi.setConfig({ testTimeout: 120_000, hookTimeout: 180_000 });

let app: NestFastifyApplication | undefined;
let container: TestDatabase | undefined;
let dataSource: DataSource | undefined;
let notifications: NotificationsService;
let stream: NotificationStream;
let wallets: WalletRepository;
let profiles: SellerProfilesService;

const redisClient = new Redis(
  process.env.REDIS_URL ?? "redis://localhost:16379",
  { maxRetriesPerRequest: 5 },
);

const notificationsQueue = { add: vi.fn(async () => ({ id: "job-1" })) };
const emailOutbox: { userId: string; subject: string; body: string }[] = [];
const emailFake = {
  send: vi.fn(async (payload: { userId: string; subject: string; body: string }) => {
    emailOutbox.push(payload);
  }),
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

  dataSource = new DataSource({
    type: "postgres",
    url: container.getConnectionUri(),
    entities: [
      User, Wallet, Transaction, Category, Product, SellerProfile, BuyerProfile,
      Cart, CartItem, Order, OrderItem, IdempotencyKey, Discount, DiscountRedemption, Dispute,
      PayoutRequest, Notification,
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
    .overrideProvider(getQueueToken("notifications"))
    .useValue(notificationsQueue)
    .overrideProvider(EmailChannel)
    .useValue(emailFake)
    .overrideProvider(NotificationsProcessor)
    .useValue({})
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

  notifications = moduleRef.get(NotificationsService);
  stream = moduleRef.get(NotificationStream);
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

describe("notifications", () => {
  let userToken = "";
  let userId = "";

  it("registers a user for the notification flow", async () => {
    userToken = await register("notify@tradeloop.test");
    userId = await userIdOf(userToken);
  });

  it("stores pending rows and enqueues delivery per channel", async () => {
    const created = await notifications.notify({
      userId,
      channels: [NotificationChannel.IN_APP, NotificationChannel.EMAIL],
      subject: "Welcome",
      body: "Your account is ready",
    });
    expect(created).toHaveLength(2);
    expect(created.every((n) => n.status === NotificationStatus.PENDING)).toBe(true);
    expect(notificationsQueue.add).toHaveBeenCalledWith(
      "send",
      { notificationId: created[0].id },
    );
  });

  it("delivers email through the email channel and in-app through the stream", async () => {
    const received: unknown[] = [];
    stream.subscribe(userId).subscribe((event) => received.push(event));

    const created = await notifications.notify({
      userId,
      channels: [NotificationChannel.IN_APP, NotificationChannel.EMAIL],
      subject: "Order update",
      body: "Your order shipped",
    });
    for (const record of created) {
      expect(await notifications.send(record.id)).toBe("sent");
    }

    expect(emailFake.send).toHaveBeenCalledWith(
      expect.objectContaining({ userId, subject: "Order update" }),
    );
    expect(received).toHaveLength(1);
    expect(await notifications.send(created[0].id)).toBe("duplicate");
  });

  it("lists a user's notifications over HTTP", async () => {
    const res = await client()({
      method: "GET",
      url: "/api/v1/notifications/mine",
      headers: { authorization: `Bearer ${userToken}` },
    });
    expect(res.statusCode).toBe(200);
    expect(res.json().data.length).toBeGreaterThanOrEqual(4);
  });

  it("marks failed email deliveries instead of throwing", async () => {
    emailFake.send.mockRejectedValueOnce(new Error("SMTP down"));
    const [record] = await notifications.notify({
      userId,
      channels: [NotificationChannel.EMAIL],
      subject: "Doomed",
      body: "This will not send",
    });
    expect(await notifications.send(record.id)).toBe("failed");
  });

  it("notifies sellers when payouts are approved", async () => {
    const adminToken = await login("admin@tradeloop.test", "admin-password");
    const sellerToken = await register("payout-seller@tradeloop.test");
    const sellerId = await userIdOf(sellerToken);
    const onboarded = await client()({
      method: "POST",
      url: "/api/v1/seller/onboard",
      headers: { authorization: `Bearer ${sellerToken}` },
      payload: { storeName: "Notify Store", bankAccountNumber: "0123456789", bankCode: "058" },
    });
    expect(onboarded.statusCode).toBe(201);
    const profileId = onboarded.json().data.id as string;
    await profiles.review(profileId);
    await profiles.approve(profileId);

    if (!dataSource) throw new Error("DataSource not initialized");
    const sellerWallet = await wallets.findByUserAndType(sellerId, WalletType.SELLER);
    if (!sellerWallet) throw new Error("Seller wallet missing");
    const runner = dataSource.createQueryRunner();
    await runner.connect();
    await runner.startTransaction();
    try {
      await wallets.creditAtomic(sellerWallet.id, "50000.00", runner);
      await runner.commitTransaction();
    } catch (error) {
      await runner.rollbackTransaction();
      throw error;
    } finally {
      await runner.release();
    }

    const made = await client()({
      method: "POST",
      url: "/api/v1/payouts",
      headers: { authorization: `Bearer ${sellerToken}` },
      payload: { amount: "1000.00" },
    });
    expect(made.statusCode).toBe(201);

    const approved = await client()({
      method: "PATCH",
      url: `/api/v1/admin/payouts/${made.json().data.id as string}/approve`,
      headers: { authorization: `Bearer ${adminToken}` },
    });
    expect(approved.statusCode).toBe(200);

    const listed = await client()({
      method: "GET",
      url: "/api/v1/notifications/mine",
      headers: { authorization: `Bearer ${sellerToken}` },
    });
    const subjects = (listed.json().data as { subject: string }[]).map((n) => n.subject);
    expect(subjects).toContain("Payout approved");
  });
});

import Redis from "ioredis";
import { startTestDatabase, type TestDatabase } from "../test/test-database";
import type { NestFastifyApplication } from "@nestjs/platform-fastify";
import { FastifyAdapter } from "@nestjs/platform-fastify";
import { ThrottlerStorage } from "@nestjs/throttler";
import { inertThrottlerStorage } from "../test/no-throttle";
import { Test } from "@nestjs/testing";
import { hash } from "argon2";
import { ZodValidationPipe } from "nestjs-zod";
import { DataSource } from "typeorm";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { SellerStatus, UserRole, WalletType } from "@tradeloop/types";
import { AppModule } from "../app.module";
import { SnakeNamingStrategy } from "../common/database/snake-naming.strategy";
import { SanitizePipe } from "../common/pipes/sanitize.pipe";
import { User } from "../users/entities/user.entity";
import { UsersService } from "../users/users.service";
import { Init1759400000000 } from "../migrations/1759400000000-Init";
import { CreateUsers1759500000000 } from "../migrations/1759500000000-CreateUsers";
import { ConfigService } from "@nestjs/config";
import { REDIS_CLIENT } from "../redis/redis.module";
import { WalletRepository } from "../wallet/wallet.repository";
import { WalletService } from "../wallet/wallet.service";
import { Wallet } from "../wallet/entities/wallet.entity";
import { Transaction } from "../wallet/entities/transaction.entity";
import { Category } from "../categories/entities/category.entity";
import { Product } from "../products/entities/product.entity";
import { SellerProfile } from "./entities/seller-profile.entity";
import { BuyerProfile } from "../buyer-profiles/entities/buyer-profile.entity";

vi.setConfig({ testTimeout: 120_000, hookTimeout: 180_000 });

let app: NestFastifyApplication | undefined;
let container: TestDatabase | undefined;
let dataSource: DataSource | undefined;
let users: UsersService;
let wallets: WalletService;
let walletRepository: WalletRepository;

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
    entities: [User, Wallet, Transaction, Category, Product, SellerProfile, BuyerProfile],
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

  users = moduleRef.get(UsersService);
  wallets = moduleRef.get(WalletService);
  walletRepository = moduleRef.get(WalletRepository);

  await users.create({
    email: "admin@tradeloop.test",
    passwordHash: await hash("admin-password"),
    role: UserRole.ADMIN,
  });
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

async function login(email: string, password: string): Promise<string> {
  const res = await client()({
    method: "POST",
    url: "/api/v1/auth/login",
    payload: { email, password },
  });
  if (res.statusCode !== 200) throw new Error(`Login failed for ${email}`);
  return res.json().data.accessToken as string;
}

let cachedAdminToken = "";

async function adminToken(): Promise<string> {
  if (!cachedAdminToken) {
    cachedAdminToken = await login("admin@tradeloop.test", "admin-password");
  }
  return cachedAdminToken;
}

describe("seller lifecycle", () => {
  let buyerToken = "";
  let profileId = "";

  it("registers a buyer with a zero-balance wallet", async () => {
    const res = await client()({
      method: "POST",
      url: "/api/v1/auth/register",
      payload: { email: "seller@tradeloop.test", password: "password123", role: "BUYER" },
    });
    expect(res.statusCode).toBe(201);
    const userId = res.json().data.user.id as string;

    expect(await wallets.getBalance(userId)).toBe("0.00");
    buyerToken = await login("seller@tradeloop.test", "password123");
  });

  it("onboards with encrypted bank details hidden from responses", async () => {
    const res = await client()({
      method: "POST",
      url: "/api/v1/seller/onboard",
      headers: { authorization: `Bearer ${buyerToken}` },
      payload: { storeName: "Bell's Store", bankAccountNumber: "0123456789", bankCode: "058" },
    });

    expect(res.statusCode).toBe(201);
    const body = res.json().data;
    expect(body.status).toBe(SellerStatus.PENDING_VERIFICATION);
    expect(body.commissionRate).toBe("0.1000");
    expect(body.bankAccountNumber).toBeUndefined();
    profileId = body.id as string;

    if (!dataSource) throw new Error("DataSource not initialized");
    const stored = await dataSource
      .getRepository(SellerProfile)
      .findOneOrFail({ where: { id: profileId } });
    expect(stored.bankAccountNumber).not.toBe("0123456789");
    expect(stored.bankAccountNumber).toContain(":");
  });

  it("blocks buyers from admin review endpoints", async () => {
    const res = await client()({
      method: "PATCH",
      url: `/api/v1/admin/sellers/${profileId}/review`,
      headers: { authorization: `Bearer ${buyerToken}` },
    });

    expect(res.statusCode).toBe(403);
  });

  it("reviews then approves with role promotion and seller wallet", async () => {
    const token = await adminToken();
    const review = await client()({
      method: "PATCH",
      url: `/api/v1/admin/sellers/${profileId}/review`,
      headers: { authorization: `Bearer ${token}` },
    });
    expect(review.statusCode).toBe(200);
    expect(review.json().data.status).toBe(SellerStatus.UNDER_REVIEW);

    const approve = await client()({
      method: "PATCH",
      url: `/api/v1/admin/sellers/${profileId}/approve`,
      headers: { authorization: `Bearer ${token}` },
    });
    expect(approve.statusCode).toBe(200);
    expect(approve.json().data.status).toBe(SellerStatus.ACTIVE);

    const me = await client()({
      method: "GET",
      url: "/api/v1/users/me",
      headers: { authorization: `Bearer ${buyerToken}` },
    });
    expect(me.json().data.role).toBe(UserRole.SELLER);

    const seller = me.json().data as { id: string };
    const sellerWallet = await walletRepository.findByUserAndType(seller.id, WalletType.SELLER);
    expect(sellerWallet?.balance).toBe("0.00");
  });

  it("rejects invalid transitions with a conflict envelope", async () => {
    const res = await client()({
      method: "PATCH",
      url: `/api/v1/admin/sellers/${profileId}/approve`,
      headers: { authorization: `Bearer ${await adminToken()}` },
    });

    expect(res.statusCode).toBe(409);
    expect(res.json().error).toBe("INVALID_STATE_TRANSITION");
  });

  it("rejects with a reason and allows re-review", async () => {
    const second = await client()({
      method: "POST",
      url: "/api/v1/auth/register",
      payload: { email: "second@tradeloop.test", password: "password123", role: "BUYER" },
    });
    const secondToken = second.json().data.accessToken as string;
    const onboarded = await client()({
      method: "POST",
      url: "/api/v1/seller/onboard",
      headers: { authorization: `Bearer ${secondToken}` },
      payload: { storeName: "Second Store", bankAccountNumber: "9876543210", bankCode: "058" },
    });
    const secondId = onboarded.json().data.id as string;
    const token = await adminToken();

    await client()({
      method: "PATCH",
      url: `/api/v1/admin/sellers/${secondId}/review`,
      headers: { authorization: `Bearer ${token}` },
    });
    const rejected = await client()({
      method: "PATCH",
      url: `/api/v1/admin/sellers/${secondId}/reject`,
      headers: { authorization: `Bearer ${token}` },
      payload: { reason: "Unverifiable bank details provided" },
    });
    expect(rejected.json().data.status).toBe(SellerStatus.PENDING_VERIFICATION);
    expect(rejected.json().data.rejectionReason).toBe("Unverifiable bank details provided");

    const rereviewed = await client()({
      method: "PATCH",
      url: `/api/v1/admin/sellers/${secondId}/review`,
      headers: { authorization: `Bearer ${token}` },
    });
    expect(rereviewed.json().data.rejectionReason).toBeNull();
  });

  it("stores webhook configuration encrypted at onboarding", async () => {
    const third = await client()({
      method: "POST",
      url: "/api/v1/auth/register",
      payload: { email: "third@tradeloop.test", password: "password123", role: "BUYER" },
    });
    const thirdToken = third.json().data.accessToken as string;
    const onboarded = await client()({
      method: "POST",
      url: "/api/v1/seller/onboard",
      headers: { authorization: `Bearer ${thirdToken}` },
      payload: {
        storeName: "Third Store",
        bankAccountNumber: "1122334455",
        bankCode: "058",
        webhookUrl: "https://seller.test/hooks",
        webhookSecret: "supersecretvalue123",
      },
    });
    expect(onboarded.statusCode).toBe(201);
    expect(onboarded.json().data.webhookUrl).toBe("https://seller.test/hooks");
    expect(onboarded.json().data.webhookSecret).toBeUndefined();

    if (!dataSource) throw new Error("DataSource not initialized");
    const stored = await dataSource
      .getRepository(SellerProfile)
      .findOneOrFail({ where: { id: onboarded.json().data.id as string } });
    expect(stored.webhookUrl).toBe("https://seller.test/hooks");
    expect(stored.webhookSecret).not.toBe("supersecretvalue123");
    expect(stored.webhookSecret).toContain(":");
  });
});

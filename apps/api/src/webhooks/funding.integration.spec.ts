import Redis from "ioredis";
import { startTestDatabase, type TestDatabase } from "../test/test-database";
import type { NestFastifyApplication } from "@nestjs/platform-fastify";
import { FastifyAdapter } from "@nestjs/platform-fastify";
import { ThrottlerGuard } from "@nestjs/throttler";
import { Test } from "@nestjs/testing";
import { createHmac } from "crypto";
import { ZodValidationPipe } from "nestjs-zod";
import { DataSource } from "typeorm";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
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

function sign(rawBody: string): string {
  return createHmac("sha512", PAYSTACK_TEST_SECRET).update(rawBody).digest("hex");
}

describe("wallet funding", () => {
  let buyerToken = "";
  let reference = "";

  it("registers a buyer for the funding flow", async () => {
    const res = await client()({
      method: "POST",
      url: "/api/v1/auth/register",
      payload: { email: "funder@tradeloop.test", password: "password123", role: "BUYER" },
    });
    expect(res.statusCode).toBe(201);
    buyerToken = res.json().data.accessToken as string;
  });

  it("initializes funding and tracks a pending intent", async () => {
    const res = await client()({
      method: "POST",
      url: "/api/v1/wallet/fund",
      headers: { authorization: `Bearer ${buyerToken}` },
      payload: { amount: "2500.00" },
    });

    expect(res.statusCode).toBe(201);
    expect(res.json().data.paymentUrl).toBe("https://paystack.test/pay/checkout");
    reference = res.json().data.reference as string;
    expect(reference).toBeTruthy();

    if (!dataSource) throw new Error("DataSource not initialized");
    const tracked = await dataSource.getRepository(Transaction).findOne({
      where: { referenceId: reference },
    });
    expect(tracked?.status).toBe("PENDING");
  });

  it("rejects invalid funding amounts", async () => {
    for (const amount of ["0", "-50", "abc", "10.999"]) {
      const res = await client()({
        method: "POST",
        url: "/api/v1/wallet/fund",
        headers: { authorization: `Bearer ${buyerToken}` },
        payload: { amount },
      });
      expect(res.statusCode).toBe(400);
    }
  });

  it("credits the wallet on a signed charge.success webhook", async () => {
    const rawBody = JSON.stringify({
      event: "charge.success",
      data: { reference, amount: 250000 },
    });
    const res = await client()({
      method: "POST",
      url: "/api/v1/webhooks/paystack",
      headers: { "x-paystack-signature": sign(rawBody) },
      payload: JSON.parse(rawBody) as Record<string, unknown>,
    });

    expect(res.statusCode).toBe(200);
    expect(res.json().data.status).toBe("processed");

    const balance = await client()({
      method: "GET",
      url: "/api/v1/wallet/balance",
      headers: { authorization: `Bearer ${buyerToken}` },
    });
    expect(balance.json().data.balance).toBe("2500.00");
  });

  it("ignores duplicate webhooks without double-crediting", async () => {
    const rawBody = JSON.stringify({
      event: "charge.success",
      data: { reference, amount: 250000 },
    });
    const res = await client()({
      method: "POST",
      url: "/api/v1/webhooks/paystack",
      headers: { "x-paystack-signature": sign(rawBody) },
      payload: JSON.parse(rawBody) as Record<string, unknown>,
    });

    expect(res.statusCode).toBe(200);
    expect(res.json().data.status).toBe("ignored");

    const balance = await client()({
      method: "GET",
      url: "/api/v1/wallet/balance",
      headers: { authorization: `Bearer ${buyerToken}` },
    });
    expect(balance.json().data.balance).toBe("2500.00");
  });

  it("rejects forged webhooks", async () => {
    const rawBody = JSON.stringify({
      event: "charge.success",
      data: { reference, amount: 250000 },
    });
    const res = await client()({
      method: "POST",
      url: "/api/v1/webhooks/paystack",
      headers: { "x-paystack-signature": "forged" },
      payload: JSON.parse(rawBody) as Record<string, unknown>,
    });

    expect(res.statusCode).toBe(401);
  });

  it("acknowledges webhooks for unknown references", async () => {
    const rawBody = JSON.stringify({
      event: "charge.success",
      data: { reference: "01a0ffa2-unknown-reference", amount: 10000 },
    });
    const res = await client()({
      method: "POST",
      url: "/api/v1/webhooks/paystack",
      headers: { "x-paystack-signature": sign(rawBody) },
      payload: JSON.parse(rawBody) as Record<string, unknown>,
    });

    expect(res.statusCode).toBe(200);
    expect(res.json().data.status).toBe("ignored");
  });
});

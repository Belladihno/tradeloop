import Redis from "ioredis";
import { startTestDatabase, type TestDatabase } from "../test/test-database";
import { ConfigService } from "@nestjs/config";
import type { NestFastifyApplication } from "@nestjs/platform-fastify";
import { FastifyAdapter } from "@nestjs/platform-fastify";
import { ThrottlerStorage } from "@nestjs/throttler";
import { inertThrottlerStorage } from "../test/no-throttle";
import { Test } from "@nestjs/testing";
import { ZodValidationPipe } from "nestjs-zod";
import { DataSource } from "typeorm";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { AppModule } from "../app.module";
import { SnakeNamingStrategy } from "../common/database/snake-naming.strategy";
import { SanitizePipe } from "../common/pipes/sanitize.pipe";
import { Init1759400000000 } from "../migrations/1759400000000-Init";
import { CreateUsers1759500000000 } from "../migrations/1759500000000-CreateUsers";
import { REDIS_CLIENT } from "../redis/redis.module";
import { User } from "../users/entities/user.entity";

vi.setConfig({ testTimeout: 120_000, hookTimeout: 180_000 });

let app: NestFastifyApplication | undefined;
let container: TestDatabase | undefined;

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

  const dataSource = new DataSource({
    type: "postgres",
    url: container.getConnectionUri(),
    entities: [User],
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
  await dataSource.destroy();

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
});

afterAll(async () => {
  await app?.close();
  await redisClient.quit().catch(() => undefined);
  await container?.stop();
});

function client() {
  if (!app) throw new Error("App not initialized");
  return app.inject.bind(app);
}

describe("auth lifecycle", () => {
  const email = "buyer@tradeloop.test";
  const password = "password123";
  let accessToken = "";
  let refreshToken = "";

  it("registers a buyer and returns a token pair without hashes", async () => {
    const res = await client()({
      method: "POST",
      url: "/api/v1/auth/register",
      payload: { email, password, role: "BUYER" },
    });

    expect(res.statusCode).toBe(201);
    const body = res.json();
    expect(body.success).toBe(true);
    expect(body.data.accessToken).toBeTruthy();
    expect(body.data.refreshToken).toBeTruthy();
    expect(body.data.user.email).toBe(email);
    expect(body.data.user.passwordHash).toBeUndefined();
    expect(body.data.user.refreshTokenHash).toBeUndefined();

    accessToken = body.data.accessToken as string;
    refreshToken = body.data.refreshToken as string;
  });

  it("rejects duplicate registration", async () => {
    const res = await client()({
      method: "POST",
      url: "/api/v1/auth/register",
      payload: { email, password: "otherpassword", role: "BUYER" },
    });

    expect(res.statusCode).toBe(409);
    expect(res.json().success).toBe(false);
  });

  it("rejects invalid payloads with a 400 envelope", async () => {
    const res = await client()({
      method: "POST",
      url: "/api/v1/auth/register",
      payload: { email: "not-an-email", password: "short", role: "BUYER" },
    });

    expect(res.statusCode).toBe(400);
    expect(res.json().success).toBe(false);
  });

  it("logs in with valid credentials", async () => {
    const res = await client()({
      method: "POST",
      url: "/api/v1/auth/login",
      payload: { email, password },
    });

    expect(res.statusCode).toBe(200);
    expect(res.json().data.accessToken).toBeTruthy();
    accessToken = res.json().data.accessToken as string;
    refreshToken = res.json().data.refreshToken as string;
  });

  it("rejects wrong passwords without distinguishing the cause", async () => {
    const res = await client()({
      method: "POST",
      url: "/api/v1/auth/login",
      payload: { email, password: "wrongpassword" },
    });

    expect(res.statusCode).toBe(401);
    expect(res.json().success).toBe(false);
  });

  it("returns the current user on /users/me", async () => {
    const res = await client()({
      method: "GET",
      url: "/api/v1/users/me",
      headers: { authorization: `Bearer ${accessToken}` },
    });

    expect(res.statusCode).toBe(200);
    expect(res.json().data.email).toBe(email);
  });

  it("rejects unauthenticated access to /users/me", async () => {
    const res = await client()({ method: "GET", url: "/api/v1/users/me" });

    expect(res.statusCode).toBe(401);
  });

  it("rotates the refresh token", async () => {
    const res = await client()({
      method: "POST",
      url: "/api/v1/auth/refresh",
      payload: { refreshToken },
    });

    expect(res.statusCode).toBe(200);
    const next = res.json().data.refreshToken as string;
    expect(next).not.toBe(refreshToken);
    refreshToken = next;
  });

  it("logs out, revokes the access token, and kills the session", async () => {
    const logout = await client()({
      method: "POST",
      url: "/api/v1/auth/logout",
      headers: { authorization: `Bearer ${accessToken}` },
    });
    expect(logout.statusCode).toBe(200);

    const me = await client()({
      method: "GET",
      url: "/api/v1/users/me",
      headers: { authorization: `Bearer ${accessToken}` },
    });
    expect(me.statusCode).toBe(401);

    const refresh = await client()({
      method: "POST",
      url: "/api/v1/auth/refresh",
      payload: { refreshToken },
    });
    expect(refresh.statusCode).toBe(401);
  });
});

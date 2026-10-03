import {
  PostgreSqlContainer,
  type StartedPostgreSqlContainer,
} from "@testcontainers/postgresql";
import type { NestFastifyApplication } from "@nestjs/platform-fastify";
import { FastifyAdapter } from "@nestjs/platform-fastify";
import { ThrottlerGuard } from "@nestjs/throttler";
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
let container: StartedPostgreSqlContainer | undefined;

const redisStore = new Map<string, string>();
const redisFake = new Proxy(
  {
    get: async (key: string): Promise<string | null> =>
      redisStore.get(key) ?? null,
    set: async (key: string, value: string): Promise<string> => {
      redisStore.set(key, value);
      return "OK";
    },
    exists: async (key: string): Promise<number> =>
      redisStore.has(key) ? 1 : 0,
    del: async (key: string): Promise<number> =>
      redisStore.delete(key) ? 1 : 0,
  },
  {
    get: (target, prop) =>
      prop in target
        ? target[prop as keyof typeof target]
        : async (): Promise<number> => 0,
  },
);

beforeAll(async () => {
  container = await new PostgreSqlContainer("postgres:15-alpine").start();
  process.env.DATABASE_URL = container.getConnectionUri();
  process.env.REDIS_URL = "redis://localhost:6379";
  process.env.JWT_SECRET = "integration-test-secret-minimum-32-chars";
  process.env.JWT_ACCESS_EXPIRY = "15m";
  process.env.JWT_REFRESH_EXPIRY = "7d";

  const dataSource = new DataSource({
    type: "postgres",
    url: container.getConnectionUri(),
    entities: [User],
    migrations: [Init1759400000000, CreateUsers1759500000000],
    namingStrategy: new SnakeNamingStrategy(),
    synchronize: false,
  });
  await dataSource.initialize();
  await dataSource.runMigrations();
  await dataSource.destroy();

  const moduleRef = await Test.createTestingModule({ imports: [AppModule] })
    .overrideProvider(REDIS_CLIENT)
    .useValue(redisFake)
    .overrideGuard(ThrottlerGuard)
    .useValue({ canActivate: () => true })
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

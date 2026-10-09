import Redis from "ioredis";
import { createHmac, timingSafeEqual } from "crypto";
import { createServer, type IncomingMessage, type Server, type ServerResponse } from "http";
import { getQueueToken } from "@nestjs/bullmq";
import { ConfigService } from "@nestjs/config";
import type { NestFastifyApplication } from "@nestjs/platform-fastify";
import { FastifyAdapter } from "@nestjs/platform-fastify";
import { ThrottlerStorage } from "@nestjs/throttler";
import { inertThrottlerStorage } from "../../test/no-throttle";
import { Test } from "@nestjs/testing";
import { hash } from "argon2";
import { ZodValidationPipe } from "nestjs-zod";
import { DataSource } from "typeorm";
import { AddressInfo } from "net";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { UserRole, WebhookDeliveryStatus } from "@tradeloop/types";
import { AppModule } from "../../app.module";
import { SnakeNamingStrategy } from "../../common/database/snake-naming.strategy";
import { SanitizePipe } from "../../common/pipes/sanitize.pipe";
import { User } from "../../users/entities/user.entity";
import { Init1759400000000 } from "../../migrations/1759400000000-Init";
import { CreateUsers1759500000000 } from "../../migrations/1759500000000-CreateUsers";
import { REDIS_CLIENT } from "../../redis/redis.module";
import { Wallet } from "../../wallet/entities/wallet.entity";
import { Transaction } from "../../wallet/entities/transaction.entity";
import { Category } from "../../categories/entities/category.entity";
import { Product } from "../../products/entities/product.entity";
import { SellerProfile } from "../../seller-profiles/entities/seller-profile.entity";
import { BuyerProfile } from "../../buyer-profiles/entities/buyer-profile.entity";
import { Cart } from "../../cart/entities/cart.entity";
import { CartItem } from "../../cart/entities/cart-item.entity";
import { Order } from "../../orders/entities/order.entity";
import { OrderItem } from "../../orders/entities/order-item.entity";
import { IdempotencyKey } from "../../idempotency/entities/idempotency-key.entity";
import { Discount } from "../../discounts/entities/discount.entity";
import { DiscountRedemption } from "../../discounts/entities/discount-redemption.entity";
import { Dispute } from "../../disputes/entities/dispute.entity";
import { PayoutRequest } from "../../payouts/entities/payout-request.entity";
import { Notification } from "../../notifications/entities/notification.entity";
import { Shipment } from "../../logistics/entities/shipment.entity";
import { WebhookDelivery } from "./entities/webhook-delivery.entity";
import { WebhookDeliveryService } from "./webhook-delivery.service";
import { WebhookDeliveryProcessor } from "./webhook-delivery.processor";
import { WebhookDeliveriesRepository } from "./webhook-deliveries.repository";
import { DisputesProcessor } from "../../disputes/disputes.processor";
import { SettlementsProcessor } from "../../settlement/settlements.processor";
import { PayoutsProcessor } from "../../payouts/payouts.processor";
import { NotificationsProcessor } from "../../notifications/notifications.processor";
import { startTestDatabase, type TestDatabase } from "../../test/test-database";

vi.setConfig({ testTimeout: 120_000, hookTimeout: 180_000 });

let app: NestFastifyApplication | undefined;
let container: TestDatabase | undefined;
let dataSource: DataSource | undefined;
let deliveries: WebhookDeliveryService;
let repository: WebhookDeliveriesRepository;
let stub: Server | undefined;
let stubPort = 0;

const received: { signature: string; body: string }[] = [];
const SECRET = "supersecretvalue123";

const redisClient = new Redis(
  process.env.REDIS_URL ?? "redis://localhost:16379",
  { maxRetriesPerRequest: 5 },
);

const webhooksQueue = { add: vi.fn(async () => ({ id: "job-1" })) };

function readBody(req: IncomingMessage): Promise<string> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    req.on("data", (chunk: Buffer) => chunks.push(chunk));
    req.on("end", () => resolve(Buffer.concat(chunks).toString("utf8")));
    req.on("error", reject);
  });
}

beforeAll(async () => {
  stub = createServer(async (req: IncomingMessage, res: ServerResponse) => {
    const body = await readBody(req);
    received.push({ signature: (req.headers["x-tradeloop-signature"] as string) ?? "", body });
    res.writeHead(200, { "content-type": "application/json" });
    res.end(JSON.stringify({ ok: true }));
  });
  await new Promise<void>((resolve) => stub?.listen(0, "127.0.0.1", resolve));
  stubPort = (stub.address() as AddressInfo).port;

  container = await startTestDatabase();
  process.env.DATABASE_URL = container.getConnectionUri();
  process.env.JWT_SECRET = "integration-test-secret-minimum-32-chars";
  process.env.JWT_ACCESS_EXPIRY = "15m";
  process.env.JWT_REFRESH_EXPIRY = "7d";

  const { Wallets1759600000000 } = await import("../../migrations/1759600000000-Wallets");
  const { Categories1759700000000 } = await import("../../migrations/1759700000000-Categories");
  const { Products1759800000000 } = await import("../../migrations/1759800000000-Products");
  const { SellerProfiles1759900000000 } = await import("../../migrations/1759900000000-SellerProfiles");
  const { BuyerProfiles1759910000000 } = await import("../../migrations/1759910000000-BuyerProfiles");
  const { Carts1760000000000 } = await import("../../migrations/1760000000000-Carts");
  const { Orders1760010000000 } = await import("../../migrations/1760010000000-Orders");
  const { IdempotencyKeys1760020000000 } = await import("../../migrations/1760020000000-IdempotencyKeys");
  const { Discounts1760100000000 } = await import("../../migrations/1760100000000-Discounts");
  const { Disputes1760200000000 } = await import("../../migrations/1760200000000-Disputes");
  const { Payouts1760300000000 } = await import("../../migrations/1760300000000-Payouts");
  const { Notifications1760400000000 } = await import("../../migrations/1760400000000-Notifications");
  const { Shipments1760500000000 } = await import("../../migrations/1760500000000-Shipments");
  const { SellerWebhooks1760600000000 } = await import("../../migrations/1760600000000-SellerWebhooks");
  const { WebhookDeliveries1760600000001 } = await import("../../migrations/1760600000001-WebhookDeliveries");

  dataSource = new DataSource({
    type: "postgres",
    url: container.getConnectionUri(),
    entities: [
      User, Wallet, Transaction, Category, Product, SellerProfile, BuyerProfile,
      Cart, CartItem, Order, OrderItem, IdempotencyKey, Discount, DiscountRedemption, Dispute,
      PayoutRequest, Notification, Shipment, WebhookDelivery,
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
    .overrideProvider(getQueueToken("webhooks"))
    .useValue(webhooksQueue)
    .overrideProvider(WebhookDeliveryProcessor)
    .useValue({})
    .overrideProvider(SettlementsProcessor)
    .useValue({})
    .overrideProvider(DisputesProcessor)
    .useValue({})
    .overrideProvider(PayoutsProcessor)
    .useValue({})
    .overrideProvider(NotificationsProcessor)
    .useValue({})
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

  deliveries = moduleRef.get(WebhookDeliveryService);
  repository = moduleRef.get(WebhookDeliveriesRepository);
});

afterAll(async () => {
  await app?.close();
  await dataSource?.destroy();
  await redisClient.quit().catch(() => undefined);
  await container?.stop();
  await new Promise<void>((resolve, reject) =>
    stub ? stub.close((error) => (error ? reject(error) : resolve())) : resolve(),
  );
});

function client() {
  if (!app) throw new Error("App not initialized");
  return app.inject.bind(app);
}

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

function verified(entry: { signature: string; body: string }): boolean {
  const expected = Buffer.from(
    createHmac("sha256", SECRET).update(entry.body).digest("hex"),
  );
  const actual = Buffer.from(entry.signature);
  return expected.length === actual.length && timingSafeEqual(expected, actual);
}

describe("outbound webhooks", () => {
  let sellerId = "";
  let deadId = "";

  it("registers a seller with a webhook endpoint", async () => {
    const token = await register("hook-seller@tradeloop.test");
    sellerId = await userIdOf(token);
    const onboarded = await client()({
      method: "POST",
      url: "/api/v1/seller/onboard",
      headers: { authorization: `Bearer ${token}` },
      payload: {
        storeName: "Hook Store",
        bankAccountNumber: "0123456789",
        bankCode: "058",
        webhookUrl: `http://127.0.0.1:${stubPort}/hooks`,
        webhookSecret: SECRET,
      },
    });
    expect(onboarded.statusCode).toBe(201);
  });

  it("dispatches signed deliveries to the seller endpoint", async () => {
    const record = await deliveries.dispatch("order.created", sellerId, { orderId: "o-1" });
    expect(record?.status).toBe(WebhookDeliveryStatus.PENDING);
    expect(webhooksQueue.add).toHaveBeenCalledWith(
      "deliver",
      { deliveryId: record?.id },
      expect.anything(),
    );

    expect(await deliveries.deliver(record?.id as string)).toBe("delivered");
    expect(received).toHaveLength(1);
    expect(verified(received[0])).toBe(true);
    expect(JSON.parse(received[0].body)).toMatchObject({
      event: "order.created",
      data: { orderId: "o-1" },
    });
    const stored = await repository.findById(record?.id as string);
    expect(stored?.status).toBe(WebhookDeliveryStatus.DELIVERED);
  });

  it("retries failures into dead letters", async () => {
    const token = await register("dead-seller@tradeloop.test");
    const deadSellerId = await userIdOf(token);
    const onboarded = await client()({
      method: "POST",
      url: "/api/v1/seller/onboard",
      headers: { authorization: `Bearer ${token}` },
      payload: {
        storeName: "Dead Store",
        bankAccountNumber: "0123456789",
        bankCode: "058",
        webhookUrl: "http://127.0.0.1:1/hooks",
        webhookSecret: SECRET,
      },
    });
    expect(onboarded.statusCode).toBe(201);
    const record = await deliveries.dispatch("order.created", deadSellerId, { orderId: "o-9" });
    deadId = record?.id as string;

    let outcome = "";
    for (let i = 0; i < 5; i += 1) {
      try {
        outcome = await deliveries.deliver(deadId);
      } catch {
        outcome = "retrying";
      }
    }
    expect(outcome).toBe("failed");
    const stored = await repository.findById(deadId);
    expect(stored?.status).toBe(WebhookDeliveryStatus.FAILED);
    expect(stored?.attempts).toBe(5);
    expect(stored?.lastError).toBeTruthy();
  });

  it("retries dead letters through the admin endpoint", async () => {
    if (!dataSource) throw new Error("DataSource not initialized");
    const userRepository = dataSource.getRepository(User);
    const admin = userRepository.create({
      email: "hook-admin@tradeloop.test",
      role: UserRole.ADMIN,
    });
    admin.passwordHash = await hash("admin-password");
    await userRepository.save(admin);
    const logged = await client()({
      method: "POST",
      url: "/api/v1/auth/login",
      payload: { email: "hook-admin@tradeloop.test", password: "admin-password" },
    });
    expect(logged.statusCode).toBe(200);
    const adminToken = logged.json().data.accessToken as string;

    const res = await client()({
      method: "PATCH",
      url: `/api/v1/admin/webhook-deliveries/${deadId}/retry`,
      headers: { authorization: `Bearer ${adminToken}` },
    });
    expect(res.statusCode).toBe(200);
    expect(res.json().data.status).toBe(WebhookDeliveryStatus.PENDING);
    expect(webhooksQueue.add).toHaveBeenCalledWith(
      "deliver",
      { deliveryId: deadId },
      expect.anything(),
    );
  });

  it("rejects admin retry on live rows", async () => {
    await expect(deliveries.retryDelivery("00000000-0000-0000-0000-000000000000")).rejects.toThrow(
      "not found",
    );
  });

  it("requires the admin role for the retry endpoint", async () => {
    const token = await register("plain@tradeloop.test");
    const res = await client()({
      method: "PATCH",
      url: `/api/v1/admin/webhook-deliveries/${deadId}/retry`,
      headers: { authorization: `Bearer ${token}` },
    });
    expect(res.statusCode).toBe(403);
  });
});

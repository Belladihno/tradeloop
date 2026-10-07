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
import { UserRole } from "@tradeloop/types";
import { AppModule } from "../app.module";
import { SnakeNamingStrategy } from "../common/database/snake-naming.strategy";
import { SanitizePipe } from "../common/pipes/sanitize.pipe";
import { User } from "../users/entities/user.entity";
import { Init1759400000000 } from "../migrations/1759400000000-Init";
import { CreateUsers1759500000000 } from "../migrations/1759500000000-CreateUsers";
import { REDIS_CLIENT } from "../redis/redis.module";
import { Wallet } from "../wallet/entities/wallet.entity";
import { Transaction } from "../wallet/entities/transaction.entity";
import { Category } from "../categories/entities/category.entity";
import { Product } from "../products/entities/product.entity";
import { SellerProfile } from "../seller-profiles/entities/seller-profile.entity";
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
import { Shipment } from "../logistics/entities/shipment.entity";
import { WebhookDelivery } from "../webhooks/outbound/entities/webhook-delivery.entity";
import { FraudRule } from "./entities/fraud-rule.entity";
import { FlaggedEvent } from "./entities/flagged-event.entity";
import { FraudService } from "./fraud.service";
import { FlaggedEventsRepository } from "./flagged-events.repository";
import { DisputesProcessor } from "../disputes/disputes.processor";
import { SettlementsProcessor } from "../settlement/settlements.processor";
import { PayoutsProcessor } from "../payouts/payouts.processor";
import { NotificationsProcessor } from "../notifications/notifications.processor";
import { WebhookDeliveryProcessor } from "../webhooks/outbound/webhook-delivery.processor";
import { startTestDatabase, type TestDatabase } from "../test/test-database";

vi.setConfig({ testTimeout: 120_000, hookTimeout: 180_000 });

let app: NestFastifyApplication | undefined;
let container: TestDatabase | undefined;
let dataSource: DataSource | undefined;
let fraud: FraudService;
let flagged: FlaggedEventsRepository;

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
  const { Fraud1760700000000 } = await import("../migrations/1760700000000-Fraud");

  dataSource = new DataSource({
    type: "postgres",
    url: container.getConnectionUri(),
    entities: [
      User, Wallet, Transaction, Category, Product, SellerProfile, BuyerProfile,
      Cart, CartItem, Order, OrderItem, IdempotencyKey, Discount, DiscountRedemption, Dispute,
      PayoutRequest, Notification, Shipment, WebhookDelivery, FraudRule, FlaggedEvent,
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
    .overrideProvider(WebhookDeliveryProcessor)
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

  fraud = moduleRef.get(FraudService);
  flagged = moduleRef.get(FlaggedEventsRepository);

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

async function login(email: string, password: string) {
  return client()({
    method: "POST",
    url: "/api/v1/auth/login",
    payload: { email, password },
  });
}

describe("fraud", () => {
  let adminToken = "";

  it("seeds the seven default rules enabled", async () => {
    const rules = await fraud.listRules();
    expect(rules).toHaveLength(7);
    expect(rules.every((rule) => rule.enabled)).toBe(true);
  });

  it("flags login bursts without revealing the cause", async () => {
    for (let i = 0; i < 6; i += 1) {
      const res = await login("nobody@tradeloop.test", "wrong-password");
      expect(res.statusCode).toBe(401);
    }
    const events = await flagged.list();
    const burst = events.find((event) => event.ruleName === "login-burst");
    expect(burst?.key).toBe("nobody@tradeloop.test");
  });

  it("flags velocity and anomaly through the service", async () => {
    const run = Date.now().toString(36);
    for (let i = 0; i < 10; i += 1) {
      await fraud.screenOrder(`velocity-buyer-${run}`, 1000);
    }
    const velocity = await fraud.screenOrder(`velocity-buyer-${run}`, 1000);
    expect(velocity.suspicious).toBe(true);
    expect(velocity.rule).toBe("order-velocity");

    for (let i = 0; i < 3; i += 1) {
      await fraud.checkAmountAnomaly(`rich-buyer-${run}`, 10000);
    }
    const anomaly = await fraud.checkAmountAnomaly(`rich-buyer-${run}`, 50000);
    expect(anomaly.suspicious).toBe(true);
  });

  it("serves the admin fraud dashboard", async () => {
    const logged = await login("admin@tradeloop.test", "admin-password");
    expect(logged.statusCode).toBe(200);
    adminToken = logged.json().data.accessToken as string;
    const auth = { authorization: `Bearer ${adminToken}` };

    const rules = await client()({ method: "GET", url: "/api/v1/admin/fraud/rules", headers: auth });
    expect(rules.statusCode).toBe(200);
    expect(rules.json().data).toHaveLength(7);

    const events = await client()({
      method: "GET",
      url: "/api/v1/admin/fraud/events",
      headers: auth,
    });
    expect(events.statusCode).toBe(200);
    expect(events.json().data.length).toBeGreaterThanOrEqual(2);

    const disabled = await client()({
      method: "PATCH",
      url: "/api/v1/admin/fraud/rules/login-burst",
      headers: auth,
      payload: { enabled: false },
    });
    expect(disabled.statusCode).toBe(200);
    expect(disabled.json().data.enabled).toBe(false);

    const missing = await client()({
      method: "PATCH",
      url: "/api/v1/admin/fraud/rules/nope",
      headers: auth,
      payload: { enabled: false },
    });
    expect(missing.statusCode).toBe(404);
  });
});

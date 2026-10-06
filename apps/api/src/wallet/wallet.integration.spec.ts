import Redis from "ioredis";
import { startTestDatabase, type TestDatabase } from "../test/test-database";
import type { NestFastifyApplication } from "@nestjs/platform-fastify";
import { FastifyAdapter } from "@nestjs/platform-fastify";
import { ThrottlerGuard } from "@nestjs/throttler";
import { Test } from "@nestjs/testing";
import { ZodValidationPipe } from "nestjs-zod";
import { DataSource } from "typeorm";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { TransactionStatus, TransactionType, WalletType } from "@tradeloop/types";
import { AppModule } from "../app.module";
import { SnakeNamingStrategy } from "../common/database/snake-naming.strategy";
import { InsufficientFundsException } from "../common/exceptions/insufficient-funds.exception";
import { SanitizePipe } from "../common/pipes/sanitize.pipe";
import { User } from "../users/entities/user.entity";
import { Init1759400000000 } from "../migrations/1759400000000-Init";
import { CreateUsers1759500000000 } from "../migrations/1759500000000-CreateUsers";
import { ConfigService } from "@nestjs/config";
import { REDIS_CLIENT } from "../redis/redis.module";
import { Transaction } from "./entities/transaction.entity";
import { Wallet } from "./entities/wallet.entity";
import { WalletRepository } from "./wallet.repository";
import { WalletService } from "./wallet.service";

vi.setConfig({ testTimeout: 120_000, hookTimeout: 180_000 });

let container: TestDatabase | undefined;
let dataSource: DataSource | undefined;
let app: NestFastifyApplication | undefined;
let repository: WalletRepository;
let service: WalletService;

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

  dataSource = new DataSource({
    type: "postgres",
    url: container.getConnectionUri(),
    entities: [User, Wallet, Transaction],
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
    ],
    namingStrategy: new SnakeNamingStrategy(),
    synchronize: false,
  });
  await dataSource.initialize();
  await dataSource.runMigrations();
  await dataSource.query(
    `INSERT INTO "users" ("id", "email") VALUES
      ('01a0ffa2-e0d0-7736-be4b-2fe8db53aec1', 'wallet-test-1@tradeloop.test'),
      ('01a0ffa2-e0d0-7736-be4b-2fe8db53aec2', 'wallet-test-2@tradeloop.test')
     ON CONFLICT ("id") DO NOTHING`,
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
  );
  app.setGlobalPrefix("api/v1");
  app.useGlobalPipes(new ZodValidationPipe(), new SanitizePipe());
  await app.init();
  await app.getHttpAdapter().getInstance().ready();

  repository = moduleRef.get(WalletRepository);
  service = moduleRef.get(WalletService);
});

afterAll(async () => {
  await app?.close();
  await dataSource?.destroy();
  await redisClient.quit().catch(() => undefined);
  await container?.stop();
});

async function fundWallet(walletId: string, amount: string): Promise<void> {
  if (!dataSource) throw new Error("DataSource not initialized");
  const platform = await repository.findSystemWallet(WalletType.PLATFORM);
  if (!platform) throw new Error("Platform wallet not seeded");
  const runner = dataSource.createQueryRunner();
  await runner.connect();
  await runner.startTransaction();
  try {
    await repository.creditAtomic(walletId, amount, runner);
    await repository.recordTransaction(
      {
        fromWalletId: platform.id,
        toWalletId: walletId,
        amount,
        type: TransactionType.WALLET_FUND,
        referenceId: platform.id,
        referenceType: "WalletFund",
      },
      runner,
    );
    await runner.commitTransaction();
  } catch (error) {
    await runner.rollbackTransaction();
    throw error;
  } finally {
    await runner.release();
  }
}

describe("wallet ledger", () => {
  it("seeds platform and escrow system wallets at zero", async () => {
    const platform = await repository.findSystemWallet(WalletType.PLATFORM);
    const escrow = await repository.findSystemWallet(WalletType.ESCROW);

    expect(platform?.balance).toBe("0.00");
    expect(escrow?.balance).toBe("0.00");
    expect(platform?.userId).toBeNull();
  });

  it("creates a buyer wallet lazily on first balance read", async () => {
    const balance = await service.getBalance("01a0ffa2-e0d0-7736-be4b-2fe8db53aec1");

    expect(balance).toBe("0.00");
  });

  it("allows only one of two concurrent debits to exceed the balance", async () => {
    const wallet = await service.ensureBuyerWallet(
      "01a0ffa2-e0d0-7736-be4b-2fe8db53aec2",
    );
    await fundWallet(wallet.id, "100.00");

    const ds = dataSource;
    if (!ds) throw new Error("DataSource not initialized");
    const escrow = await repository.findSystemWallet(WalletType.ESCROW);
    if (!escrow) throw new Error("Escrow wallet not seeded");
    const attempt = async (): Promise<void> => {
      const runner = ds.createQueryRunner();
      await runner.connect();
      await runner.startTransaction();
      try {
        await repository.debitAtomic(wallet.id, "80.00", runner);
        await repository.recordTransaction(
          {
            fromWalletId: wallet.id,
            toWalletId: escrow.id,
            amount: "80.00",
            type: TransactionType.ESCROW_HOLD,
            referenceId: wallet.id,
            referenceType: "TestHold",
          },
          runner,
        );
        await runner.commitTransaction();
      } catch (error) {
        await runner.rollbackTransaction();
        throw error;
      } finally {
        await runner.release();
      }
    };

    const [first, second] = await Promise.allSettled([attempt(), attempt()]);
    const fulfilled = [first, second].filter((r) => r.status === "fulfilled");
    const rejected = [first, second].filter((r) => r.status === "rejected");

    expect(fulfilled).toHaveLength(1);
    expect(rejected).toHaveLength(1);
    expect((rejected[0] as PromiseRejectedResult).reason).toBeInstanceOf(
      InsufficientFundsException,
    );

    const updated = await repository.findByUserAndType(
      "01a0ffa2-e0d0-7736-be4b-2fe8db53aec2",
      WalletType.BUYER,
    );
    expect(updated?.balance).toBe("20.00");
  });

  it("reconstructs the cached balance from the transaction log", async () => {
    const wallet = await repository.findByUserAndType(
      "01a0ffa2-e0d0-7736-be4b-2fe8db53aec2",
      WalletType.BUYER,
    );
    if (!wallet || !dataSource) throw new Error("Test wallet not initialized");
    const runner = dataSource.createQueryRunner();
    await runner.connect();
    try {
      const computed = await repository.verifyBalance(wallet.id, runner);
      expect(Number(computed)).toBe(Number(wallet.balance));
      expect(wallet.balance).toBe("20.00");
    } finally {
      await runner.release();
    }
  });

  it("ignores non-completed transactions during verification", async () => {
    if (!dataSource) throw new Error("DataSource not initialized");
    await dataSource.query(
      `INSERT INTO "wallets" ("id", "user_id", "type", "balance") VALUES
        ('01a0ffa2-e166-7738-8f2c-1d9e28dd86d0', NULL, 'BUYER', '0.00')
       ON CONFLICT ("id") DO NOTHING`,
    );
    const stored = await dataSource.getRepository(Transaction).save(
      dataSource.getRepository(Transaction).create({
        fromWalletId: "01a0ffa2-e0d0-7736-be4b-2fe8db53aec0",
        toWalletId: "01a0ffa2-e166-7738-8f2c-1d9e28dd86d0",
        amount: "999.00",
        type: TransactionType.ESCROW_HOLD,
        status: TransactionStatus.PENDING,
        referenceId: "01a0ffa2-e0d0-7736-be4b-2fe8db53aec0",
        referenceType: "Order",
      }),
    );
    const runner = dataSource.createQueryRunner();
    await runner.connect();
    try {
      const computed = await repository.verifyBalance(
        "01a0ffa2-e166-7738-8f2c-1d9e28dd86d0",
        runner,
      );
      expect(Number(computed)).toBe(0);
    } finally {
      await runner.release();
      await dataSource.getRepository(Transaction).delete(stored.id);
    }
  });
});

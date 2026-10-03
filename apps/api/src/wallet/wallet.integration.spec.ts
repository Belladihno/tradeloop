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
import { TransactionStatus, TransactionType, WalletType } from "@tradeloop/types";
import { AppModule } from "../app.module";
import { SnakeNamingStrategy } from "../common/database/snake-naming.strategy";
import { InsufficientFundsException } from "../common/exceptions/insufficient-funds.exception";
import { SanitizePipe } from "../common/pipes/sanitize.pipe";
import { User } from "../users/entities/user.entity";
import { Init1759400000000 } from "../migrations/1759400000000-Init";
import { CreateUsers1759500000000 } from "../migrations/1759500000000-CreateUsers";
import { REDIS_CLIENT } from "../redis/redis.module";
import { Transaction } from "./entities/transaction.entity";
import { Wallet } from "./entities/wallet.entity";
import { WalletRepository } from "./wallet.repository";
import { WalletService } from "./wallet.service";

vi.setConfig({ testTimeout: 120_000, hookTimeout: 180_000 });

let container: StartedPostgreSqlContainer | undefined;
let dataSource: DataSource | undefined;
let repository: WalletRepository;
let service: WalletService;

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

  dataSource = new DataSource({
    type: "postgres",
    url: container.getConnectionUri(),
    entities: [User, Wallet, Transaction],
    migrations: [
      Init1759400000000,
      CreateUsers1759500000000,
      (await import("../migrations/1759600000000-Wallets")).Wallets1759600000000,
    ],
    namingStrategy: new SnakeNamingStrategy(),
    synchronize: false,
  });
  await dataSource.initialize();
  await dataSource.runMigrations();

  const moduleRef = await Test.createTestingModule({ imports: [AppModule] })
    .overrideProvider(REDIS_CLIENT)
    .useValue(redisFake)
    .overrideGuard(ThrottlerGuard)
    .useValue({ canActivate: () => true })
    .compile();

  const app = moduleRef.createNestApplication<NestFastifyApplication>(
    new FastifyAdapter(),
  );
  app.setGlobalPrefix("api/v1");
  app.useGlobalPipes(new ZodValidationPipe(), new SanitizePipe());
  await app.init();
  await app.getHttpAdapter().getInstance().ready();
  await app.close();

  repository = moduleRef.get(WalletRepository);
  service = moduleRef.get(WalletService);
});

afterAll(async () => {
  await dataSource?.destroy();
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
    const stored = await dataSource.getRepository(Transaction).save(
      dataSource.getRepository(Transaction).create({
        fromWalletId: "01a0ffa2-e0d0-7736-be4b-2fe8db53aec0",
        toWalletId: "01a0ffa2-e166-7738-8f2c-1d9e28dd86c9",
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
        "01a0ffa2-e166-7738-8f2c-1d9e28dd86c9",
        runner,
      );
      expect(Number(computed)).toBe(0);
    } finally {
      await runner.release();
      await dataSource.getRepository(Transaction).delete(stored.id);
    }
  });
});

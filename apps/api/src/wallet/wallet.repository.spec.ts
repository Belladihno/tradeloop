import { describe, expect, it, vi, type Mock } from "vitest";
import type { QueryRunner } from "typeorm";
import { TransactionType, WalletType } from "@tradeloop/types";
import { InsufficientFundsException } from "../common/exceptions/insufficient-funds.exception";
import { WalletRepository } from "./wallet.repository";

function runner(queryImpl?: (sql: string, params: unknown[]) => unknown) {
  return {
    query: vi.fn(queryImpl ?? (async () => [])),
  } as unknown as QueryRunner & { query: Mock };
}

function setup() {
  const wallets = { findOne: vi.fn(), create: vi.fn(), save: vi.fn() };
  const transactions = { findOne: vi.fn(), create: vi.fn(), save: vi.fn() };
  const repository = new WalletRepository(
    wallets as never,
    transactions as never,
  );
  return { repository, wallets, transactions };
}

describe("WalletRepository", () => {
  it("debits with a conditional atomic update", async () => {
    const { repository } = setup();
    const queryRunner = runner(async () => [[{ id: "w1" }], 1]);

    await repository.debitAtomic("w1", "80.00", queryRunner);

    const [sql, params] = queryRunner.query.mock.calls[0] as [string, string[]];
    expect(sql).toContain('SET "balance" = "balance" - $1');
    expect(sql).toContain('"balance" >= $1');
    expect(sql).toContain("RETURNING");
    expect(params).toEqual(["80.00", "w1"]);
  });

  it("throws insufficient funds when the conditional update matches nothing", async () => {
    const { repository } = setup();
    const queryRunner = runner(async () => [[], 0]);

    await expect(repository.debitAtomic("w1", "80.00", queryRunner)).rejects.toBeInstanceOf(
      InsufficientFundsException,
    );
  });

  it("credits unconditionally within the caller's transaction", async () => {
    const { repository } = setup();
    const queryRunner = runner(async () => []);

    await repository.creditAtomic("w1", "100.00", queryRunner);

    const [sql, params] = queryRunner.query.mock.calls[0] as [string, string[]];
    expect(sql).toContain('SET "balance" = "balance" + $1');
    expect(sql).not.toContain("RETURNING");
    expect(params).toEqual(["100.00", "w1"]);
  });

  it("records completed transactions through the same runner", async () => {
    const { repository } = setup();
    const manager = {
      create: vi.fn((_target: unknown, data: unknown) => data),
      save: vi.fn(async (entity: unknown) => entity),
    };
    const queryRunner = { manager } as unknown as QueryRunner;

    await repository.recordTransaction(
      {
        fromWalletId: "w1",
        toWalletId: "w2",
        amount: "100.00",
        type: TransactionType.WALLET_FUND,
        referenceId: "ref-1",
        referenceType: "WalletFund",
      },
      queryRunner,
    );

    expect(manager.save).toHaveBeenCalledWith(
      expect.objectContaining({ amount: "100.00", type: TransactionType.WALLET_FUND }),
    );
  });

  it("creates user wallets with a zero balance", async () => {
    const { repository, wallets } = setup();
    wallets.create.mockImplementation((_: unknown, data: unknown) => data);
    wallets.save.mockImplementation(async (entity: unknown) => entity);

    await repository.createUserWallet("u1", WalletType.BUYER);

    expect(wallets.create).toHaveBeenCalledWith(
      expect.objectContaining({ userId: "u1", type: WalletType.BUYER, balance: "0.00" }),
    );
  });
});

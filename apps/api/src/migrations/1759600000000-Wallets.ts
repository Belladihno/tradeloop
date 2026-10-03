import type { MigrationInterface, QueryRunner } from "typeorm";

const PLATFORM_WALLET_ID = "01a0ffa2-e0d0-7736-be4b-2fe8db53aec0";
const ESCROW_WALLET_ID = "01a0ffa2-e166-7738-8f2c-1d9e28dd86c9";

export class Wallets1759600000000 implements MigrationInterface {
  public readonly name = "Wallets1759600000000";

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `CREATE TYPE "wallet_type" AS ENUM ('BUYER', 'SELLER', 'PLATFORM', 'ESCROW')`,
    );
    await queryRunner.query(
      `CREATE TYPE "transaction_type" AS ENUM ('ESCROW_HOLD', 'ESCROW_RELEASE', 'COMMISSION', 'PAYOUT', 'REFUND', 'WALLET_FUND')`,
    );
    await queryRunner.query(
      `CREATE TYPE "transaction_status" AS ENUM ('PENDING', 'COMPLETED', 'REVERSED')`,
    );
    await queryRunner.query(`
      CREATE TABLE "wallets" (
        "id" uuid NOT NULL PRIMARY KEY,
        "user_id" uuid NULL REFERENCES "users" ("id"),
        "type" "wallet_type" NOT NULL,
        "balance" numeric(14, 2) NOT NULL DEFAULT '0.00',
        "created_at" timestamptz NOT NULL DEFAULT now(),
        "updated_at" timestamptz NOT NULL DEFAULT now(),
        "deleted_at" timestamptz NULL
      )
    `);
    await queryRunner.query(
      `CREATE UNIQUE INDEX "wallets_user_type_unique" ON "wallets" ("user_id", "type") WHERE "user_id" IS NOT NULL AND "deleted_at" IS NULL`,
    );
    await queryRunner.query(
      `CREATE UNIQUE INDEX "wallets_system_type_unique" ON "wallets" ("type") WHERE "user_id" IS NULL`,
    );
    await queryRunner.query(`
      CREATE TABLE "transactions" (
        "id" uuid NOT NULL PRIMARY KEY,
        "from_wallet_id" uuid NOT NULL REFERENCES "wallets" ("id"),
        "to_wallet_id" uuid NOT NULL REFERENCES "wallets" ("id"),
        "amount" numeric(14, 2) NOT NULL,
        "type" "transaction_type" NOT NULL,
        "status" "transaction_status" NOT NULL DEFAULT 'COMPLETED',
        "reference_id" uuid NOT NULL,
        "reference_type" varchar(32) NOT NULL,
        "created_at" timestamptz NOT NULL DEFAULT now(),
        "updated_at" timestamptz NOT NULL DEFAULT now(),
        "deleted_at" timestamptz NULL
      )
    `);
    await queryRunner.query(
      `INSERT INTO "wallets" ("id", "user_id", "type", "balance") VALUES ('${PLATFORM_WALLET_ID}', NULL, 'PLATFORM', '0.00'), ('${ESCROW_WALLET_ID}', NULL, 'ESCROW', '0.00')`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE "transactions"`);
    await queryRunner.query(`DROP TABLE "wallets"`);
    await queryRunner.query(`DROP TYPE "transaction_status"`);
    await queryRunner.query(`DROP TYPE "transaction_type"`);
    await queryRunner.query(`DROP TYPE "wallet_type"`);
  }
}

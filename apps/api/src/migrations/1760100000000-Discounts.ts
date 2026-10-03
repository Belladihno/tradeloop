import type { MigrationInterface, QueryRunner } from "typeorm";

export class Discounts1760100000000 implements MigrationInterface {
  public readonly name = "Discounts1760100000000";

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `CREATE TYPE "discount_type" AS ENUM ('PERCENTAGE', 'FLAT_AMOUNT')`,
    );
    await queryRunner.query(
      `CREATE TYPE "discount_scope" AS ENUM ('PLATFORM', 'SELLER', 'PRODUCT', 'CATEGORY')`,
    );
    await queryRunner.query(`
      CREATE TABLE "discounts" (
        "id" uuid NOT NULL PRIMARY KEY,
        "code" varchar(20) NULL,
        "type" "discount_type" NOT NULL,
        "value" numeric(14, 2) NOT NULL,
        "scope" "discount_scope" NOT NULL,
        "scope_id" uuid NULL,
        "created_by" uuid NOT NULL REFERENCES "users" ("id"),
        "minimum_order_value" numeric(14, 2) NULL,
        "max_usage_count" integer NULL,
        "max_usage_per_user" integer NULL,
        "usage_count" integer NOT NULL DEFAULT 0,
        "is_active" boolean NOT NULL DEFAULT true,
        "starts_at" timestamptz NOT NULL,
        "expires_at" timestamptz NULL,
        "created_at" timestamptz NOT NULL DEFAULT now(),
        "updated_at" timestamptz NOT NULL DEFAULT now(),
        "deleted_at" timestamptz NULL
      )
    `);
    await queryRunner.query(
      `CREATE UNIQUE INDEX "discounts_code_unique" ON "discounts" ("code")`,
    );
    await queryRunner.query(`
      CREATE TABLE "discount_redemptions" (
        "id" uuid NOT NULL PRIMARY KEY,
        "discount_id" uuid NOT NULL REFERENCES "discounts" ("id"),
        "order_id" uuid NOT NULL REFERENCES "orders" ("id"),
        "user_id" uuid NOT NULL REFERENCES "users" ("id"),
        "amount_deducted" numeric(14, 2) NOT NULL,
        "ip_address" varchar(45) NULL,
        "user_agent" varchar(255) NULL,
        "created_at" timestamptz NOT NULL DEFAULT now(),
        "updated_at" timestamptz NOT NULL DEFAULT now(),
        "deleted_at" timestamptz NULL
      )
    `);
    await queryRunner.query(
      `CREATE INDEX "discount_redemptions_discount_user_idx" ON "discount_redemptions" ("discount_id", "user_id")`,
    );
    await queryRunner.query(
      `ALTER TABLE "orders" ADD COLUMN "discount_id" uuid NULL REFERENCES "discounts" ("id")`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "orders" DROP COLUMN "discount_id"`);
    await queryRunner.query(`DROP TABLE "discount_redemptions"`);
    await queryRunner.query(`DROP TABLE "discounts"`);
    await queryRunner.query(`DROP TYPE "discount_scope"`);
    await queryRunner.query(`DROP TYPE "discount_type"`);
  }
}

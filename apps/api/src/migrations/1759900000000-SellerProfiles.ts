import type { MigrationInterface, QueryRunner } from "typeorm";

export class SellerProfiles1759900000000 implements MigrationInterface {
  public readonly name = "SellerProfiles1759900000000";

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `CREATE TYPE "seller_status" AS ENUM ('PENDING_VERIFICATION', 'UNDER_REVIEW', 'ACTIVE', 'SUSPENDED')`,
    );
    await queryRunner.query(`
      CREATE TABLE "seller_profiles" (
        "id" uuid NOT NULL PRIMARY KEY,
        "user_id" uuid NOT NULL REFERENCES "users" ("id"),
        "store_name" varchar(100) NOT NULL,
        "bank_account_number" varchar NULL,
        "bank_code" varchar(6) NULL,
        "commission_rate" numeric(5, 4) NOT NULL DEFAULT '0.1000',
        "status" "seller_status" NOT NULL DEFAULT 'PENDING_VERIFICATION',
        "rejection_reason" text NULL,
        "created_at" timestamptz NOT NULL DEFAULT now(),
        "updated_at" timestamptz NOT NULL DEFAULT now(),
        "deleted_at" timestamptz NULL
      )
    `);
    await queryRunner.query(
      `CREATE UNIQUE INDEX "seller_profiles_user_unique" ON "seller_profiles" ("user_id") WHERE "deleted_at" IS NULL`,
    );
    await queryRunner.query(
      `CREATE UNIQUE INDEX "seller_profiles_store_name_unique" ON "seller_profiles" ("store_name") WHERE "deleted_at" IS NULL`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE "seller_profiles"`);
    await queryRunner.query(`DROP TYPE "seller_status"`);
  }
}

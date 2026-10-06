import type { MigrationInterface, QueryRunner } from "typeorm";

export class Payouts1760300000000 implements MigrationInterface {
  public readonly name = "Payouts1760300000000";

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `CREATE TYPE "payout_status" AS ENUM ('PENDING', 'APPROVED', 'PROCESSING', 'COMPLETED', 'FAILED', 'REJECTED')`,
    );
    await queryRunner.query(`
      CREATE TABLE "payout_requests" (
        "id" uuid NOT NULL PRIMARY KEY,
        "seller_id" uuid NOT NULL REFERENCES "users" ("id"),
        "amount" numeric(14, 2) NOT NULL,
        "status" "payout_status" NOT NULL DEFAULT 'PENDING',
        "bank_code" varchar(6) NOT NULL,
        "bank_account_last4" varchar(4) NOT NULL,
        "admin_id" uuid NULL REFERENCES "users" ("id"),
        "resolved_at" timestamptz NULL,
        "failure_reason" text NULL,
        "job_id" varchar(100) NULL,
        "created_at" timestamptz NOT NULL DEFAULT now(),
        "updated_at" timestamptz NOT NULL DEFAULT now(),
        "deleted_at" timestamptz NULL
      )
    `);
    await queryRunner.query(
      `CREATE INDEX "payout_requests_seller_idx" ON "payout_requests" ("seller_id")`,
    );
    await queryRunner.query(
      `CREATE INDEX "payout_requests_status_idx" ON "payout_requests" ("status") WHERE "status" IN ('PENDING', 'APPROVED', 'PROCESSING')`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE "payout_requests"`);
    await queryRunner.query(`DROP TYPE "payout_status"`);
  }
}

import type { MigrationInterface, QueryRunner } from "typeorm";

export class Disputes1760200000000 implements MigrationInterface {
  public readonly name = "Disputes1760200000000";

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `CREATE TYPE "dispute_status" AS ENUM ('OPEN', 'UNDER_REVIEW', 'RESOLVED_BUYER', 'RESOLVED_SELLER', 'EXPIRED')`,
    );
    await queryRunner.query(`
      CREATE TABLE "disputes" (
        "id" uuid NOT NULL PRIMARY KEY,
        "order_id" uuid NOT NULL REFERENCES "orders" ("id"),
        "raised_by" uuid NOT NULL REFERENCES "users" ("id"),
        "reason" text NOT NULL,
        "status" "dispute_status" NOT NULL DEFAULT 'OPEN',
        "admin_id" uuid NULL REFERENCES "users" ("id"),
        "resolved_at" timestamptz NULL,
        "expiry_job_id" varchar(100) NULL,
        "expires_at" timestamptz NOT NULL,
        "created_at" timestamptz NOT NULL DEFAULT now(),
        "updated_at" timestamptz NOT NULL DEFAULT now(),
        "deleted_at" timestamptz NULL
      )
    `);
    await queryRunner.query(
      `CREATE INDEX "disputes_order_idx" ON "disputes" ("order_id")`,
    );
    await queryRunner.query(
      `CREATE INDEX "disputes_expires_idx" ON "disputes" ("expires_at") WHERE "status" IN ('OPEN', 'UNDER_REVIEW')`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE "disputes"`);
    await queryRunner.query(`DROP TYPE "dispute_status"`);
  }
}

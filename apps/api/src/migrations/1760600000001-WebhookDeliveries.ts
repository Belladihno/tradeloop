import type { MigrationInterface, QueryRunner } from "typeorm";

export class WebhookDeliveries1760600000001 implements MigrationInterface {
  public readonly name = "WebhookDeliveries1760600000001";

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `CREATE TYPE "webhook_delivery_status" AS ENUM ('PENDING', 'DELIVERED', 'FAILED')`,
    );
    await queryRunner.query(`
      CREATE TABLE "webhook_deliveries" (
        "id" uuid NOT NULL PRIMARY KEY,
        "seller_id" uuid NOT NULL REFERENCES "users" ("id"),
        "event_type" varchar(50) NOT NULL,
        "payload" jsonb NOT NULL,
        "target_url" varchar(500) NOT NULL,
        "status" "webhook_delivery_status" NOT NULL DEFAULT 'PENDING',
        "attempts" int NOT NULL DEFAULT 0,
        "last_error" text NULL,
        "created_at" timestamptz NOT NULL DEFAULT now(),
        "updated_at" timestamptz NOT NULL DEFAULT now(),
        "deleted_at" timestamptz NULL
      )
    `);
    await queryRunner.query(
      `CREATE INDEX "webhook_deliveries_seller_idx" ON "webhook_deliveries" ("seller_id", "status")`,
    );
    await queryRunner.query(
      `CREATE INDEX "webhook_deliveries_status_idx" ON "webhook_deliveries" ("status") WHERE "status" = 'PENDING'`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE "webhook_deliveries"`);
    await queryRunner.query(`DROP TYPE "webhook_delivery_status"`);
  }
}

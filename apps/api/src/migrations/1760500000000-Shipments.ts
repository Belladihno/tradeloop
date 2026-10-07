import type { MigrationInterface, QueryRunner } from "typeorm";

export class Shipments1760500000000 implements MigrationInterface {
  public readonly name = "Shipments1760500000000";

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `CREATE TYPE "shipment_status" AS ENUM ('PENDING', 'PICKED_UP', 'IN_TRANSIT', 'OUT_FOR_DELIVERY', 'DELIVERED', 'EXCEPTION', 'CANCELLED')`,
    );
    await queryRunner.query(`
      CREATE TABLE "shipments" (
        "id" uuid NOT NULL PRIMARY KEY,
        "order_id" uuid NOT NULL UNIQUE REFERENCES "orders" ("id"),
        "provider" varchar(20) NOT NULL,
        "tracking_number" varchar(100) NOT NULL UNIQUE,
        "status" "shipment_status" NOT NULL DEFAULT 'PENDING',
        "rate_amount" numeric(14, 2) NOT NULL,
        "created_at" timestamptz NOT NULL DEFAULT now(),
        "updated_at" timestamptz NOT NULL DEFAULT now(),
        "deleted_at" timestamptz NULL
      )
    `);
    await queryRunner.query(
      `CREATE INDEX "shipments_order_idx" ON "shipments" ("order_id")`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE "shipments"`);
    await queryRunner.query(`DROP TYPE "shipment_status"`);
  }
}

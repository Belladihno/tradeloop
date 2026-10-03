import type { MigrationInterface, QueryRunner } from "typeorm";

export class Orders1760010000000 implements MigrationInterface {
  public readonly name = "Orders1760010000000";

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `CREATE TYPE "order_status" AS ENUM ('PENDING', 'CONFIRMED', 'SHIPPED', 'DELIVERED', 'COMPLETED', 'CANCELLED', 'DISPUTED')`,
    );
    await queryRunner.query(`
      CREATE TABLE "orders" (
        "id" uuid NOT NULL PRIMARY KEY,
        "buyer_id" uuid NOT NULL REFERENCES "users" ("id"),
        "seller_id" uuid NOT NULL REFERENCES "users" ("id"),
        "status" "order_status" NOT NULL DEFAULT 'PENDING',
        "original_amount" numeric(14, 2) NOT NULL,
        "discounted_amount" numeric(14, 2) NULL,
        "total_amount" numeric(14, 2) NOT NULL,
        "commission_amount" numeric(14, 2) NULL,
        "shipping_address" jsonb NOT NULL,
        "created_at" timestamptz NOT NULL DEFAULT now(),
        "updated_at" timestamptz NOT NULL DEFAULT now(),
        "deleted_at" timestamptz NULL
      )
    `);
    await queryRunner.query(
      `CREATE INDEX "orders_buyer_idx" ON "orders" ("buyer_id", "created_at" DESC)`,
    );
    await queryRunner.query(
      `CREATE INDEX "orders_seller_idx" ON "orders" ("seller_id", "created_at" DESC)`,
    );
    await queryRunner.query(`
      CREATE TABLE "order_items" (
        "id" uuid NOT NULL PRIMARY KEY,
        "order_id" uuid NOT NULL REFERENCES "orders" ("id"),
        "product_id" uuid NOT NULL REFERENCES "products" ("id"),
        "quantity" integer NOT NULL,
        "unit_price" numeric(14, 2) NOT NULL,
        "product_name" varchar(200) NOT NULL,
        "created_at" timestamptz NOT NULL DEFAULT now(),
        "updated_at" timestamptz NOT NULL DEFAULT now(),
        "deleted_at" timestamptz NULL
      )
    `);
    await queryRunner.query(
      `CREATE INDEX "order_items_order_idx" ON "order_items" ("order_id")`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE "order_items"`);
    await queryRunner.query(`DROP TABLE "orders"`);
    await queryRunner.query(`DROP TYPE "order_status"`);
  }
}

import type { MigrationInterface, QueryRunner } from "typeorm";

export class Carts1760000000000 implements MigrationInterface {
  public readonly name = "Carts1760000000000";

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE "carts" (
        "id" uuid NOT NULL PRIMARY KEY,
        "buyer_id" uuid NOT NULL REFERENCES "users" ("id"),
        "created_at" timestamptz NOT NULL DEFAULT now(),
        "updated_at" timestamptz NOT NULL DEFAULT now(),
        "deleted_at" timestamptz NULL
      )
    `);
    await queryRunner.query(
      `CREATE UNIQUE INDEX "carts_buyer_unique" ON "carts" ("buyer_id") WHERE "deleted_at" IS NULL`,
    );
    await queryRunner.query(`
      CREATE TABLE "cart_items" (
        "id" uuid NOT NULL PRIMARY KEY,
        "cart_id" uuid NOT NULL REFERENCES "carts" ("id") ON DELETE CASCADE,
        "product_id" uuid NOT NULL REFERENCES "products" ("id"),
        "quantity" integer NOT NULL,
        "created_at" timestamptz NOT NULL DEFAULT now(),
        "updated_at" timestamptz NOT NULL DEFAULT now(),
        "deleted_at" timestamptz NULL
      )
    `);
    await queryRunner.query(
      `CREATE UNIQUE INDEX "cart_items_cart_product_unique" ON "cart_items" ("cart_id", "product_id") WHERE "deleted_at" IS NULL`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE "cart_items"`);
    await queryRunner.query(`DROP TABLE "carts"`);
  }
}

import type { MigrationInterface, QueryRunner } from "typeorm";

export class Products1759800000000 implements MigrationInterface {
  public readonly name = "Products1759800000000";

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE "products" (
        "id" uuid NOT NULL PRIMARY KEY,
        "seller_id" uuid NOT NULL REFERENCES "users" ("id"),
        "category_id" uuid NOT NULL REFERENCES "categories" ("id"),
        "name" varchar(200) NOT NULL,
        "slug" varchar(220) NOT NULL,
        "description" text NOT NULL DEFAULT '',
        "price" numeric(14, 2) NOT NULL,
        "stock" integer NOT NULL DEFAULT 0,
        "image_url" varchar NULL,
        "search_vector" tsvector NULL,
        "created_at" timestamptz NOT NULL DEFAULT now(),
        "updated_at" timestamptz NOT NULL DEFAULT now(),
        "deleted_at" timestamptz NULL
      )
    `);
    await queryRunner.query(
      `CREATE UNIQUE INDEX "products_slug_unique" ON "products" ("slug") WHERE "deleted_at" IS NULL`,
    );
    await queryRunner.query(
      `CREATE INDEX "products_category_idx" ON "products" ("category_id") WHERE "deleted_at" IS NULL`,
    );
    await queryRunner.query(
      `CREATE INDEX "products_seller_idx" ON "products" ("seller_id") WHERE "deleted_at" IS NULL`,
    );
    await queryRunner.query(
      `CREATE INDEX "products_price_asc_idx" ON "products" ("price" ASC, "id" ASC) WHERE "deleted_at" IS NULL`,
    );
    await queryRunner.query(
      `CREATE INDEX "products_price_desc_idx" ON "products" ("price" DESC, "id" DESC) WHERE "deleted_at" IS NULL`,
    );
    await queryRunner.query(`
      CREATE FUNCTION "products_search_vector_update"() RETURNS trigger AS $$
      BEGIN
        NEW."search_vector" := to_tsvector('english', coalesce(NEW."name", '') || ' ' || coalesce(NEW."description", ''));
        RETURN NEW;
      END $$ LANGUAGE plpgsql
    `);
    await queryRunner.query(`
      CREATE TRIGGER "products_search_vector_trigger"
      BEFORE INSERT OR UPDATE OF "name", "description" ON "products"
      FOR EACH ROW EXECUTE FUNCTION "products_search_vector_update"()
    `);
    await queryRunner.query(
      `CREATE INDEX "products_search_vector_idx" ON "products" USING GIN ("search_vector")`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TRIGGER "products_search_vector_trigger" ON "products"`);
    await queryRunner.query(`DROP FUNCTION "products_search_vector_update"()`);
    await queryRunner.query(`DROP TABLE "products"`);
  }
}

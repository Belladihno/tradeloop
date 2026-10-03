import type { MigrationInterface, QueryRunner } from "typeorm";

export class Categories1759700000000 implements MigrationInterface {
  public readonly name = "Categories1759700000000";

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE "categories" (
        "id" uuid NOT NULL PRIMARY KEY,
        "name" varchar(120) NOT NULL,
        "slug" varchar(140) NOT NULL,
        "parent_id" uuid NULL REFERENCES "categories" ("id") ON DELETE SET NULL,
        "created_at" timestamptz NOT NULL DEFAULT now(),
        "updated_at" timestamptz NOT NULL DEFAULT now(),
        "deleted_at" timestamptz NULL
      )
    `);
    await queryRunner.query(
      `CREATE UNIQUE INDEX "categories_slug_unique" ON "categories" ("slug") WHERE "deleted_at" IS NULL`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE "categories"`);
  }
}

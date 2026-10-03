import type { MigrationInterface, QueryRunner } from "typeorm";

export class BuyerProfiles1759910000000 implements MigrationInterface {
  public readonly name = "BuyerProfiles1759910000000";

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE "buyer_profiles" (
        "id" uuid NOT NULL PRIMARY KEY,
        "user_id" uuid NOT NULL REFERENCES "users" ("id"),
        "default_shipping_address" jsonb NULL,
        "created_at" timestamptz NOT NULL DEFAULT now(),
        "updated_at" timestamptz NOT NULL DEFAULT now(),
        "deleted_at" timestamptz NULL
      )
    `);
    await queryRunner.query(
      `CREATE UNIQUE INDEX "buyer_profiles_user_unique" ON "buyer_profiles" ("user_id") WHERE "deleted_at" IS NULL`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE "buyer_profiles"`);
  }
}

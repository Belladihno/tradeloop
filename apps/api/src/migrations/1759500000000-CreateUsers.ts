import type { MigrationInterface, QueryRunner } from "typeorm";

export class CreateUsers1759500000000 implements MigrationInterface {
  public readonly name = "CreateUsers1759500000000";

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `CREATE TYPE "user_role" AS ENUM ('BUYER', 'SELLER', 'ADMIN')`,
    );
    await queryRunner.query(`
      CREATE TABLE "users" (
        "id" uuid NOT NULL PRIMARY KEY,
        "email" varchar(320) NOT NULL,
        "password_hash" varchar NULL,
        "google_id" varchar NULL,
        "role" "user_role" NOT NULL DEFAULT 'BUYER',
        "is_verified" boolean NOT NULL DEFAULT false,
        "refresh_token_hash" varchar NULL,
        "created_at" timestamptz NOT NULL DEFAULT now(),
        "updated_at" timestamptz NOT NULL DEFAULT now(),
        "deleted_at" timestamptz NULL
      )
    `);
    await queryRunner.query(
      `CREATE UNIQUE INDEX "users_email_unique" ON "users" ("email") WHERE "deleted_at" IS NULL`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE "users"`);
    await queryRunner.query(`DROP TYPE "user_role"`);
  }
}

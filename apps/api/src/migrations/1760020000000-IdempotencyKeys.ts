import type { MigrationInterface, QueryRunner } from "typeorm";

export class IdempotencyKeys1760020000000 implements MigrationInterface {
  public readonly name = "IdempotencyKeys1760020000000";

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE "idempotency_keys" (
        "id" uuid NOT NULL PRIMARY KEY,
        "idempotency_key" varchar(100) NOT NULL,
        "user_id" uuid NOT NULL REFERENCES "users" ("id") ON DELETE CASCADE,
        "response" jsonb NOT NULL,
        "created_at" timestamptz NOT NULL DEFAULT now(),
        "updated_at" timestamptz NOT NULL DEFAULT now(),
        "deleted_at" timestamptz NULL
      )
    `);
    await queryRunner.query(
      `CREATE UNIQUE INDEX "idempotency_keys_key_user_unique" ON "idempotency_keys" ("idempotency_key", "user_id")`,
    );
    await queryRunner.query(
      `CREATE INDEX "idempotency_keys_created_idx" ON "idempotency_keys" ("created_at")`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE "idempotency_keys"`);
  }
}

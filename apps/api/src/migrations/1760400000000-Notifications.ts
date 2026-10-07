import type { MigrationInterface, QueryRunner } from "typeorm";

export class Notifications1760400000000 implements MigrationInterface {
  public readonly name = "Notifications1760400000000";

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `CREATE TYPE "notification_channel" AS ENUM ('EMAIL', 'IN_APP')`,
    );
    await queryRunner.query(
      `CREATE TYPE "notification_status" AS ENUM ('PENDING', 'SENT', 'FAILED')`,
    );
    await queryRunner.query(`
      CREATE TABLE "notifications" (
        "id" uuid NOT NULL PRIMARY KEY,
        "user_id" uuid NOT NULL REFERENCES "users" ("id"),
        "channel" "notification_channel" NOT NULL,
        "subject" varchar(200) NOT NULL,
        "body" text NOT NULL,
        "data" jsonb NULL,
        "status" "notification_status" NOT NULL DEFAULT 'PENDING',
        "sent_at" timestamptz NULL,
        "created_at" timestamptz NOT NULL DEFAULT now(),
        "updated_at" timestamptz NOT NULL DEFAULT now(),
        "deleted_at" timestamptz NULL
      )
    `);
    await queryRunner.query(
      `CREATE INDEX "notifications_user_idx" ON "notifications" ("user_id")`,
    );
    await queryRunner.query(
      `CREATE INDEX "notifications_status_idx" ON "notifications" ("status") WHERE "status" = 'PENDING'`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE "notifications"`);
    await queryRunner.query(`DROP TYPE "notification_status"`);
    await queryRunner.query(`DROP TYPE "notification_channel"`);
  }
}

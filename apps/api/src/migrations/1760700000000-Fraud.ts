import type { MigrationInterface, QueryRunner } from "typeorm";

const RULES: Array<[string, string, number, string]> = [
  ["order-velocity", "10", 3600, "Flags buyers placing more than 10 orders per hour"],
  ["payout-velocity", "5", 86400, "Flags sellers requesting more than 5 payouts per day"],
  ["amount-anomaly", "3.0", 2592000, "Flags amounts beyond 3x the user's 30-day average"],
  ["new-account-high-value", "100000", 604800, "Flags accounts under 7 days moving 100000 or more"],
  ["login-burst", "5", 600, "Flags more than 5 failed logins per email in 10 minutes"],
  ["discount-abuse", "5", 3600, "Flags users redeeming more than 5 discounts per hour"],
  ["dispute-rate", "0.3", 2592000, "Flags users whose 30-day disputes exceed 30 percent of orders"],
];

export class Fraud1760700000000 implements MigrationInterface {
  public readonly name = "Fraud1760700000000";

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE "fraud_rules" (
        "id" uuid NOT NULL PRIMARY KEY,
        "name" varchar(50) NOT NULL UNIQUE,
        "threshold" numeric(14, 4) NOT NULL,
        "window_seconds" int NOT NULL,
        "enabled" boolean NOT NULL DEFAULT true,
        "description" varchar(500) NOT NULL,
        "created_at" timestamptz NOT NULL DEFAULT now(),
        "updated_at" timestamptz NOT NULL DEFAULT now(),
        "deleted_at" timestamptz NULL
      )
    `);
    await queryRunner.query(`
      CREATE TABLE "flagged_events" (
        "id" uuid NOT NULL PRIMARY KEY,
        "user_id" uuid NULL REFERENCES "users" ("id"),
        "key" varchar(200) NOT NULL,
        "rule_name" varchar(50) NOT NULL,
        "detail" jsonb NULL,
        "created_at" timestamptz NOT NULL DEFAULT now(),
        "updated_at" timestamptz NOT NULL DEFAULT now(),
        "deleted_at" timestamptz NULL
      )
    `);
    await queryRunner.query(
      `CREATE INDEX "flagged_events_user_idx" ON "flagged_events" ("user_id")`,
    );
    await queryRunner.query(
      `CREATE INDEX "flagged_events_rule_idx" ON "flagged_events" ("rule_name")`,
    );
    for (const [name, threshold, windowSeconds, description] of RULES) {
      await queryRunner.query(
        `INSERT INTO "fraud_rules" ("id", "name", "threshold", "window_seconds", "enabled", "description")
         VALUES (gen_random_uuid(), $1, $2, $3, true, $4)`,
        [name, threshold, windowSeconds, description],
      );
    }
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE "flagged_events"`);
    await queryRunner.query(`DROP TABLE "fraud_rules"`);
  }
}

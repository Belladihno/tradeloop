import type { MigrationInterface, QueryRunner } from "typeorm";

export class AuditLogs1760800000000 implements MigrationInterface {
  public readonly name = "AuditLogs1760800000000";

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE "audit_logs" (
        "id" uuid NOT NULL PRIMARY KEY,
        "actor_id" uuid NULL,
        "action" varchar(50) NOT NULL,
        "entity_type" varchar(50) NOT NULL,
        "entity_id" uuid NULL,
        "metadata" jsonb NULL,
        "created_at" timestamptz NOT NULL DEFAULT now(),
        "updated_at" timestamptz NOT NULL DEFAULT now(),
        "deleted_at" timestamptz NULL
      )
    `);
    await queryRunner.query(
      `CREATE INDEX "audit_logs_actor_idx" ON "audit_logs" ("actor_id")`,
    );
    await queryRunner.query(
      `CREATE INDEX "audit_logs_entity_idx" ON "audit_logs" ("entity_type", "entity_id")`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE "audit_logs"`);
  }
}

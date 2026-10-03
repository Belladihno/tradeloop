import type { MigrationInterface, QueryRunner } from "typeorm";

export class Init1759400000000 implements MigrationInterface {
  public readonly name = "Init1759400000000";

  public async up(_queryRunner: QueryRunner): Promise<void> {}

  public async down(_queryRunner: QueryRunner): Promise<void> {}
}

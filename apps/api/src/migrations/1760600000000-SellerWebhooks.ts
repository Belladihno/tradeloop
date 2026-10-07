import type { MigrationInterface, QueryRunner } from "typeorm";

export class SellerWebhooks1760600000000 implements MigrationInterface {
  public readonly name = "SellerWebhooks1760600000000";

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "seller_profiles" ADD "webhook_url" varchar(500) NULL`,
    );
    await queryRunner.query(
      `ALTER TABLE "seller_profiles" ADD "webhook_secret" varchar(500) NULL`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "seller_profiles" DROP COLUMN "webhook_secret"`);
    await queryRunner.query(`ALTER TABLE "seller_profiles" DROP COLUMN "webhook_url"`);
  }
}

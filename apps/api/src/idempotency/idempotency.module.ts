import { Module } from "@nestjs/common";
import { TypeOrmModule } from "@nestjs/typeorm";
import { IdempotencyKey } from "./entities/idempotency-key.entity";
import { IdempotencyKeysRepository } from "./idempotency.repository";
import { IdempotencyService } from "./idempotency.service";

@Module({
  imports: [TypeOrmModule.forFeature([IdempotencyKey])],
  providers: [IdempotencyService, IdempotencyKeysRepository],
  exports: [IdempotencyService],
})
export class IdempotencyModule {}

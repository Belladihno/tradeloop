import { Injectable } from "@nestjs/common";
import { Cron, CronExpression } from "@nestjs/schedule";
import { IdempotencyKeysRepository } from "./idempotency.repository";

@Injectable()
export class IdempotencyService {
  constructor(private readonly keys: IdempotencyKeysRepository) {}

  findResponse(key: string, userId: string): Promise<Record<string, unknown> | null> {
    return this.keys.findValid(key, userId);
  }

  saveResponse(
    key: string,
    userId: string,
    response: Record<string, unknown>,
  ): Promise<Record<string, unknown>> {
    return this.keys.saveIfAbsent(key, userId, response);
  }

  @Cron(CronExpression.EVERY_HOUR)
  async purgeExpired(): Promise<void> {
    await this.keys.purgeExpired();
  }
}

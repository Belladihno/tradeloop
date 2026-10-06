import { Module } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { BullModule } from "@nestjs/bullmq";
import type { Env } from "../config/env.validation";

export const DISPUTE_EXPIRY_DELAY_MS = 7 * 24 * 60 * 60 * 1000;

export function webhookBackoff(attemptsMade: number): number {
  const schedule = [0, 30_000, 300_000, 1_800_000, 7_200_000];
  return schedule[attemptsMade] ?? -1;
}

@Module({
  imports: [
    BullModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService<Env, true>) => ({
        connection: {
          url: config.get("REDIS_URL", { infer: true }),
          maxRetriesPerRequest: null,
        },
      }),
    }),
    BullModule.registerQueue(
      {
        name: "notifications",
        defaultJobOptions: {
          attempts: 3,
          backoff: { type: "fixed", delay: 5_000 },
          removeOnComplete: 200,
          removeOnFail: 1000,
        },
      },
      {
        name: "payouts",
        defaultJobOptions: {
          attempts: 5,
          backoff: { type: "exponential", delay: 10_000 },
          removeOnComplete: 200,
          removeOnFail: 1000,
        },
      },
      {
        name: "disputes",
        defaultJobOptions: {
          attempts: 3,
          backoff: { type: "exponential", delay: 60_000 },
          removeOnComplete: 200,
          removeOnFail: 1000,
        },
      },
      {
        name: "webhooks",
        defaultJobOptions: {
          attempts: 5,
          backoff: { type: "exponential", delay: 30_000 },
          removeOnComplete: 200,
          removeOnFail: 1000,
        },
      },
      {
        name: "settlements",
        defaultJobOptions: {
          attempts: 3,
          backoff: { type: "exponential", delay: 10_000 },
          removeOnComplete: 200,
          removeOnFail: 1000,
        },
      },
    ),
  ],
  exports: [BullModule],
})
export class QueuesModule {}

import { getQueueToken } from "@nestjs/bullmq";
import { createBullBoard } from "@bull-board/api";
import { BullMQAdapter } from "@bull-board/api/bullMQAdapter";
import { FastifyAdapter as BullBoardFastifyAdapter } from "@bull-board/fastify";
import type { NestFastifyApplication } from "@nestjs/platform-fastify";
import type { Queue } from "bullmq";

const QUEUE_NAMES = ["notifications", "payouts", "disputes", "webhooks", "settlements"];

export async function registerBullBoard(app: NestFastifyApplication): Promise<void> {
  const queues = QUEUE_NAMES.map(
    (name) => new BullMQAdapter(app.get<Queue>(getQueueToken(name))),
  );
  const serverAdapter = new BullBoardFastifyAdapter();
  serverAdapter.setBasePath("/admin/queues");
  createBullBoard({ queues, serverAdapter });
  await app.getHttpAdapter().getInstance().register(serverAdapter.registerPlugin(), {
    prefix: "/admin/queues",
  });
}

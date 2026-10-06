import { Processor, WorkerHost } from "@nestjs/bullmq";
import type { Job } from "bullmq";
import { SettlementService } from "./settlement.service";

@Processor("settlements", { concurrency: 5 })
export class SettlementsProcessor extends WorkerHost {
  constructor(private readonly settlement: SettlementService) {
    super();
  }

  async process(job: Job<{ orderId: string }>): Promise<string> {
    return this.settlement.settle(job.data.orderId);
  }
}

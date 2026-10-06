import { Processor, WorkerHost } from "@nestjs/bullmq";
import type { Job } from "bullmq";
import { PayoutsService } from "./payouts.service";

@Processor("payouts", { concurrency: 2 })
export class PayoutsProcessor extends WorkerHost {
  constructor(private readonly payouts: PayoutsService) {
    super();
  }

  async process(job: Job<{ payoutId: string }>): Promise<string> {
    return this.payouts.process(job.data.payoutId);
  }
}

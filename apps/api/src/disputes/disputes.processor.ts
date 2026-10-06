import { Processor, WorkerHost } from "@nestjs/bullmq";
import type { Job } from "bullmq";
import { DisputeService } from "./disputes.service";

@Processor("disputes", { concurrency: 3 })
export class DisputesProcessor extends WorkerHost {
  constructor(private readonly disputes: DisputeService) {
    super();
  }

  async process(job: Job<{ disputeId: string }>): Promise<string> {
    return this.disputes.expire(job.data.disputeId);
  }
}

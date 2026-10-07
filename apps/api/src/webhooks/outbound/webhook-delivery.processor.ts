import { Processor, WorkerHost } from "@nestjs/bullmq";
import type { Job } from "bullmq";
import { WebhookDeliveryService } from "./webhook-delivery.service";

@Processor("webhooks", { concurrency: 5 })
export class WebhookDeliveryProcessor extends WorkerHost {
  constructor(private readonly deliveries: WebhookDeliveryService) {
    super();
  }

  async process(job: Job<{ deliveryId: string }>): Promise<string> {
    return this.deliveries.deliver(job.data.deliveryId);
  }
}

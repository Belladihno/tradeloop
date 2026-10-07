import { Processor, WorkerHost } from "@nestjs/bullmq";
import type { Job } from "bullmq";
import { NotificationsService } from "./notifications.service";

@Processor("notifications", { concurrency: 5 })
export class NotificationsProcessor extends WorkerHost {
  constructor(private readonly notifications: NotificationsService) {
    super();
  }

  async process(job: Job<{ notificationId: string }>): Promise<string> {
    return this.notifications.send(job.data.notificationId);
  }
}

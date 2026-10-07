import { Injectable } from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { IsNull, Repository, type QueryRunner } from "typeorm";
import { WebhookDeliveryStatus } from "@tradeloop/types";
import { WebhookDelivery } from "./entities/webhook-delivery.entity";

@Injectable()
export class WebhookDeliveriesRepository {
  constructor(
    @InjectRepository(WebhookDelivery) private readonly deliveries: Repository<WebhookDelivery>,
  ) {}

  create(data: Partial<WebhookDelivery>, runner?: QueryRunner): Promise<WebhookDelivery> {
    const writer = runner ? runner.manager.getRepository(WebhookDelivery) : this.deliveries;
    return writer.save(this.deliveries.create(data));
  }

  findById(id: string): Promise<WebhookDelivery | null> {
    return this.deliveries.findOne({ where: { id, deletedAt: IsNull() } });
  }

  findFailed(limit = 100): Promise<WebhookDelivery[]> {
    return this.deliveries.find({
      where: { status: WebhookDeliveryStatus.FAILED, deletedAt: IsNull() },
      order: { createdAt: "DESC" },
      take: limit,
    });
  }

  save(delivery: WebhookDelivery, runner?: QueryRunner): Promise<WebhookDelivery> {
    const writer = runner ? runner.manager.getRepository(WebhookDelivery) : this.deliveries;
    return writer.save(delivery);
  }
}

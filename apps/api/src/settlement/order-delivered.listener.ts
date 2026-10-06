import { Injectable, Logger } from "@nestjs/common";
import { OnEvent } from "@nestjs/event-emitter";
import { InjectQueue } from "@nestjs/bullmq";
import type { Queue } from "bullmq";
import {
  ORDER_DELIVERED_EVENT,
  type OrderDeliveredPayload,
} from "../orders/events";

@Injectable()
export class OrderDeliveredListener {
  private readonly logger = new Logger(OrderDeliveredListener.name);

  constructor(
    @InjectQueue("settlements") private readonly settlements: Queue,
  ) {}

  @OnEvent(ORDER_DELIVERED_EVENT, { async: true })
  async handle(payload: OrderDeliveredPayload): Promise<void> {
    await this.settlements.add("settle", { orderId: payload.orderId });
    this.logger.log(`Settlement queued for order ${payload.orderId}`);
  }
}

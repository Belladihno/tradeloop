import {
  ConflictException,
  Inject,
  Injectable,
  Logger,
  NotFoundException,
} from "@nestjs/common";
import { InjectQueue } from "@nestjs/bullmq";
import { createHmac, timingSafeEqual } from "crypto";
import type { Queue } from "bullmq";
import {
  WebhookDeliveryStatus,
  type OutboundWebhookPayload,
  type WebhookEventType,
} from "@tradeloop/types";
import { EncryptionService } from "../../common/crypto/encryption.service";
import { SellerProfilesRepository } from "../../seller-profiles/seller-profiles.repository";
import type { WebhookDelivery } from "./entities/webhook-delivery.entity";
import { WebhookDeliveriesRepository } from "./webhook-deliveries.repository";

const MAX_ATTEMPTS = 5;
const REQUEST_TIMEOUT_MS = 10_000;
const PROCESS_JOB_PREFIX = "webhook-deliver-";

@Injectable()
export class WebhookDeliveryService {
  private readonly logger = new Logger(WebhookDeliveryService.name);

  constructor(
    private readonly deliveries: WebhookDeliveriesRepository,
    private readonly profiles: SellerProfilesRepository,
    private readonly crypto: EncryptionService,
    @InjectQueue("webhooks") private readonly webhooksQueue: Queue,
  ) {}

  signPayload(
    secret: string,
    payload: OutboundWebhookPayload,
  ): { signature: string; body: string } {
    const body = JSON.stringify(payload);
    const signature = createHmac("sha256", secret).update(body).digest("hex");
    return { signature, body };
  }

  verifySignature(secret: string, body: string, signature: string): boolean {
    const expected = Buffer.from(createHmac("sha256", secret).update(body).digest("hex"));
    const actual = Buffer.from(signature);
    return expected.length === actual.length && timingSafeEqual(expected, actual);
  }

  async dispatch(
    eventType: WebhookEventType,
    sellerId: string,
    data: Record<string, unknown>,
  ): Promise<WebhookDelivery | null> {
    const profile = await this.profiles.findByUserId(sellerId);
    if (!profile?.webhookUrl || !profile.webhookSecret) return null;
    const record = await this.deliveries.create({
      sellerId,
      eventType,
      payload: data,
      targetUrl: profile.webhookUrl,
      status: WebhookDeliveryStatus.PENDING,
      attempts: 0,
    });
    await this.webhooksQueue.add(
      "deliver",
      { deliveryId: record.id },
      { jobId: `${PROCESS_JOB_PREFIX}${record.id}` },
    );
    return record;
  }

  async deliver(deliveryId: string): Promise<"delivered" | "duplicate" | "failed"> {
    const delivery = await this.deliveries.findById(deliveryId);
    if (!delivery || delivery.status !== WebhookDeliveryStatus.PENDING) return "duplicate";
    const profile = await this.profiles.findByUserId(delivery.sellerId);
    const secret = profile?.webhookSecret ? this.crypto.decrypt(profile.webhookSecret) : null;
    if (!secret) {
      delivery.status = WebhookDeliveryStatus.FAILED;
      delivery.lastError = "Seller webhook secret is no longer configured";
      await this.deliveries.save(delivery);
      return "failed";
    }
    const payload: OutboundWebhookPayload = {
      event: delivery.eventType,
      data: delivery.payload,
      timestamp: new Date().toISOString(),
      deliveryId: delivery.id,
    };
    const { signature, body } = this.signPayload(secret, payload);
    try {
      const res = await fetch(delivery.targetUrl, {
        method: "POST",
        headers: {
          "content-type": "application/json",
          "x-tradeloop-signature": signature,
        },
        body,
        signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
      });
      if (!res.ok) throw new Error(`Seller endpoint responded with status ${res.status}`);
      delivery.status = WebhookDeliveryStatus.DELIVERED;
      delivery.lastError = null;
      await this.deliveries.save(delivery);
      return "delivered";
    } catch (error) {
      delivery.attempts += 1;
      delivery.lastError = (error as Error).message;
      if (delivery.attempts >= MAX_ATTEMPTS) {
        delivery.status = WebhookDeliveryStatus.FAILED;
        await this.deliveries.save(delivery);
        this.logger.warn(`Webhook delivery ${deliveryId} dead-lettered: ${delivery.lastError}`);
        return "failed";
      }
      await this.deliveries.save(delivery);
      throw error;
    }
  }

  async retryDelivery(deliveryId: string): Promise<WebhookDelivery> {
    const delivery = await this.deliveries.findById(deliveryId);
    if (!delivery) throw new NotFoundException("Webhook delivery not found");
    if (delivery.status !== WebhookDeliveryStatus.FAILED) {
      throw new ConflictException(`Delivery is ${delivery.status}, only failed deliveries can be retried`);
    }
    delivery.status = WebhookDeliveryStatus.PENDING;
    delivery.attempts = 0;
    delivery.lastError = null;
    await this.webhooksQueue.add(
      "deliver",
      { deliveryId: delivery.id },
      { jobId: `${PROCESS_JOB_PREFIX}${delivery.id}-${Date.now()}` },
    );
    return this.deliveries.save(delivery);
  }
}

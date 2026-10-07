import {
  ConflictException,
  ForbiddenException,
  Inject,
  Injectable,
  NotFoundException,
  UnauthorizedException,
} from "@nestjs/common";
import { OrderStatus, ShipmentStatus } from "@tradeloop/types";
import { InvalidStateTransitionException } from "../common/exceptions/invalid-state-transition.exception";
import { OrdersRepository } from "../orders/orders.repository";
import type {
  CreateShipmentInput,
  RateInput,
  ShippingRate,
  TrackingResult,
} from "@tradeloop/types";
import { SendboxProvider, mapSendboxStatus } from "./providers/sendbox.provider";
import {
  LOGISTICS_PROVIDER,
  type LogisticsProvider,
} from "./interfaces/logistics-provider.interface";
import type { Shipment } from "./entities/shipment.entity";
import { ShipmentsRepository } from "./shipments.repository";

interface SendboxWebhookPayload {
  trackingNumber: string;
  status: string;
  description?: string;
  location?: string;
}

@Injectable()
export class LogisticsService {
  constructor(
    private readonly shipments: ShipmentsRepository,
    private readonly orders: OrdersRepository,
    @Inject(LOGISTICS_PROVIDER) private readonly provider: LogisticsProvider,
  ) {}

  async createShipment(sellerId: string, input: CreateShipmentInput): Promise<Shipment> {
    const order = await this.orders.findById(input.orderId);
    if (!order) throw new NotFoundException("Order not found");
    if (order.sellerId !== sellerId) {
      throw new ForbiddenException("Only the seller can ship this order");
    }
    if (order.status !== OrderStatus.SHIPPED) {
      throw new InvalidStateTransitionException(order.status, OrderStatus.SHIPPED);
    }
    const existing = await this.shipments.findByOrder(input.orderId);
    if (existing) throw new ConflictException("Order already has a shipment");

    const rate = await this.provider.calculateRate(input);
    const created = await this.provider.createShipment(input);
    return this.shipments.create({
      orderId: input.orderId,
      provider: this.provider.name,
      trackingNumber: created.trackingNumber,
      status: ShipmentStatus.PENDING,
      rateAmount: rate.amount,
    });
  }

  async calculateRate(input: RateInput): Promise<ShippingRate> {
    return this.provider.calculateRate(input);
  }

  async trackShipment(
    trackingNumber: string,
  ): Promise<{ shipment: Shipment; tracking: TrackingResult }> {
    const shipment = await this.shipments.findByTrackingNumber(trackingNumber);
    if (!shipment) throw new NotFoundException("Shipment not found");
    const tracking = await this.provider.trackShipment(trackingNumber);
    if (tracking.status !== shipment.status) {
      shipment.status = tracking.status;
      await this.shipments.save(shipment);
    }
    return { shipment, tracking };
  }

  async handleSendboxWebhook(
    signature: string | undefined,
    rawBody: Buffer | undefined,
    payload: SendboxWebhookPayload,
  ): Promise<"processed" | "ignored"> {
    if (this.provider.name !== "sendbox") {
      throw new UnauthorizedException("Sendbox provider is not active");
    }
    const verified = (this.provider as SendboxProvider).verifyWebhook(rawBody, signature);
    if (!verified) throw new UnauthorizedException("Invalid webhook signature");
    const shipment = await this.shipments.findByTrackingNumber(payload.trackingNumber);
    if (!shipment) return "ignored";
    const status = mapSendboxStatus(payload.status);
    if (!status) return "ignored";
    shipment.status = status;
    await this.shipments.save(shipment);
    return "processed";
  }
}

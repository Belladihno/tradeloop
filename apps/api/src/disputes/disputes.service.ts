import {
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import { InjectQueue } from "@nestjs/bullmq";
import type { Queue } from "bullmq";
import { DataSource } from "typeorm";
import {
  DisputeStatus,
  OrderStatus,
  WalletType,
  type DisputeResolution,
} from "@tradeloop/types";
import { InvalidStateTransitionException } from "../common/exceptions/invalid-state-transition.exception";
import { EscrowService } from "../escrow/escrow.service";
import { OrdersRepository } from "../orders/orders.repository";
import { ProductsRepository } from "../products/products.repository";
import { DISPUTE_EXPIRY_DELAY_MS } from "../queues/queues.module";
import { SettlementService } from "../settlement/settlement.service";
import { WalletRepository } from "../wallet/wallet.repository";
import { WalletService } from "../wallet/wallet.service";
import type { Dispute } from "./entities/dispute.entity";
import { DisputesRepository } from "./disputes.repository";

const DISPUTABLE = [OrderStatus.SHIPPED, OrderStatus.DELIVERED];
const EXPIRY_JOB_PREFIX = "dispute-expiry-";

@Injectable()
export class DisputeService {
  constructor(
    private readonly disputes: DisputesRepository,
    private readonly orders: OrdersRepository,
    private readonly products: ProductsRepository,
    private readonly wallets: WalletRepository,
    private readonly walletService: WalletService,
    private readonly escrow: EscrowService,
    private readonly settlement: SettlementService,
    private readonly dataSource: DataSource,
    @InjectQueue("disputes") private readonly expiryQueue: Queue,
  ) {}

  async raise(buyerId: string, orderId: string, reason: string): Promise<Dispute> {
    const order = await this.orders.findById(orderId);
    if (!order) throw new NotFoundException("Order not found");
    if (order.buyerId !== buyerId) {
      throw new ForbiddenException("Only the buyer can dispute this order");
    }
    if (!DISPUTABLE.includes(order.status)) {
      throw new InvalidStateTransitionException(order.status, OrderStatus.DISPUTED);
    }
    const open = await this.disputes.findOpenByOrder(orderId);
    if (open) throw new ConflictException("Order already has an open dispute");

    const runner = this.dataSource.createQueryRunner();
    await runner.connect();
    await runner.startTransaction();
    try {
      const dispute = await this.disputes.create(
        {
          orderId,
          raisedBy: buyerId,
          reason,
          status: DisputeStatus.OPEN,
          expiresAt: new Date(Date.now() + DISPUTE_EXPIRY_DELAY_MS),
        },
        runner,
      );
      await this.orders.updateStatus(orderId, OrderStatus.DISPUTED, runner);
      const job = await this.expiryQueue.add(
        "expire",
        { disputeId: dispute.id },
        { delay: DISPUTE_EXPIRY_DELAY_MS, jobId: `${EXPIRY_JOB_PREFIX}${dispute.id}` },
      );
      dispute.expiryJobId = String(job.id ?? `${EXPIRY_JOB_PREFIX}${dispute.id}`);
      const saved = await this.disputes.save(dispute, runner);
      await runner.commitTransaction();
      return saved;
    } catch (error) {
      await runner.rollbackTransaction();
      throw error;
    } finally {
      await runner.release();
    }
  }

  async resolve(
    disputeId: string,
    adminId: string,
    resolution: DisputeResolution,
  ): Promise<Dispute> {
    const dispute = await this.requireOpenDispute(disputeId);
    await this.cancelExpiryJob(dispute);
    if (resolution === "BUYER") {
      return this.resolveForBuyer(dispute, adminId);
    }
    return this.resolveForSeller(dispute, adminId, DisputeStatus.RESOLVED_SELLER);
  }

  async expire(disputeId: string): Promise<"expired" | "duplicate"> {
    const dispute = await this.disputes.findById(disputeId);
    if (
      !dispute ||
      (dispute.status !== DisputeStatus.OPEN &&
        dispute.status !== DisputeStatus.UNDER_REVIEW)
    ) {
      return "duplicate";
    }
    await this.resolveForSeller(dispute, dispute.adminId ?? null, DisputeStatus.EXPIRED);
    return "expired";
  }

  private async resolveForBuyer(dispute: Dispute, adminId: string): Promise<Dispute> {
    const runner = this.dataSource.createQueryRunner();
    await runner.connect();
    await runner.startTransaction();
    try {
      const order = await this.orders.findById(dispute.orderId);
      if (!order) throw new NotFoundException("Order not found");
      const escrow = await this.wallets.findSystemWallet(WalletType.ESCROW);
      if (!escrow) throw new NotFoundException("System wallets are not configured");
      const buyerWallet = await this.walletService.ensureBuyerWallet(order.buyerId);
      await this.escrow.refundFunds({
        escrowWalletId: escrow.id,
        buyerWalletId: buyerWallet.id,
        amount: order.totalAmount,
        orderId: order.id,
        runner,
      });
      const items = await this.orders.findItemsByOrder(order.id);
      for (const item of items) {
        await this.products.restoreStock(item.productId, item.quantity, runner);
      }
      await this.orders.updateStatus(order.id, OrderStatus.CANCELLED, runner);
      dispute.status = DisputeStatus.RESOLVED_BUYER;
      dispute.adminId = adminId;
      dispute.resolvedAt = new Date();
      const saved = await this.disputes.save(dispute, runner);
      await runner.commitTransaction();
      return saved;
    } catch (error) {
      await runner.rollbackTransaction();
      throw error;
    } finally {
      await runner.release();
    }
  }

  private async resolveForSeller(
    dispute: Dispute,
    adminId: string | null,
    status: DisputeStatus.RESOLVED_SELLER | DisputeStatus.EXPIRED,
  ): Promise<Dispute> {
    await this.orders.updateStatus(dispute.orderId, OrderStatus.DELIVERED);
    await this.settlement.settle(dispute.orderId);
    dispute.status = status;
    dispute.adminId = adminId;
    dispute.resolvedAt = new Date();
    return this.disputes.save(dispute);
  }

  private async requireOpenDispute(disputeId: string): Promise<Dispute> {
    const dispute = await this.disputes.findById(disputeId);
    if (!dispute) throw new NotFoundException("Dispute not found");
    if (
      dispute.status !== DisputeStatus.OPEN &&
      dispute.status !== DisputeStatus.UNDER_REVIEW
    ) {
      throw new InvalidStateTransitionException(dispute.status, "RESOLVED");
    }
    return dispute;
  }

  private async cancelExpiryJob(dispute: Dispute): Promise<void> {
    if (!dispute.expiryJobId) return;
    try {
      const job = await this.expiryQueue.getJob(dispute.expiryJobId);
      await job?.remove();
    } catch {
      return;
    }
  }
}

import {
  BadRequestException,
  ConflictException,
  Inject,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import { InjectQueue } from "@nestjs/bullmq";
import type { Queue } from "bullmq";
import { DataSource } from "typeorm";
import { PayoutStatus, NotificationChannel } from "@tradeloop/types";
import { EncryptionService } from "../common/crypto/encryption.service";
import { InsufficientFundsException } from "../common/exceptions/insufficient-funds.exception";
import { InvalidStateTransitionException } from "../common/exceptions/invalid-state-transition.exception";
import { fromMinorUnits, toMinorUnits } from "../common/utils/money";
import { NotificationsService } from "../notifications/notifications.service";
import { WebhookDeliveryService } from "../webhooks/outbound/webhook-delivery.service";
import { SellerProfilesService } from "../seller-profiles/seller-profiles.service";
import { WalletRepository } from "../wallet/wallet.repository";
import { WalletService } from "../wallet/wallet.service";
import type { PayoutRequest } from "./entities/payout-request.entity";
import { PAYOUT_FRAUD_CHECK, type PayoutFraudCheck } from "./payout-fraud-check.port";
import { PayoutsRepository } from "./payouts.repository";

const PROCESS_JOB_PREFIX = "payout-";

@Injectable()
export class PayoutsService {
  constructor(
    private readonly payouts: PayoutsRepository,
    private readonly wallets: WalletRepository,
    private readonly walletService: WalletService,
    private readonly sellers: SellerProfilesService,
    private readonly crypto: EncryptionService,
    private readonly notifications: NotificationsService,
    private readonly webhooks: WebhookDeliveryService,
    private readonly dataSource: DataSource,
    @Inject(PAYOUT_FRAUD_CHECK) private readonly fraudCheck: PayoutFraudCheck,
    @InjectQueue("payouts") private readonly payoutsQueue: Queue,
  ) {}

  async request(sellerId: string, rawAmount: string): Promise<PayoutRequest> {
    await this.sellers.assertSellerActive(sellerId);
    const amount = fromMinorUnits(toMinorUnits(rawAmount));
    const wallet = await this.walletService.ensureSellerWallet(sellerId);
    if (toMinorUnits(wallet.balance) < toMinorUnits(amount)) {
      throw new InsufficientFundsException();
    }
    const screening = await this.fraudCheck.screen(sellerId, amount);
    const profile = await this.sellers.myProfile(sellerId);
    if (!profile.bankCode || !profile.bankAccountNumber) {
      throw new BadRequestException("Seller bank details are missing");
    }
    const record = await this.payouts.create({
      sellerId,
      amount,
      status: screening.suspicious ? PayoutStatus.REJECTED : PayoutStatus.PENDING,
      bankCode: profile.bankCode,
      bankAccountLast4: this.crypto.decrypt(profile.bankAccountNumber).slice(-4),
      adminId: null,
      resolvedAt: screening.suspicious ? new Date() : null,
      failureReason: screening.suspicious ? screening.reason ?? "Flagged by fraud screening" : null,
    });
    return record;
  }

  async approve(payoutId: string, adminId: string): Promise<PayoutRequest> {
    const payout = await this.requirePending(payoutId);
    payout.status = PayoutStatus.APPROVED;
    payout.adminId = adminId;
    const job = await this.payoutsQueue.add(
      "process",
      { payoutId: payout.id },
      { jobId: `${PROCESS_JOB_PREFIX}${payout.id}` },
    );
    payout.jobId = String(job.id ?? `${PROCESS_JOB_PREFIX}${payout.id}`);
    const approved = await this.payouts.save(payout);
    await this.notifications.notify({
      userId: approved.sellerId,
      channels: [NotificationChannel.IN_APP, NotificationChannel.EMAIL],
      subject: "Payout approved",
      body: `Your payout of ${approved.amount} was approved and is being processed.`,
      data: { payoutId: approved.id },
    });
    return approved;
  }

  async reject(payoutId: string, adminId: string, reason?: string): Promise<PayoutRequest> {
    const payout = await this.requirePending(payoutId);
    payout.status = PayoutStatus.REJECTED;
    payout.adminId = adminId;
    payout.resolvedAt = new Date();
    payout.failureReason = reason ?? "Rejected by admin";
    return this.payouts.save(payout);
  }

  async process(payoutId: string): Promise<"completed" | "failed" | "duplicate"> {
    const payout = await this.payouts.findById(payoutId);
    if (!payout || payout.status !== PayoutStatus.APPROVED) return "duplicate";

    const runner = this.dataSource.createQueryRunner();
    await runner.connect();
    await runner.startTransaction();
    try {
      payout.status = PayoutStatus.PROCESSING;
      await this.payouts.save(payout, runner);
      const wallet = await this.walletService.ensureSellerWallet(payout.sellerId);
      try {
        await this.wallets.debitAtomic(wallet.id, payout.amount, runner);
      } catch (error) {
        if (!(error instanceof InsufficientFundsException)) throw error;
        payout.status = PayoutStatus.FAILED;
        payout.failureReason = "Insufficient seller balance at processing time";
        await this.payouts.save(payout, runner);
        await runner.commitTransaction();
        return "failed";
      }
      payout.status = PayoutStatus.COMPLETED;
      payout.resolvedAt = new Date();
      await this.payouts.save(payout, runner);
      await runner.commitTransaction();
      await this.notifications.notify({
        userId: payout.sellerId,
        channels: [NotificationChannel.IN_APP, NotificationChannel.EMAIL],
        subject: "Payout completed",
        body: `Your payout of ${payout.amount} was sent to your bank account.`,
        data: { payoutId: payout.id },
      });
      await this.webhooks.dispatch("payout.completed", payout.sellerId, {
        payoutId: payout.id,
        amount: payout.amount,
      });
      return "completed";
    } catch (error) {
      await runner.rollbackTransaction();
      throw error;
    } finally {
      await runner.release();
    }
  }

  async listMine(sellerId: string): Promise<PayoutRequest[]> {
    return this.payouts.findBySeller(sellerId);
  }

  private async requirePending(payoutId: string): Promise<PayoutRequest> {
    const payout = await this.payouts.findById(payoutId);
    if (!payout) throw new NotFoundException("Payout not found");
    if (payout.status !== PayoutStatus.PENDING) {
      throw new ConflictException(`Payout is already ${payout.status}`);
    }
    return payout;
  }
}

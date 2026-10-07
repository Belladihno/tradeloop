import { Injectable, NotFoundException } from "@nestjs/common";
import { DataSource } from "typeorm";
import { OrderStatus, WalletType } from "@tradeloop/types";
import { AuditService } from "../audit/audit.service";
import { fromMinorUnits, toMinorUnits } from "../common/utils/money";
import { EscrowService } from "../escrow/escrow.service";
import { OrdersRepository } from "../orders/orders.repository";
import { SellerProfilesService } from "../seller-profiles/seller-profiles.service";
import { WalletRepository } from "../wallet/wallet.repository";
import { WalletService } from "../wallet/wallet.service";

@Injectable()
export class SettlementService {
  constructor(
    private readonly orders: OrdersRepository,
    private readonly wallets: WalletRepository,
    private readonly walletService: WalletService,
    private readonly sellers: SellerProfilesService,
    private readonly escrow: EscrowService,
    private readonly audit: AuditService,
    private readonly dataSource: DataSource,
  ) {}

  async settle(orderId: string): Promise<"completed" | "duplicate"> {
    const order = await this.orders.findById(orderId);
    if (!order || order.status !== OrderStatus.DELIVERED) return "duplicate";

    const profile = await this.sellers.myProfile(order.sellerId);
    const totalMinor = toMinorUnits(order.totalAmount);
    const commissionMinor = Math.round(totalMinor * Number(profile.commissionRate));
    const net = fromMinorUnits(totalMinor - commissionMinor);
    const commission = fromMinorUnits(commissionMinor);

    const sellerWallet = await this.walletService.ensureSellerWallet(order.sellerId);
    const escrow = await this.wallets.findSystemWallet(WalletType.ESCROW);
    const platform = await this.wallets.findSystemWallet(WalletType.PLATFORM);
    if (!escrow || !platform) throw new NotFoundException("System wallets are not configured");

    const runner = this.dataSource.createQueryRunner();
    await runner.connect();
    await runner.startTransaction();
    try {
      const fresh = await this.orders.findById(orderId);
      if (!fresh || fresh.status !== OrderStatus.DELIVERED) {
        await runner.rollbackTransaction();
        return "duplicate";
      }
      await this.escrow.releaseFunds({
        escrowWalletId: escrow.id,
        sellerWalletId: sellerWallet.id,
        platformWalletId: platform.id,
        totalAmount: order.totalAmount,
        netAmount: net,
        commissionAmount: commission,
        orderId,
        runner,
      });
      await this.orders.markCompleted(orderId, commission, runner);
      await runner.commitTransaction();
      await this.audit.record({
        actorId: order.buyerId,
        action: "settlement.completed",
        entityType: "order",
        entityId: orderId,
        metadata: { netAmount: net, commissionAmount: commission },
      });
      return "completed";
    } catch (error) {
      await runner.rollbackTransaction();
      throw error;
    } finally {
      await runner.release();
    }
  }
}

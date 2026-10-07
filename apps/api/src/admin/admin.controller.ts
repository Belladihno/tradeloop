import {
  Body,
  Controller,
  Get,
  NotFoundException,
  Param,
  ParseUUIDPipe,
  Patch,
  Query,
  UseGuards,
} from "@nestjs/common";
import { UserRole, type FraudRuleName } from "@tradeloop/types";
import { CurrentUser } from "../auth/decorators/current-user.decorator";
import { Roles } from "../auth/decorators/roles.decorator";
import { JwtAuthGuard } from "../auth/guards/jwt-auth.guard";
import { RolesGuard } from "../auth/guards/roles.guard";
import type { RequestUser } from "../auth/types";
import { ResolveDisputeDto } from "../disputes/dto/resolve-dispute.dto";
import { DisputeService } from "../disputes/disputes.service";
import { RejectPayoutDto } from "../payouts/dto/reject-payout.dto";
import { PayoutsService } from "../payouts/payouts.service";
import { WebhookDeliveryService } from "../webhooks/outbound/webhook-delivery.service";
import { AuditService } from "../audit/audit.service";
import { UpdateFraudRuleDto } from "../fraud/dto/update-fraud-rule.dto";
import { FraudService } from "../fraud/fraud.service";
import { UpdateCommissionDto } from "../seller-profiles/dto/update-commission.dto";
import { RejectSellerDto } from "../seller-profiles/dto/reject-seller.dto";
import { SellerProfilesService } from "../seller-profiles/seller-profiles.service";

@Controller("admin")
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(UserRole.ADMIN)
export class AdminController {
  constructor(
    private readonly sellers: SellerProfilesService,
    private readonly disputes: DisputeService,
    private readonly payouts: PayoutsService,
    private readonly webhookDeliveries: WebhookDeliveryService,
    private readonly fraud: FraudService,
    private readonly audit: AuditService,
  ) {}

  @Patch("sellers/:id/review")
  async review(@CurrentUser() admin: RequestUser, @Param("id", ParseUUIDPipe) id: string) {
    const profile = await this.sellers.review(id);
    await this.audit.record({
      actorId: admin.id,
      action: "seller.reviewed",
      entityType: "seller",
      entityId: id,
    });
    return profile;
  }

  @Patch("sellers/:id/approve")
  async approve(@CurrentUser() admin: RequestUser, @Param("id", ParseUUIDPipe) id: string) {
    const profile = await this.sellers.approve(id);
    await this.audit.record({
      actorId: admin.id,
      action: "seller.approved",
      entityType: "seller",
      entityId: id,
    });
    return profile;
  }

  @Patch("sellers/:id/reject")
  async reject(
    @CurrentUser() admin: RequestUser,
    @Param("id", ParseUUIDPipe) id: string,
    @Body() dto: RejectSellerDto,
  ) {
    const profile = await this.sellers.reject(id, dto.reason);
    await this.audit.record({
      actorId: admin.id,
      action: "seller.rejected",
      entityType: "seller",
      entityId: id,
    });
    return profile;
  }

  @Patch("sellers/:id/commission")
  async updateCommission(
    @CurrentUser() admin: RequestUser,
    @Param("id", ParseUUIDPipe) id: string,
    @Body() dto: UpdateCommissionDto,
  ) {
    const profile = await this.sellers.updateCommission(id, dto.commissionRate);
    await this.audit.record({
      actorId: admin.id,
      action: "seller.commission_updated",
      entityType: "seller",
      entityId: id,
      metadata: { commissionRate: dto.commissionRate },
    });
    return profile;
  }

  @Patch("disputes/:id/resolve")
  resolveDispute(
    @CurrentUser() admin: RequestUser,
    @Param("id", ParseUUIDPipe) id: string,
    @Body() dto: ResolveDisputeDto,
  ) {
    return this.disputes.resolve(id, admin.id, dto.resolution);
  }

  @Patch("payouts/:id/approve")
  approvePayout(@CurrentUser() admin: RequestUser, @Param("id", ParseUUIDPipe) id: string) {
    return this.payouts.approve(id, admin.id);
  }

  @Patch("payouts/:id/reject")
  rejectPayout(
    @CurrentUser() admin: RequestUser,
    @Param("id", ParseUUIDPipe) id: string,
    @Body() dto: RejectPayoutDto,
  ) {
    return this.payouts.reject(id, admin.id, dto.reason);
  }

  @Patch("webhook-deliveries/:id/retry")
  async retryWebhookDelivery(@CurrentUser() admin: RequestUser, @Param("id", ParseUUIDPipe) id: string) {
    const delivery = await this.webhookDeliveries.retryDelivery(id);
    await this.audit.record({
      actorId: admin.id,
      action: "webhook.delivery_retried",
      entityType: "webhook-delivery",
      entityId: id,
    });
    return delivery;
  }

  @Get("fraud/events")
  fraudEvents(@Query("limit") limit?: string) {
    const take = Math.min(Math.max(Number(limit) || 100, 1), 500);
    return this.fraud.listEvents(take);
  }

  @Get("fraud/rules")
  fraudRules() {
    return this.fraud.listRules();
  }

  @Patch("fraud/rules/:name")
  async updateFraudRule(
    @CurrentUser() admin: RequestUser,
    @Param("name") name: string,
    @Body() dto: UpdateFraudRuleDto,
  ) {
    const updated = await this.fraud.updateRule(name as FraudRuleName, dto);
    if (!updated) throw new NotFoundException("Fraud rule not found");
    await this.audit.record({
      actorId: admin.id,
      action: "fraud.rule_updated",
      entityType: "fraud-rule",
      entityId: updated.id,
    });
    return updated;
  }
}

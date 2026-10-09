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
import { ApiBearerAuth, ApiBody, ApiOperation, ApiResponse, ApiTags } from "@nestjs/swagger";
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
import { WriteThrottle } from "../common/throttle/rate-limit";
import { ApiCommonErrors } from "../common/swagger/api-responses";

@ApiTags("admin")
@ApiBearerAuth()
@Controller("admin")
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(UserRole.ADMIN)
@WriteThrottle()
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
  @ApiOperation({ summary: "Mark a seller application as under review" })
  @ApiResponse({ status: 200, description: "Seller marked under review" })
  @ApiCommonErrors("/api/v1/admin/sellers/:id/review")
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
  @ApiOperation({ summary: "Approve a seller application" })
  @ApiResponse({ status: 200, description: "Seller approved" })
  @ApiCommonErrors("/api/v1/admin/sellers/:id/approve")
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
  @ApiOperation({ summary: "Reject a seller application with a reason" })
  @ApiBody({ schema: { example: { reason: "Business registration could not be verified" } } })
  @ApiResponse({ status: 200, description: "Seller rejected" })
  @ApiCommonErrors("/api/v1/admin/sellers/:id/reject")
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
  @ApiOperation({ summary: "Set a seller's commission rate" })
  @ApiBody({ schema: { example: { commissionRate: "0.12" } } })
  @ApiResponse({ status: 200, description: "Commission updated" })
  @ApiCommonErrors("/api/v1/admin/sellers/:id/commission")
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
  @ApiOperation({ summary: "Resolve a dispute (refund buyer or release to seller)" })
  @ApiBody({ schema: { example: { resolution: "BUYER" } } })
  @ApiResponse({ status: 200, description: "Dispute resolved" })
  @ApiCommonErrors("/api/v1/admin/disputes/:id/resolve")
  resolveDispute(
    @CurrentUser() admin: RequestUser,
    @Param("id", ParseUUIDPipe) id: string,
    @Body() dto: ResolveDisputeDto,
  ) {
    return this.disputes.resolve(id, admin.id, dto.resolution);
  }

  @Patch("payouts/:id/approve")
  @ApiOperation({ summary: "Approve a payout request (queues provider transfer)" })
  @ApiResponse({ status: 200, description: "Payout approved" })
  @ApiCommonErrors("/api/v1/admin/payouts/:id/approve")
  approvePayout(@CurrentUser() admin: RequestUser, @Param("id", ParseUUIDPipe) id: string) {
    return this.payouts.approve(id, admin.id);
  }

  @Patch("payouts/:id/reject")
  @ApiOperation({ summary: "Reject a payout request with a reason" })
  @ApiBody({ schema: { example: { reason: "Bank account name mismatch" } } })
  @ApiResponse({ status: 200, description: "Payout rejected" })
  @ApiCommonErrors("/api/v1/admin/payouts/:id/reject")
  rejectPayout(
    @CurrentUser() admin: RequestUser,
    @Param("id", ParseUUIDPipe) id: string,
    @Body() dto: RejectPayoutDto,
  ) {
    return this.payouts.reject(id, admin.id, dto.reason);
  }

  @Patch("webhook-deliveries/:id/retry")
  @ApiOperation({ summary: "Manually retry a failed outbound webhook delivery" })
  @ApiResponse({ status: 200, description: "Delivery requeued" })
  @ApiCommonErrors("/api/v1/admin/webhook-deliveries/:id/retry")
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
  @ApiOperation({ summary: "List flagged fraud events (newest first)" })
  @ApiResponse({ status: 200, description: "Flagged events" })
  @ApiCommonErrors("/api/v1/admin/fraud/events")
  fraudEvents(@Query("limit") limit?: string) {
    const take = Math.min(Math.max(Number(limit) || 100, 1), 500);
    return this.fraud.listEvents(take);
  }

  @Get("fraud/rules")
  @ApiOperation({ summary: "List fraud rules and their enabled state" })
  @ApiResponse({ status: 200, description: "Fraud rules" })
  @ApiCommonErrors("/api/v1/admin/fraud/rules")
  fraudRules() {
    return this.fraud.listRules();
  }

  @Patch("fraud/rules/:name")
  @ApiOperation({ summary: "Enable, disable, or retune a fraud rule" })
  @ApiBody({ schema: { example: { enabled: false, threshold: 5, windowSeconds: 600 } } })
  @ApiResponse({ status: 200, description: "Rule updated" })
  @ApiCommonErrors("/api/v1/admin/fraud/rules/:name")
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

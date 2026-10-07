import {
  Body,
  Controller,
  Param,
  ParseUUIDPipe,
  Patch,
  UseGuards,
} from "@nestjs/common";
import { UserRole } from "@tradeloop/types";
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
  ) {}

  @Patch("sellers/:id/review")
  review(@Param("id", ParseUUIDPipe) id: string) {
    return this.sellers.review(id);
  }

  @Patch("sellers/:id/approve")
  approve(@Param("id", ParseUUIDPipe) id: string) {
    return this.sellers.approve(id);
  }

  @Patch("sellers/:id/reject")
  reject(@Param("id", ParseUUIDPipe) id: string, @Body() dto: RejectSellerDto) {
    return this.sellers.reject(id, dto.reason);
  }

  @Patch("sellers/:id/commission")
  updateCommission(
    @Param("id", ParseUUIDPipe) id: string,
    @Body() dto: UpdateCommissionDto,
  ) {
    return this.sellers.updateCommission(id, dto.commissionRate);
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
  retryWebhookDelivery(@Param("id", ParseUUIDPipe) id: string) {
    return this.webhookDeliveries.retryDelivery(id);
  }
}

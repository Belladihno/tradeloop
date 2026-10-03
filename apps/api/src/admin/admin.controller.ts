import {
  Body,
  Controller,
  Param,
  ParseUUIDPipe,
  Patch,
  UseGuards,
} from "@nestjs/common";
import { UserRole } from "@tradeloop/types";
import { Roles } from "../auth/decorators/roles.decorator";
import { JwtAuthGuard } from "../auth/guards/jwt-auth.guard";
import { RolesGuard } from "../auth/guards/roles.guard";
import { UpdateCommissionDto } from "../seller-profiles/dto/update-commission.dto";
import { RejectSellerDto } from "../seller-profiles/dto/reject-seller.dto";
import { SellerProfilesService } from "../seller-profiles/seller-profiles.service";

@Controller("admin")
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(UserRole.ADMIN)
export class AdminController {
  constructor(private readonly sellers: SellerProfilesService) {}

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
}

import { Body, Controller, Param, Post, UseGuards } from "@nestjs/common";
import { CurrentUser } from "../auth/decorators/current-user.decorator";
import { JwtAuthGuard } from "../auth/guards/jwt-auth.guard";
import type { RequestUser } from "../auth/types";
import { RaiseDisputeDto } from "../orders/dto/raise-dispute.dto";
import { DisputeService } from "./disputes.service";

@Controller("orders")
@UseGuards(JwtAuthGuard)
export class DisputesController {
  constructor(private readonly disputes: DisputeService) {}

  @Post(":id/dispute")
  raise(
    @CurrentUser() user: RequestUser,
    @Param("id") id: string,
    @Body() dto: RaiseDisputeDto,
  ) {
    return this.disputes.raise(user.id, id, dto.reason);
  }
}

import { Body, Controller, Get, Post, UseGuards } from "@nestjs/common";
import { CurrentUser } from "../auth/decorators/current-user.decorator";
import { JwtAuthGuard } from "../auth/guards/jwt-auth.guard";
import type { RequestUser } from "../auth/types";
import { RequestPayoutDto } from "./dto/request-payout.dto";
import { PayoutsService } from "./payouts.service";

@Controller("payouts")
@UseGuards(JwtAuthGuard)
export class PayoutsController {
  constructor(private readonly payouts: PayoutsService) {}

  @Post()
  request(@CurrentUser() user: RequestUser, @Body() dto: RequestPayoutDto) {
    return this.payouts.request(user.id, dto.amount);
  }

  @Get("mine")
  listMine(@CurrentUser() user: RequestUser) {
    return this.payouts.listMine(user.id);
  }
}

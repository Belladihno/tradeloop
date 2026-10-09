import { Body, Controller, Get, Post, UseGuards } from "@nestjs/common";
import { ApiBearerAuth, ApiBody, ApiOperation, ApiResponse, ApiTags } from "@nestjs/swagger";
import { CurrentUser } from "../auth/decorators/current-user.decorator";
import { JwtAuthGuard } from "../auth/guards/jwt-auth.guard";
import type { RequestUser } from "../auth/types";
import { ApiCommonErrors } from "../common/swagger/api-responses";
import { WriteThrottle } from "../common/throttle/rate-limit";
import { RequestPayoutDto } from "./dto/request-payout.dto";
import { PayoutsService } from "./payouts.service";

@ApiTags("payouts")
@ApiBearerAuth()
@Controller("payouts")
@UseGuards(JwtAuthGuard)
export class PayoutsController {
  constructor(private readonly payouts: PayoutsService) {}

  @Post()
  @WriteThrottle()
  @ApiOperation({ summary: "Request a payout of seller earnings" })
  @ApiBody({ schema: { example: { amount: "2500.00" } } })
  @ApiResponse({ status: 201, description: "Payout requested" })
  @ApiCommonErrors("/api/v1/payouts")
  request(@CurrentUser() user: RequestUser, @Body() dto: RequestPayoutDto) {
    return this.payouts.request(user.id, dto.amount);
  }

  @Get("mine")
  @ApiOperation({ summary: "List my payout requests" })
  @ApiResponse({ status: 200, description: "Payout requests" })
  @ApiCommonErrors("/api/v1/payouts/mine")
  listMine(@CurrentUser() user: RequestUser) {
    return this.payouts.listMine(user.id);
  }
}

import { Body, Controller, Param, Post, UseGuards } from "@nestjs/common";
import { ApiBearerAuth, ApiBody, ApiOperation, ApiResponse, ApiTags } from "@nestjs/swagger";
import { CurrentUser } from "../auth/decorators/current-user.decorator";
import { JwtAuthGuard } from "../auth/guards/jwt-auth.guard";
import type { RequestUser } from "../auth/types";
import { ApiCommonErrors } from "../common/swagger/api-responses";
import { WriteThrottle } from "../common/throttle/rate-limit";
import { RaiseDisputeDto } from "../orders/dto/raise-dispute.dto";
import { DisputeService } from "./disputes.service";

@ApiTags("disputes")
@ApiBearerAuth()
@Controller("orders")
@UseGuards(JwtAuthGuard)
export class DisputesController {
  constructor(private readonly disputes: DisputeService) {}

  @Post(":id/dispute")
  @WriteThrottle()
  @ApiOperation({ summary: "Raise a dispute on a delivered order" })
  @ApiBody({
    schema: { example: { reason: "Item arrived damaged and does not match the listing photos" } },
  })
  @ApiResponse({ status: 201, description: "Dispute opened" })
  @ApiCommonErrors("/api/v1/orders/:id/dispute")
  raise(
    @CurrentUser() user: RequestUser,
    @Param("id") id: string,
    @Body() dto: RaiseDisputeDto,
  ) {
    return this.disputes.raise(user.id, id, dto.reason);
  }
}

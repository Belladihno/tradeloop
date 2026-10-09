import { Body, Controller, Get, Post, UseGuards } from "@nestjs/common";
import { ApiBearerAuth, ApiBody, ApiOperation, ApiResponse, ApiTags } from "@nestjs/swagger";
import { CurrentUser } from "../auth/decorators/current-user.decorator";
import { JwtAuthGuard } from "../auth/guards/jwt-auth.guard";
import type { RequestUser } from "../auth/types";
import { ApiCommonErrors } from "../common/swagger/api-responses";
import { WriteThrottle } from "../common/throttle/rate-limit";
import { OnboardSellerDto } from "./dto/onboard-seller.dto";
import { SellerProfilesService } from "./seller-profiles.service";

@ApiTags("seller")
@ApiBearerAuth()
@Controller("seller")
export class SellerProfilesController {
  constructor(private readonly sellers: SellerProfilesService) {}

  @UseGuards(JwtAuthGuard)
  @Post("onboard")
  @WriteThrottle()
  @ApiOperation({ summary: "Submit a seller application" })
  @ApiBody({
    schema: {
      example: {
        storeName: "Ada Leatherworks",
        bankAccountNumber: "0123456789",
        bankCode: "058",
        webhookUrl: "https://shop.example.com/hooks/tradeloop",
        webhookSecret: "at-least-sixteen-chars",
      },
    },
  })
  @ApiResponse({ status: 201, description: "Application submitted" })
  @ApiCommonErrors("/api/v1/seller/onboard")
  onboard(@CurrentUser() user: RequestUser, @Body() dto: OnboardSellerDto) {
    return this.sellers.onboard(user.id, dto);
  }

  @UseGuards(JwtAuthGuard)
  @Get("profile")
  @ApiOperation({ summary: "Get my seller profile and approval status" })
  @ApiResponse({ status: 200, description: "Seller profile" })
  @ApiCommonErrors("/api/v1/seller/profile")
  myProfile(@CurrentUser() user: RequestUser) {
    return this.sellers.myProfile(user.id);
  }
}

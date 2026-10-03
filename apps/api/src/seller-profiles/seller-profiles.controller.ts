import { Body, Controller, Get, Post, UseGuards } from "@nestjs/common";
import { CurrentUser } from "../auth/decorators/current-user.decorator";
import { JwtAuthGuard } from "../auth/guards/jwt-auth.guard";
import type { RequestUser } from "../auth/types";
import { OnboardSellerDto } from "./dto/onboard-seller.dto";
import { SellerProfilesService } from "./seller-profiles.service";

@Controller("seller")
export class SellerProfilesController {
  constructor(private readonly sellers: SellerProfilesService) {}

  @UseGuards(JwtAuthGuard)
  @Post("onboard")
  onboard(@CurrentUser() user: RequestUser, @Body() dto: OnboardSellerDto) {
    return this.sellers.onboard(user.id, dto);
  }

  @UseGuards(JwtAuthGuard)
  @Get("profile")
  myProfile(@CurrentUser() user: RequestUser) {
    return this.sellers.myProfile(user.id);
  }
}

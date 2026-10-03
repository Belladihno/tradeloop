import { Body, Controller, Get, Post, UseGuards } from "@nestjs/common";
import { CurrentUser } from "../auth/decorators/current-user.decorator";
import { JwtAuthGuard } from "../auth/guards/jwt-auth.guard";
import type { RequestUser } from "../auth/types";
import { FundWalletDto } from "./dto/fund-wallet.dto";
import { WalletService } from "./wallet.service";

@Controller("wallet")
export class WalletController {
  constructor(private readonly wallet: WalletService) {}

  @UseGuards(JwtAuthGuard)
  @Get("balance")
  async balance(@CurrentUser() user: RequestUser): Promise<{ balance: string }> {
    return { balance: await this.wallet.getBalance(user.id) };
  }

  @UseGuards(JwtAuthGuard)
  @Post("fund")
  async fund(
    @CurrentUser() user: RequestUser,
    @Body() dto: FundWalletDto,
  ): Promise<{ paymentUrl: string; reference: string }> {
    return this.wallet.initiateFunding(user.id, user.email, dto.amount);
  }
}

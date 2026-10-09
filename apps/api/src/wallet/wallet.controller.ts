import { Body, Controller, Get, Post, UseGuards } from "@nestjs/common";
import { ApiBearerAuth, ApiBody, ApiOperation, ApiResponse, ApiTags } from "@nestjs/swagger";
import { CurrentUser } from "../auth/decorators/current-user.decorator";
import { JwtAuthGuard } from "../auth/guards/jwt-auth.guard";
import type { RequestUser } from "../auth/types";
import { ApiCommonErrors } from "../common/swagger/api-responses";
import { WriteThrottle } from "../common/throttle/rate-limit";
import { FundWalletDto } from "./dto/fund-wallet.dto";
import { WalletService } from "./wallet.service";

@ApiTags("wallet")
@ApiBearerAuth()
@Controller("wallet")
export class WalletController {
  constructor(private readonly wallet: WalletService) {}

  @UseGuards(JwtAuthGuard)
  @Get("balance")
  @ApiOperation({ summary: "Get my wallet balance" })
  @ApiResponse({
    status: 200,
    description: "Current balance",
    schema: {
      example: { success: true, message: "Request successful", data: { balance: "12500.00" } },
    },
  })
  @ApiCommonErrors("/api/v1/wallet/balance")
  async balance(@CurrentUser() user: RequestUser): Promise<{ balance: string }> {
    return { balance: await this.wallet.getBalance(user.id) };
  }

  @UseGuards(JwtAuthGuard)
  @Post("fund")
  @WriteThrottle()
  @ApiOperation({ summary: "Start a wallet top-up (returns provider payment URL)" })
  @ApiBody({ schema: { example: { amount: "5000.00" } } })
  @ApiResponse({
    status: 201,
    description: "Funding initialized",
    schema: {
      example: {
        success: true,
        message: "Resource created successfully",
        data: { paymentUrl: "https://checkout.paystack.com/abc", reference: "TL-1718000000000-ab12" },
      },
    },
  })
  @ApiCommonErrors("/api/v1/wallet/fund")
  async fund(
    @CurrentUser() user: RequestUser,
    @Body() dto: FundWalletDto,
  ): Promise<{ paymentUrl: string; reference: string }> {
    return this.wallet.initiateFunding(user.id, user.email, dto.amount);
  }
}

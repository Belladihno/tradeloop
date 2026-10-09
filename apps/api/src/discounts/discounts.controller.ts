import {
  Body,
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  UseGuards,
} from "@nestjs/common";
import { UserRole } from "@tradeloop/types";
import { ApiBearerAuth, ApiBody, ApiOperation, ApiResponse, ApiTags } from "@nestjs/swagger";
import { CurrentUser } from "../auth/decorators/current-user.decorator";
import { Roles } from "../auth/decorators/roles.decorator";
import { JwtAuthGuard } from "../auth/guards/jwt-auth.guard";
import { RolesGuard } from "../auth/guards/roles.guard";
import type { RequestUser } from "../auth/types";
import { ApiCommonErrors } from "../common/swagger/api-responses";
import { WriteThrottle } from "../common/throttle/rate-limit";
import { DiscountService } from "./discount.service";
import { CreateDiscountDto } from "./dto/create-discount.dto";

@ApiTags("discounts")
@ApiBearerAuth()
@Controller("discounts")
@UseGuards(JwtAuthGuard)
export class DiscountsController {
  constructor(private readonly discounts: DiscountService) {}

  @UseGuards(RolesGuard)
  @Roles(UserRole.SELLER, UserRole.ADMIN)
  @Post()
  @WriteThrottle()
  @ApiOperation({ summary: "Create a discount code (sellers and admins)" })
  @ApiBody({
    schema: {
      example: {
        code: "WELCOME10",
        type: "PERCENTAGE",
        value: "10.00",
        scope: "SELLER",
        minimumOrderValue: "5000.00",
        maxUsageCount: 100,
      },
    },
  })
  @ApiResponse({ status: 201, description: "Discount created" })
  @ApiCommonErrors("/api/v1/discounts")
  create(@CurrentUser() user: RequestUser, @Body() dto: CreateDiscountDto) {
    return this.discounts.createDiscount(user.id, user.role, dto);
  }

  @Get("mine")
  @ApiOperation({ summary: "List discounts I created" })
  @ApiResponse({ status: 200, description: "My discounts" })
  @ApiCommonErrors("/api/v1/discounts/mine")
  listMine(@CurrentUser() user: RequestUser) {
    return this.discounts.listMine(user.id);
  }

  @UseGuards(RolesGuard)
  @Roles(UserRole.ADMIN)
  @Get()
  @ApiOperation({ summary: "List all discounts (admin only)" })
  @ApiResponse({ status: 200, description: "All discounts" })
  @ApiCommonErrors("/api/v1/discounts")
  listAll() {
    return this.discounts.listAll();
  }

  @Patch(":id/deactivate")
  @WriteThrottle()
  @ApiOperation({ summary: "Deactivate a discount (owner or admin)" })
  @ApiResponse({ status: 200, description: "Discount deactivated" })
  @ApiCommonErrors("/api/v1/discounts/:id/deactivate")
  deactivate(@CurrentUser() user: RequestUser, @Param("id", ParseUUIDPipe) id: string) {
    return this.discounts.deactivate(user.id, user.role, id);
  }
}

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
import { CurrentUser } from "../auth/decorators/current-user.decorator";
import { Roles } from "../auth/decorators/roles.decorator";
import { JwtAuthGuard } from "../auth/guards/jwt-auth.guard";
import { RolesGuard } from "../auth/guards/roles.guard";
import type { RequestUser } from "../auth/types";
import { DiscountService } from "./discount.service";
import { CreateDiscountDto } from "./dto/create-discount.dto";

@Controller("discounts")
@UseGuards(JwtAuthGuard)
export class DiscountsController {
  constructor(private readonly discounts: DiscountService) {}

  @UseGuards(RolesGuard)
  @Roles(UserRole.SELLER, UserRole.ADMIN)
  @Post()
  create(@CurrentUser() user: RequestUser, @Body() dto: CreateDiscountDto) {
    return this.discounts.createDiscount(user.id, user.role, dto);
  }

  @Get("mine")
  listMine(@CurrentUser() user: RequestUser) {
    return this.discounts.listMine(user.id);
  }

  @UseGuards(RolesGuard)
  @Roles(UserRole.ADMIN)
  @Get()
  listAll() {
    return this.discounts.listAll();
  }

  @Patch(":id/deactivate")
  deactivate(@CurrentUser() user: RequestUser, @Param("id", ParseUUIDPipe) id: string) {
    return this.discounts.deactivate(user.id, user.role, id);
  }
}

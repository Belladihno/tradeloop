import {
  Body,
  Controller,
  Get,
  Param,
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
import { IdempotencyKey } from "../common/decorators/idempotency-key.decorator";
import { CheckoutCartDto } from "./dto/checkout-cart.dto";
import { CreateOrderDto } from "./dto/create-order.dto";
import { OrdersService } from "./orders.service";

@Controller("orders")
@UseGuards(JwtAuthGuard)
export class OrdersController {
  constructor(private readonly orders: OrdersService) {}

  @Post()
  create(
    @CurrentUser() user: RequestUser,
    @Body() dto: CreateOrderDto,
    @IdempotencyKey() idempotencyKey?: string,
  ) {
    return this.orders.create(user.id, dto, idempotencyKey);
  }

  @Post("from-cart")
  createFromCart(
    @CurrentUser() user: RequestUser,
    @Body() dto: CheckoutCartDto,
    @IdempotencyKey() idempotencyKey?: string,
  ) {
    return this.orders.createFromCart(user.id, dto.shippingAddress, idempotencyKey);
  }

  @Get()
  listMine(@CurrentUser() user: RequestUser) {
    return this.orders.listMine(user.id);
  }

  @UseGuards(RolesGuard)
  @Roles(UserRole.SELLER, UserRole.ADMIN)
  @Get("incoming")
  listIncoming(@CurrentUser() user: RequestUser) {
    return this.orders.listIncoming(user.id);
  }

  @Get(":id")
  detail(@CurrentUser() user: RequestUser, @Param("id") id: string) {
    return this.orders.getForUser(user.id, user.role, id);
  }

  @UseGuards(RolesGuard)
  @Roles(UserRole.SELLER, UserRole.ADMIN)
  @Patch(":id/confirm")
  confirm(@CurrentUser() user: RequestUser, @Param("id") id: string) {
    return this.orders.confirmBySeller(user.id, id);
  }

  @UseGuards(RolesGuard)
  @Roles(UserRole.SELLER, UserRole.ADMIN)
  @Patch(":id/ship")
  ship(@CurrentUser() user: RequestUser, @Param("id") id: string) {
    return this.orders.shipBySeller(user.id, id);
  }

  @Patch(":id/deliver")
  deliver(@CurrentUser() user: RequestUser, @Param("id") id: string) {
    return this.orders.confirmDelivery(user.id, id);
  }

  @Patch(":id/cancel")
  cancel(@CurrentUser() user: RequestUser, @Param("id") id: string) {
    return this.orders.cancelByBuyer(user.id, id);
  }
}

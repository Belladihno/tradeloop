import {
  Body,
  Controller,
  Get,
  Headers,
  Ip,
  Param,
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
import { IdempotencyKey } from "../common/decorators/idempotency-key.decorator";
import { ApiCommonErrors } from "../common/swagger/api-responses";
import { WriteThrottle } from "../common/throttle/rate-limit";
import { CheckoutCartDto } from "./dto/checkout-cart.dto";
import { CreateOrderDto } from "./dto/create-order.dto";
import { OrdersService } from "./orders.service";

const addressExample = {
  line1: "14 Allen Avenue",
  city: "Ikeja",
  state: "Lagos",
  postalCode: "100001",
  country: "NG",
  phone: "+2348012345678",
};

@ApiTags("orders")
@ApiBearerAuth()
@Controller("orders")
@UseGuards(JwtAuthGuard)
export class OrdersController {
  constructor(private readonly orders: OrdersService) {}

  @Post()
  @WriteThrottle()
  @ApiOperation({ summary: "Create an order from explicit items (idempotent)" })
  @ApiBody({
    schema: {
      example: {
        items: [{ productId: "0193e2c0-7a2e-7a2e-8a2e-8a2e8a2e8a2e", quantity: 2 }],
        shippingAddress: addressExample,
        discountCode: "WELCOME10",
      },
    },
  })
  @ApiResponse({ status: 201, description: "Order created and escrow held" })
  @ApiCommonErrors("/api/v1/orders")
  create(
    @CurrentUser() user: RequestUser,
    @Body() dto: CreateOrderDto,
    @IdempotencyKey() idempotencyKey?: string,
    @Ip() ip?: string,
    @Headers("user-agent") userAgent?: string,
  ) {
    return this.orders.create(user.id, dto, idempotencyKey, { ipAddress: ip, userAgent });
  }

  @Post("from-cart")
  @WriteThrottle()
  @ApiOperation({ summary: "Check out the current cart (idempotent)" })
  @ApiBody({
    schema: { example: { shippingAddress: addressExample, discountCode: "WELCOME10" } },
  })
  @ApiResponse({ status: 201, description: "Order created and escrow held" })
  @ApiCommonErrors("/api/v1/orders/from-cart")
  createFromCart(
    @CurrentUser() user: RequestUser,
    @Body() dto: CheckoutCartDto,
    @IdempotencyKey() idempotencyKey?: string,
    @Ip() ip?: string,
    @Headers("user-agent") userAgent?: string,
  ) {
    return this.orders.createFromCart(user.id, dto.shippingAddress, dto.discountCode, idempotencyKey, {
      ipAddress: ip,
      userAgent,
    });
  }

  @Get()
  @ApiOperation({ summary: "List my orders as a buyer" })
  @ApiResponse({ status: 200, description: "Buyer orders" })
  @ApiCommonErrors("/api/v1/orders")
  listMine(@CurrentUser() user: RequestUser) {
    return this.orders.listMine(user.id);
  }

  @UseGuards(RolesGuard)
  @Roles(UserRole.SELLER, UserRole.ADMIN)
  @Get("incoming")
  @ApiOperation({ summary: "List incoming orders as a seller" })
  @ApiResponse({ status: 200, description: "Seller orders" })
  @ApiCommonErrors("/api/v1/orders/incoming")
  listIncoming(@CurrentUser() user: RequestUser) {
    return this.orders.listIncoming(user.id);
  }

  @Get(":id")
  @ApiOperation({ summary: "Get one order (buyer, seller, or admin only)" })
  @ApiResponse({ status: 200, description: "Order detail" })
  @ApiCommonErrors("/api/v1/orders/:id")
  detail(@CurrentUser() user: RequestUser, @Param("id") id: string) {
    return this.orders.getForUser(user.id, user.role, id);
  }

  @UseGuards(RolesGuard)
  @Roles(UserRole.SELLER, UserRole.ADMIN)
  @Patch(":id/confirm")
  @WriteThrottle()
  @ApiOperation({ summary: "Confirm an order as the seller" })
  @ApiResponse({ status: 200, description: "Order confirmed" })
  @ApiCommonErrors("/api/v1/orders/:id/confirm")
  confirm(@CurrentUser() user: RequestUser, @Param("id") id: string) {
    return this.orders.confirmBySeller(user.id, id);
  }

  @UseGuards(RolesGuard)
  @Roles(UserRole.SELLER, UserRole.ADMIN)
  @Patch(":id/ship")
  @WriteThrottle()
  @ApiOperation({ summary: "Mark an order as shipped" })
  @ApiResponse({ status: 200, description: "Order marked shipped" })
  @ApiCommonErrors("/api/v1/orders/:id/ship")
  ship(@CurrentUser() user: RequestUser, @Param("id") id: string) {
    return this.orders.shipBySeller(user.id, id);
  }

  @Patch(":id/deliver")
  @WriteThrottle()
  @ApiOperation({ summary: "Confirm delivery as the buyer (releases escrow)" })
  @ApiResponse({ status: 200, description: "Delivery confirmed" })
  @ApiCommonErrors("/api/v1/orders/:id/deliver")
  deliver(@CurrentUser() user: RequestUser, @Param("id") id: string) {
    return this.orders.confirmDelivery(user.id, id);
  }

  @Patch(":id/cancel")
  @WriteThrottle()
  @ApiOperation({ summary: "Cancel a pending order as the buyer (refunds escrow)" })
  @ApiResponse({ status: 200, description: "Order cancelled" })
  @ApiCommonErrors("/api/v1/orders/:id/cancel")
  cancel(@CurrentUser() user: RequestUser, @Param("id") id: string) {
    return this.orders.cancelByBuyer(user.id, id);
  }
}

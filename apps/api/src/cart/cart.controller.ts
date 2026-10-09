import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  UseGuards,
} from "@nestjs/common";
import { ApiBearerAuth, ApiBody, ApiOperation, ApiResponse, ApiTags } from "@nestjs/swagger";
import { CurrentUser } from "../auth/decorators/current-user.decorator";
import { JwtAuthGuard } from "../auth/guards/jwt-auth.guard";
import type { RequestUser } from "../auth/types";
import { ApiCommonErrors } from "../common/swagger/api-responses";
import { WriteThrottle } from "../common/throttle/rate-limit";
import { CartService } from "./cart.service";
import { AddCartItemDto } from "./dto/add-cart-item.dto";
import { UpdateCartItemDto } from "./dto/update-cart-item.dto";

@ApiTags("cart")
@ApiBearerAuth()
@Controller("cart")
@UseGuards(JwtAuthGuard)
export class CartController {
  constructor(private readonly cart: CartService) {}

  @Get()
  @ApiOperation({ summary: "Get my cart" })
  @ApiResponse({ status: 200, description: "Cart with items" })
  @ApiCommonErrors("/api/v1/cart")
  getCart(@CurrentUser() user: RequestUser) {
    return this.cart.getCart(user.id);
  }

  @Post("items")
  @WriteThrottle()
  @ApiOperation({ summary: "Add an item to the cart" })
  @ApiBody({
    schema: {
      example: { productId: "0193e2c0-7a2e-7a2e-8a2e-8a2e8a2e8a2e", quantity: 2 },
    },
  })
  @ApiResponse({ status: 201, description: "Item added" })
  @ApiCommonErrors("/api/v1/cart/items")
  addItem(@CurrentUser() user: RequestUser, @Body() dto: AddCartItemDto) {
    return this.cart.addItem(user.id, dto.productId, dto.quantity);
  }

  @Patch("items/:productId")
  @WriteThrottle()
  @ApiOperation({ summary: "Change an item quantity" })
  @ApiBody({ schema: { example: { quantity: 3 } } })
  @ApiResponse({ status: 200, description: "Quantity updated" })
  @ApiCommonErrors("/api/v1/cart/items/:productId")
  updateQuantity(
    @CurrentUser() user: RequestUser,
    @Param("productId", ParseUUIDPipe) productId: string,
    @Body() dto: UpdateCartItemDto,
  ) {
    return this.cart.updateQuantity(user.id, productId, dto.quantity);
  }

  @Delete("items/:productId")
  @WriteThrottle()
  @ApiOperation({ summary: "Remove an item from the cart" })
  @ApiResponse({ status: 200, description: "Item removed" })
  @ApiCommonErrors("/api/v1/cart/items/:productId")
  async removeItem(
    @CurrentUser() user: RequestUser,
    @Param("productId", ParseUUIDPipe) productId: string,
  ): Promise<Record<string, never>> {
    await this.cart.removeItem(user.id, productId);
    return {};
  }

  @Delete()
  @WriteThrottle()
  @ApiOperation({ summary: "Clear the cart" })
  @ApiResponse({ status: 200, description: "Cart cleared" })
  @ApiCommonErrors("/api/v1/cart")
  async clear(@CurrentUser() user: RequestUser): Promise<Record<string, never>> {
    await this.cart.clear(user.id);
    return {};
  }
}

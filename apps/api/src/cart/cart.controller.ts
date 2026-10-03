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
import { CurrentUser } from "../auth/decorators/current-user.decorator";
import { JwtAuthGuard } from "../auth/guards/jwt-auth.guard";
import type { RequestUser } from "../auth/types";
import { CartService } from "./cart.service";
import { AddCartItemDto } from "./dto/add-cart-item.dto";
import { UpdateCartItemDto } from "./dto/update-cart-item.dto";

@Controller("cart")
@UseGuards(JwtAuthGuard)
export class CartController {
  constructor(private readonly cart: CartService) {}

  @Get()
  getCart(@CurrentUser() user: RequestUser) {
    return this.cart.getCart(user.id);
  }

  @Post("items")
  addItem(@CurrentUser() user: RequestUser, @Body() dto: AddCartItemDto) {
    return this.cart.addItem(user.id, dto.productId, dto.quantity);
  }

  @Patch("items/:productId")
  updateQuantity(
    @CurrentUser() user: RequestUser,
    @Param("productId", ParseUUIDPipe) productId: string,
    @Body() dto: UpdateCartItemDto,
  ) {
    return this.cart.updateQuantity(user.id, productId, dto.quantity);
  }

  @Delete("items/:productId")
  async removeItem(
    @CurrentUser() user: RequestUser,
    @Param("productId", ParseUUIDPipe) productId: string,
  ): Promise<Record<string, never>> {
    await this.cart.removeItem(user.id, productId);
    return {};
  }

  @Delete()
  async clear(@CurrentUser() user: RequestUser): Promise<Record<string, never>> {
    await this.cart.clear(user.id);
    return {};
  }
}

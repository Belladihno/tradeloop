import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
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
import { CreateProductDto } from "./dto/create-product.dto";
import { ProductQueryDto } from "./dto/product-query.dto";
import { UpdateProductDto } from "./dto/update-product.dto";
import { ProductsService } from "./products.service";

const productExample = {
  name: "Handmade Leather Tote",
  description: "Full-grain leather tote, hand-stitched in Lagos",
  price: "45000.00",
  categoryId: "0193e2c0-7a2e-7a2e-8a2e-8a2e8a2e8a2e",
  stock: 12,
  imageUrl: "https://cdn.tradeloop.com/products/tote.jpg",
};

@ApiTags("products")
@Controller("products")
export class ProductsController {
  constructor(private readonly products: ProductsService) {}

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.SELLER, UserRole.ADMIN)
  @Post()
  @WriteThrottle()
  @ApiBearerAuth()
  @ApiOperation({ summary: "Create a product (sellers only)" })
  @ApiBody({ schema: { example: productExample } })
  @ApiResponse({ status: 201, description: "Product created" })
  @ApiCommonErrors("/api/v1/products")
  create(@CurrentUser() user: RequestUser, @Body() dto: CreateProductDto) {
    return this.products.create(user.id, user.role, dto);
  }

  @Get()
  @ApiOperation({ summary: "Search and filter the public catalog" })
  @ApiResponse({ status: 200, description: "Product page" })
  @ApiCommonErrors("/api/v1/products")
  list(@Query() query: ProductQueryDto) {
    return this.products.list(query);
  }

  @Get(":slug")
  @ApiOperation({ summary: "Get a product by slug" })
  @ApiResponse({ status: 200, description: "Product detail" })
  @ApiCommonErrors("/api/v1/products/:slug")
  detail(@Param("slug") slug: string) {
    return this.products.getBySlug(slug);
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.SELLER, UserRole.ADMIN)
  @Patch(":id")
  @WriteThrottle()
  @ApiBearerAuth()
  @ApiOperation({ summary: "Update a product (owner or admin)" })
  @ApiBody({ schema: { example: { price: "42000.00", stock: 10 } } })
  @ApiResponse({ status: 200, description: "Product updated" })
  @ApiCommonErrors("/api/v1/products/:id")
  update(
    @CurrentUser() user: RequestUser,
    @Param("id", ParseUUIDPipe) id: string,
    @Body() dto: UpdateProductDto,
  ) {
    return this.products.update(user.id, user.role, id, dto);
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.SELLER, UserRole.ADMIN)
  @Delete(":id")
  @WriteThrottle()
  @ApiBearerAuth()
  @ApiOperation({ summary: "Delete a product (owner or admin)" })
  @ApiResponse({ status: 200, description: "Product deleted" })
  @ApiCommonErrors("/api/v1/products/:id")
  remove(
    @CurrentUser() user: RequestUser,
    @Param("id", ParseUUIDPipe) id: string,
  ) {
    return this.products.remove(user.id, user.role, id);
  }
}

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
import { UserRole } from "@tradeloop/types";
import { ApiBearerAuth, ApiBody, ApiOperation, ApiResponse, ApiTags } from "@nestjs/swagger";
import { Roles } from "../auth/decorators/roles.decorator";
import { JwtAuthGuard } from "../auth/guards/jwt-auth.guard";
import { RolesGuard } from "../auth/guards/roles.guard";
import { ApiCommonErrors } from "../common/swagger/api-responses";
import { WriteThrottle } from "../common/throttle/rate-limit";
import { CategoriesService } from "./categories.service";
import { CreateCategoryDto } from "./dto/create-category.dto";
import { UpdateCategoryDto } from "./dto/update-category.dto";

@ApiTags("categories")
@Controller("categories")
export class CategoriesController {
  constructor(private readonly categories: CategoriesService) {}

  @Get()
  @ApiOperation({ summary: "Get the public category tree" })
  @ApiResponse({ status: 200, description: "Category tree" })
  @ApiCommonErrors("/api/v1/categories")
  tree() {
    return this.categories.listTree();
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.ADMIN)
  @Post()
  @WriteThrottle()
  @ApiBearerAuth()
  @ApiOperation({ summary: "Create a category (admin only)" })
  @ApiBody({ schema: { example: { name: "Handbags", parentId: null } } })
  @ApiResponse({ status: 201, description: "Category created" })
  @ApiCommonErrors("/api/v1/categories")
  create(@Body() dto: CreateCategoryDto) {
    return this.categories.create(dto);
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.ADMIN)
  @Patch(":id")
  @WriteThrottle()
  @ApiBearerAuth()
  @ApiOperation({ summary: "Rename or reparent a category (admin only)" })
  @ApiBody({ schema: { example: { name: "Leather Goods" } } })
  @ApiResponse({ status: 200, description: "Category updated" })
  @ApiCommonErrors("/api/v1/categories/:id")
  update(@Param("id", ParseUUIDPipe) id: string, @Body() dto: UpdateCategoryDto) {
    return this.categories.update(id, dto);
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.ADMIN)
  @Delete(":id")
  @WriteThrottle()
  @ApiBearerAuth()
  @ApiOperation({ summary: "Delete a category (admin only)" })
  @ApiResponse({ status: 200, description: "Category deleted" })
  @ApiCommonErrors("/api/v1/categories/:id")
  remove(@Param("id", ParseUUIDPipe) id: string) {
    return this.categories.remove(id);
  }
}

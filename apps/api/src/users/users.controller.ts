import { Controller, Get, NotFoundException, UseGuards } from "@nestjs/common";
import { ApiBearerAuth, ApiOperation, ApiResponse, ApiTags } from "@nestjs/swagger";
import { CurrentUser } from "../auth/decorators/current-user.decorator";
import { JwtAuthGuard } from "../auth/guards/jwt-auth.guard";
import type { RequestUser } from "../auth/types";
import { ApiCommonErrors } from "../common/swagger/api-responses";
import { UsersService } from "./users.service";

@ApiTags("users")
@ApiBearerAuth()
@Controller("users")
export class UsersController {
  constructor(private readonly users: UsersService) {}

  @UseGuards(JwtAuthGuard)
  @Get("me")
  @ApiOperation({ summary: "Get my user profile" })
  @ApiResponse({ status: 200, description: "User profile" })
  @ApiCommonErrors("/api/v1/users/me")
  async me(@CurrentUser() user: RequestUser): Promise<unknown> {
    const found = await this.users.findById(user.id);
    if (!found) throw new NotFoundException("User not found");
    return found;
  }
}

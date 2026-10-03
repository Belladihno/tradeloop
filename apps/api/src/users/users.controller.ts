import { Controller, Get, NotFoundException, UseGuards } from "@nestjs/common";
import { CurrentUser } from "../auth/decorators/current-user.decorator";
import { JwtAuthGuard } from "../auth/guards/jwt-auth.guard";
import type { RequestUser } from "../auth/types";
import { UsersService } from "./users.service";

@Controller("users")
export class UsersController {
  constructor(private readonly users: UsersService) {}

  @UseGuards(JwtAuthGuard)
  @Get("me")
  async me(@CurrentUser() user: RequestUser): Promise<unknown> {
    const found = await this.users.findById(user.id);
    if (!found) throw new NotFoundException("User not found");
    return found;
  }
}

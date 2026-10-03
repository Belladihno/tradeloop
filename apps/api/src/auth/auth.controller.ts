import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Post,
  Req,
  Res,
  UseGuards,
} from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import type { FastifyReply, FastifyRequest } from "fastify";
import type { Env } from "../config/env.validation";
import type { User } from "../users/entities/user.entity";
import { AuthService } from "./auth.service";
import { CurrentUser } from "./decorators/current-user.decorator";
import { LoginDto } from "./dto/login.dto";
import { RefreshDto } from "./dto/refresh.dto";
import { RegisterDto } from "./dto/register.dto";
import { GoogleAuthGuard } from "./guards/google-auth.guard";
import { JwtAuthGuard } from "./guards/jwt-auth.guard";
import type { RequestUser } from "./types";

@Controller("auth")
export class AuthController {
  constructor(
    private readonly auth: AuthService,
    private readonly config: ConfigService<Env, true>,
  ) {}

  @Post("register")
  register(@Body() dto: RegisterDto) {
    return this.auth.register(dto);
  }

  @HttpCode(HttpStatus.OK)
  @Post("login")
  login(@Body() dto: LoginDto) {
    return this.auth.login(dto);
  }

  @HttpCode(HttpStatus.OK)
  @Post("refresh")
  refresh(@Body() dto: RefreshDto) {
    return this.auth.refresh(dto);
  }

  @UseGuards(JwtAuthGuard)
  @HttpCode(HttpStatus.OK)
  @Post("logout")
  async logout(@CurrentUser() user: RequestUser): Promise<Record<string, never>> {
    await this.auth.logout(user);
    return {};
  }

  @UseGuards(GoogleAuthGuard)
  @Get("google")
  google(): void {}

  @UseGuards(GoogleAuthGuard)
  @Get("google/callback")
  async googleCallback(
    @Req() req: FastifyRequest & { user: User },
    @Res() reply: FastifyReply,
  ): Promise<void> {
    const session = await this.auth.googleLogin(req.user);
    const webUrl = this.config.get("WEB_URL", { infer: true });
    const params = new URLSearchParams({
      accessToken: session.accessToken,
      refreshToken: session.refreshToken,
    });
    void reply.redirect(`${webUrl}/auth/google/callback?${params.toString()}`);
  }
}

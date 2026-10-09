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
import { ApiBody, ApiOperation, ApiResponse, ApiTags } from "@nestjs/swagger";
import { ConfigService } from "@nestjs/config";
import type { FastifyReply, FastifyRequest } from "fastify";
import { StrictThrottle } from "../common/throttle/rate-limit";
import { ApiCommonErrors } from "../common/swagger/api-responses";
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

const sessionExample = {
  success: true,
  message: "Resource created successfully",
  data: {
    accessToken: "eyJhbGciOiJIUzI1NiIs...",
    refreshToken: "eyJhbGciOiJIUzI1NiIs...",
    user: { id: "0193e2c0-...", email: "ada@example.com", role: "BUYER" },
  },
};

@ApiTags("auth")
@StrictThrottle()
@Controller("auth")
export class AuthController {
  constructor(
    private readonly auth: AuthService,
    private readonly config: ConfigService<Env, true>,
  ) {}

  @Post("register")
  @ApiOperation({ summary: "Register a buyer or seller account" })
  @ApiBody({
      schema: {
        example: { email: "ada@example.com", password: "correct-horse-9", role: "BUYER" },
      },
    })
  @ApiResponse({ status: 201, description: "Account created", schema: { example: sessionExample } })
  @ApiCommonErrors("/api/v1/auth/register")
  register(@Body() dto: RegisterDto) {
    return this.auth.register(dto);
  }

  @HttpCode(HttpStatus.OK)
  @Post("login")
  @ApiOperation({ summary: "Log in with email and password" })
  @ApiBody({
      schema: { example: { email: "ada@example.com", password: "correct-horse-9" } },
    })
  @ApiResponse({ status: 200, description: "Logged in", schema: { example: sessionExample } })
  @ApiCommonErrors("/api/v1/auth/login")
  login(@Body() dto: LoginDto) {
    return this.auth.login(dto);
  }

  @HttpCode(HttpStatus.OK)
  @Post("refresh")
  @ApiOperation({ summary: "Rotate the access token with a refresh token" })
  @ApiBody({
      schema: { example: { refreshToken: "eyJhbGciOiJIUzI1NiIs..." } },
    })
  @ApiResponse({
      status: 200,
      description: "Tokens rotated",
      schema: {
        example: {
          success: true,
          message: "Request successful",
          data: {
            accessToken: "eyJhbGciOiJIUzI1NiIs...",
            refreshToken: "eyJhbGciOiJIUzI1NiIs...",
          },
        },
      },
    })
  @ApiCommonErrors("/api/v1/auth/refresh")
  refresh(@Body() dto: RefreshDto) {
    return this.auth.refresh(dto);
  }

  @UseGuards(JwtAuthGuard)
  @HttpCode(HttpStatus.OK)
  @Post("logout")
  @ApiOperation({ summary: "Revoke the current refresh token" })
  @ApiResponse({
      status: 200,
      description: "Logged out",
      schema: { example: { success: true, message: "Request successful", data: {} } },
    })
  @ApiCommonErrors("/api/v1/auth/logout")
  async logout(@CurrentUser() user: RequestUser): Promise<Record<string, never>> {
    await this.auth.logout(user);
    return {};
  }

  @UseGuards(GoogleAuthGuard)
  @Get("google")
  @ApiOperation({ summary: "Start Google OAuth (redirects to Google)" })
  @ApiResponse({ status: 302, description: "Redirect to Google consent screen" })
  @ApiCommonErrors("/api/v1/auth/google")
  google(): void {}

  @UseGuards(GoogleAuthGuard)
  @Get("google/callback")
  @ApiOperation({ summary: "Google OAuth callback (redirects to the web app with tokens)" })
  @ApiResponse({ status: 302, description: "Redirect to the web app" })
  @ApiCommonErrors("/api/v1/auth/google/callback")
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

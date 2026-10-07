import {
  ConflictException,
  ForbiddenException,
  Inject,
  Injectable,
  UnauthorizedException,
} from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { JwtService } from "@nestjs/jwt";
import { hash, verify } from "argon2";
import Redis from "ioredis";
import { nanoid } from "nanoid";
import type {
  LoginInput,
  RefreshInput,
  RegisterInput,
} from "@tradeloop/validators";
import type { Env } from "../config/env.validation";
import { REDIS_CLIENT } from "../redis/redis.module";
import type { User } from "../users/entities/user.entity";
import { UsersService } from "../users/users.service";
import { WalletService } from "../wallet/wallet.service";
import { FraudService } from "../fraud/fraud.service";
import {
  blocklistKey,
  type RequestUser,
  type TokenPair,
  type VerifiedRefreshPayload,
} from "./types";

@Injectable()
export class AuthService {
  constructor(
    private readonly users: UsersService,
    private readonly wallets: WalletService,
    private readonly jwt: JwtService,
    private readonly config: ConfigService<Env, true>,
    private readonly fraud: FraudService,
    @Inject(REDIS_CLIENT) private readonly redis: Redis,
  ) {}

  async register(input: RegisterInput): Promise<TokenPair & { user: User }> {
    const email = input.email.toLowerCase().trim();
    const existing = await this.users.findByEmail(email);
    if (existing) {
      throw new ConflictException("An account with this email already exists");
    }
    const user = await this.users.create({
      email,
      passwordHash: await hash(input.password),
      role: input.role,
    });
    await this.wallets.ensureBuyerWallet(user.id);
    return this.buildSession(user);
  }

  async login(input: LoginInput): Promise<TokenPair & { user: User }> {
    const email = input.email.toLowerCase().trim();
    const user = await this.users.findByEmail(email);
    if (!user || !user.passwordHash) {
      await this.fraud.screenLogin(email);
      throw new UnauthorizedException("Invalid email or password");
    }
    const valid = await verify(user.passwordHash, input.password);
    if (!valid) {
      await this.fraud.screenLogin(email);
      throw new UnauthorizedException("Invalid email or password");
    }
    return this.buildSession(user);
  }

  async refresh(input: RefreshInput): Promise<TokenPair & { user: User }> {
    let payload: VerifiedRefreshPayload;
    try {
      payload = await this.jwt.verifyAsync(input.refreshToken);
    } catch {
      throw new UnauthorizedException("Invalid or expired refresh token");
    }
    if (payload.type !== "refresh") {
      throw new UnauthorizedException("Invalid or expired refresh token");
    }
    const user = await this.users.findById(payload.sub);
    if (!user || !user.refreshTokenHash) {
      throw new UnauthorizedException("Session has expired");
    }
    const matches = await verify(user.refreshTokenHash, input.refreshToken);
    if (!matches) {
      await this.users.setRefreshTokenHash(user.id, null);
      throw new ForbiddenException(
        "Session reuse detected. All sessions have been revoked",
      );
    }
    return this.buildSession(user);
  }

  async logout(user: RequestUser): Promise<void> {
    const ttl = user.exp - Math.floor(Date.now() / 1000);
    if (ttl > 0) {
      await this.redis.set(blocklistKey(user.jti), "1", "EX", ttl);
    }
    await this.users.setRefreshTokenHash(user.id, null);
  }

  async googleLogin(user: User): Promise<TokenPair & { user: User }> {
    return this.buildSession(user);
  }

  private async buildSession(user: User): Promise<TokenPair & { user: User }> {
    const pair = await this.issueTokens(user);
    await this.users.setRefreshTokenHash(user.id, await hash(pair.refreshToken));
    return { ...pair, user };
  }

  private async issueTokens(user: User): Promise<TokenPair> {    const accessExpiry = expiryToSeconds(
      this.config.get("JWT_ACCESS_EXPIRY", { infer: true }),
    );
    const refreshExpiry = expiryToSeconds(
      this.config.get("JWT_REFRESH_EXPIRY", { infer: true }),
    );
    const [accessToken, refreshToken] = await Promise.all([
      this.jwt.signAsync(
        {
          sub: user.id,
          email: user.email,
          role: user.role,
          jti: nanoid(),
          type: "access",
        },
        { expiresIn: accessExpiry },
      ),
      this.jwt.signAsync(
        { sub: user.id, jti: nanoid(), type: "refresh" },
        { expiresIn: refreshExpiry },
      ),
    ]);
    return { accessToken, refreshToken };
  }
}

const EXPIRY_PATTERN = /^(\d+)([smhd])$/;

function expiryToSeconds(value: string): number {
  const match = EXPIRY_PATTERN.exec(value);
  if (!match) throw new Error(`Invalid expiry format: ${value}`);
  const multipliers = { s: 1, m: 60, h: 3600, d: 86400 } as const;
  const unit = match[2] as keyof typeof multipliers;
  return Number(match[1]) * multipliers[unit];
}

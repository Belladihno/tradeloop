import { Inject, Injectable, UnauthorizedException } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { PassportStrategy } from "@nestjs/passport";
import { ExtractJwt, Strategy } from "passport-jwt";
import Redis from "ioredis";
import type { Env } from "../../config/env.validation";
import { REDIS_CLIENT } from "../../redis/redis.module";
import { UsersService } from "../../users/users.service";
import {
  blocklistKey,
  type RequestUser,
  type VerifiedAccessPayload,
} from "../types";

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy, "jwt") {
  constructor(
    config: ConfigService<Env, true>,
    private readonly users: UsersService,
    @Inject(REDIS_CLIENT) private readonly redis: Redis,
  ) {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: config.get("JWT_SECRET", { infer: true }),
    });
  }

  async validate(payload: VerifiedAccessPayload): Promise<RequestUser> {
    if (payload.type !== "access") {
      throw new UnauthorizedException("Invalid token");
    }
    const revoked = await this.redis.exists(blocklistKey(payload.jti));
    if (revoked) throw new UnauthorizedException("Session has been revoked");
    const user = await this.users.findById(payload.sub);
    if (!user) throw new UnauthorizedException("User no longer exists");
    return {
      id: user.id,
      email: user.email,
      role: user.role,
      jti: payload.jti,
      exp: payload.exp,
    };
  }
}

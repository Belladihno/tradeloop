import { Injectable, UnauthorizedException } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { PassportStrategy } from "@nestjs/passport";
import { Strategy, type Profile } from "passport-google-oauth20";
import type { Env } from "../../config/env.validation";
import type { User } from "../../users/entities/user.entity";
import { UsersService } from "../../users/users.service";

@Injectable()
export class GoogleStrategy extends PassportStrategy(Strategy, "google") {
  constructor(
    config: ConfigService<Env, true>,
    private readonly users: UsersService,
  ) {
    super({
      clientID: config.get("GOOGLE_CLIENT_ID", { infer: true }),
      clientSecret: config.get("GOOGLE_CLIENT_SECRET", { infer: true }),
      callbackURL: config.get("GOOGLE_CALLBACK_URL", { infer: true }),
      scope: ["email", "profile"],
    });
  }

  async validate(
    _accessToken: string,
    _refreshToken: string,
    profile: Profile,
  ): Promise<User> {
    const byGoogleId = await this.users.findByGoogleId(profile.id);
    if (byGoogleId) return byGoogleId;

    const email = profile.emails?.[0]?.value?.toLowerCase();
    if (!email) throw new UnauthorizedException("Google account has no email address");

    const byEmail = await this.users.findByEmail(email);
    if (byEmail) {
      await this.users.linkGoogleId(byEmail.id, profile.id);
      byEmail.googleId = profile.id;
      return byEmail;
    }
    return this.users.create({ email, googleId: profile.id, isVerified: true });
  }
}

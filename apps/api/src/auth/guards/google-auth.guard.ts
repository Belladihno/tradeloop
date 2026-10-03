import {
  ExecutionContext,
  Injectable,
  ServiceUnavailableException,
} from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { AuthGuard } from "@nestjs/passport";
import type { Env } from "../../config/env.validation";

@Injectable()
export class GoogleAuthGuard extends AuthGuard("google") {
  constructor(private readonly config: ConfigService<Env, true>) {
    super();
  }

  canActivate(context: ExecutionContext): boolean | Promise<boolean> {
    const clientID = this.config.get("GOOGLE_CLIENT_ID", { infer: true });
    const clientSecret = this.config.get("GOOGLE_CLIENT_SECRET", { infer: true });
    const callbackURL = this.config.get("GOOGLE_CALLBACK_URL", { infer: true });
    if (!clientID || !clientSecret || !callbackURL) {
      throw new ServiceUnavailableException("Google sign-in is not configured");
    }
    const result = super.canActivate(context);
    return result as boolean | Promise<boolean>;
  }
}

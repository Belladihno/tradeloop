import { createParamDecorator, ExecutionContext } from "@nestjs/common";
import type { RequestUser } from "../types";

export const CurrentUser = createParamDecorator(
  (data: keyof RequestUser | undefined, ctx: ExecutionContext) => {
    const user = ctx.switchToHttp().getRequest<{ user: RequestUser }>().user;
    return data ? user?.[data] : user;
  },
);

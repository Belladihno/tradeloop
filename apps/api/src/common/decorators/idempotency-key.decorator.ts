import { createParamDecorator, ExecutionContext } from "@nestjs/common";

export const IdempotencyKey = createParamDecorator(
  (_data: unknown, ctx: ExecutionContext): string | undefined => {
    const headers = ctx
      .switchToHttp()
      .getRequest<{ headers: Record<string, string | undefined> }>().headers;
    return headers["idempotency-key"];
  },
);

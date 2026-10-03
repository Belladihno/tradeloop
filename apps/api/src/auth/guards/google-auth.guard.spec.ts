import type { ExecutionContext } from "@nestjs/common";
import { ServiceUnavailableException } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { describe, expect, it, vi } from "vitest";
import { GoogleAuthGuard } from "./google-auth.guard";

describe("GoogleAuthGuard", () => {
  it("throws 503 when Google OAuth is not configured", () => {
    const config = { get: vi.fn(() => "") };
    const guard = new GoogleAuthGuard(config as unknown as ConfigService);
    const context = {
      switchToHttp: () => ({ getRequest: () => ({}), getResponse: () => ({}) }),
      getHandler: () => ({}),
      getClass: () => ({}),
    } as unknown as ExecutionContext;

    expect(() => guard.canActivate(context)).toThrow(ServiceUnavailableException);
  });
});

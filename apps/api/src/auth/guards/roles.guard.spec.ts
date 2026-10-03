import type { ExecutionContext } from "@nestjs/common";
import { ForbiddenException } from "@nestjs/common";
import { Reflector } from "@nestjs/core";
import { describe, expect, it, vi } from "vitest";
import { UserRole } from "@tradeloop/types";
import { RolesGuard } from "./roles.guard";
import type { RequestUser } from "../types";

const seller: RequestUser = {
  id: "u1",
  email: "seller@tradeloop.test",
  role: UserRole.SELLER,
  jti: "jti",
  exp: 0,
};

function setup(required: UserRole[] | undefined, user?: RequestUser) {
  const reflector = { getAllAndOverride: vi.fn(() => required) };
  const guard = new RolesGuard(reflector as unknown as Reflector);
  const context = {
    getHandler: () => ({}),
    getClass: () => ({}),
    switchToHttp: () => ({ getRequest: () => ({ user }) }),
  } as unknown as ExecutionContext;
  return { guard, context };
}

describe("RolesGuard", () => {
  it("allows routes without role metadata", () => {
    const { guard, context } = setup(undefined, seller);
    expect(guard.canActivate(context)).toBe(true);
  });

  it("allows users holding a required role", () => {
    const { guard, context } = setup([UserRole.SELLER, UserRole.ADMIN], seller);
    expect(guard.canActivate(context)).toBe(true);
  });

  it("rejects users without a required role", () => {
    const { guard, context } = setup([UserRole.ADMIN], seller);
    expect(() => guard.canActivate(context)).toThrow(ForbiddenException);
  });

  it("rejects unauthenticated requests on guarded routes", () => {
    const { guard, context } = setup([UserRole.BUYER], undefined);
    expect(() => guard.canActivate(context)).toThrow(ForbiddenException);
  });
});

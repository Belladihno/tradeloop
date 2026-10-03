import { UnauthorizedException } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import type Redis from "ioredis";
import { describe, expect, it, vi } from "vitest";
import { UserRole } from "@tradeloop/types";
import type { User } from "../users/entities/user.entity";
import { UsersService } from "../users/users.service";
import { JwtStrategy } from "./strategies/jwt.strategy";
import type { VerifiedAccessPayload } from "./types";

function payload(overrides: Partial<VerifiedAccessPayload> = {}): VerifiedAccessPayload {
  return {
    sub: "user-1",
    email: "buyer@tradeloop.test",
    role: UserRole.BUYER,
    jti: "jti-1",
    type: "access",
    exp: Math.floor(Date.now() / 1000) + 900,
    iat: Math.floor(Date.now() / 1000),
    ...overrides,
  };
}

function setup() {
  const redis = { exists: vi.fn(async () => 0) };
  const users = { findById: vi.fn() };
  const config = { get: () => "test-secret-minimum-32-characters-long" };
  const strategy = new JwtStrategy(
    config as unknown as ConfigService,
    users as unknown as UsersService,
    redis as unknown as Redis,
  );
  return { strategy, users, redis };
}

describe("JwtStrategy", () => {
  it("returns the request user for a valid token", async () => {
    const { strategy, users } = setup();
    users.findById.mockResolvedValue({
      id: "user-1",
      email: "buyer@tradeloop.test",
      role: UserRole.SELLER,
    } as User);

    const result = await strategy.validate(payload());

    expect(result).toEqual({
      id: "user-1",
      email: "buyer@tradeloop.test",
      role: UserRole.SELLER,
      jti: "jti-1",
      exp: payload().exp,
    });
  });

  it("rejects non-access tokens", async () => {
    const { strategy } = setup();

    await expect(
      strategy.validate({ ...payload(), type: "refresh" } as unknown as VerifiedAccessPayload),
    ).rejects.toBeInstanceOf(UnauthorizedException);
  });

  it("rejects blocklisted tokens", async () => {
    const { strategy, redis } = setup();
    redis.exists.mockResolvedValue(1);

    await expect(strategy.validate(payload())).rejects.toBeInstanceOf(
      UnauthorizedException,
    );
  });

  it("rejects tokens for deleted users", async () => {
    const { strategy, users } = setup();
    users.findById.mockResolvedValue(null);

    await expect(strategy.validate(payload())).rejects.toBeInstanceOf(
      UnauthorizedException,
    );
  });
});

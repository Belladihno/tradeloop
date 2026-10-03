import { UnauthorizedException } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { describe, expect, it, vi } from "vitest";
import type { User } from "../users/entities/user.entity";
import { UsersService } from "../users/users.service";
import { GoogleStrategy } from "./strategies/google.strategy";
import type { Profile } from "passport-google-oauth20";

function profile(overrides: Partial<Profile> = {}): Profile {
  return {
    id: "google-123",
    emails: [{ value: "Buyer@Tradeloop.test", verified: "true" }],
    ...overrides,
  } as Profile;
}

function setup() {
  const users = {
    findByGoogleId: vi.fn(),
    findByEmail: vi.fn(),
    create: vi.fn(),
    linkGoogleId: vi.fn(),
  };
  const config = { get: () => "test-value" };
  const strategy = new GoogleStrategy(
    config as unknown as ConfigService,
    users as unknown as UsersService,
  );
  return { strategy, users };
}

describe("GoogleStrategy", () => {
  it("returns the user when the Google ID is already linked", async () => {
    const { strategy, users } = setup();
    const existing = { id: "u1", googleId: "google-123" } as User;
    users.findByGoogleId.mockResolvedValue(existing);

    const result = await strategy.validate("at", "rt", profile());

    expect(result).toBe(existing);
    expect(users.findByEmail).not.toHaveBeenCalled();
  });

  it("links the Google ID when the email already exists", async () => {
    const { strategy, users } = setup();
    users.findByGoogleId.mockResolvedValue(null);
    const existing = { id: "u1", googleId: null } as User;
    users.findByEmail.mockResolvedValue(existing);
    users.linkGoogleId.mockResolvedValue(undefined);

    const result = await strategy.validate("at", "rt", profile());

    expect(users.linkGoogleId).toHaveBeenCalledWith("u1", "google-123");
    expect(result.googleId).toBe("google-123");
    expect(users.create).not.toHaveBeenCalled();
  });

  it("creates a verified user for a first-time Google sign-in", async () => {
    const { strategy, users } = setup();
    users.findByGoogleId.mockResolvedValue(null);
    users.findByEmail.mockResolvedValue(null);
    const created = { id: "u2" } as User;
    users.create.mockResolvedValue(created);

    const result = await strategy.validate("at", "rt", profile());

    expect(users.create).toHaveBeenCalledWith({
      email: "buyer@tradeloop.test",
      googleId: "google-123",
      isVerified: true,
    });
    expect(result).toBe(created);
  });

  it("rejects Google profiles without an email", async () => {
    const { strategy, users } = setup();
    users.findByGoogleId.mockResolvedValue(null);

    await expect(
      strategy.validate("at", "rt", profile({ emails: [] })),
    ).rejects.toBeInstanceOf(UnauthorizedException);
  });
});

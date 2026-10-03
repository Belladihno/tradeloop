import {
  ConflictException,
  ForbiddenException,
  UnauthorizedException,
} from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { JwtService } from "@nestjs/jwt";
import { hash, verify } from "argon2";
import type Redis from "ioredis";
import { beforeEach, describe, expect, it, vi, type Mock } from "vitest";
import { UserRole } from "@tradeloop/types";
import type { User } from "../users/entities/user.entity";
import { UsersService } from "../users/users.service";
import { WalletService } from "../wallet/wallet.service";
import { AuthService } from "./auth.service";
import type { RequestUser } from "./types";

const TEST_SECRET = "test-secret-minimum-32-characters-long";

interface MockUsersService {
  findByEmail: Mock;
  findById: Mock;
  create: Mock;
  setRefreshTokenHash: Mock;
}

interface MockWalletService {
  ensureBuyerWallet: Mock;
}

function fakeRedis() {
  const store = new Map<string, string>();
  return {
    store,
    get: vi.fn(async (key: string) => store.get(key) ?? null),
    set: vi.fn(async (key: string, value: string) => {
      store.set(key, value);
      return "OK";
    }),
    exists: vi.fn(async (key: string) => (store.has(key) ? 1 : 0)),
    del: vi.fn(async (key: string) => (store.delete(key) ? 1 : 0)),
  };
}

function user(overrides: Partial<User> = {}): User {
  return {
    id: "01a0ff68-0b08-7d5a-a268-c4e188211e70",
    email: "buyer@tradeloop.test",
    passwordHash: null,
    googleId: null,
    role: UserRole.BUYER,
    isVerified: false,
    refreshTokenHash: null,
    createdAt: new Date(),
    updatedAt: new Date(),
    deletedAt: null,
    ...overrides,
  } as User;
}

function setup() {
  const redis = fakeRedis();
  const users: MockUsersService = {
    findByEmail: vi.fn(),
    findById: vi.fn(),
    create: vi.fn(),
    setRefreshTokenHash: vi.fn(),
  };
  const wallets: MockWalletService = {
    ensureBuyerWallet: vi.fn(async () => user()),
  };
  const config = {
    get: (key: string): string => {
      if (key === "JWT_ACCESS_EXPIRY") return "15m";
      if (key === "JWT_REFRESH_EXPIRY") return "7d";
      throw new Error(`Unexpected config key: ${key}`);
    },
  };
  const service = new AuthService(
    users as unknown as UsersService,
    wallets as unknown as WalletService,
    new JwtService({ secret: TEST_SECRET }),
    config as unknown as ConfigService,
    redis as unknown as Redis,
  );
  return {
    service,
    users,
    wallets,
    jwt: new JwtService({ secret: TEST_SECRET }),
    redis,
  };
}

describe("AuthService", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  describe("register", () => {
    it("creates a user with a hashed password and returns a token pair", async () => {
      const { service, users, wallets } = await setup();
      users.findByEmail.mockResolvedValue(null);
      users.create.mockImplementation(async (data: Partial<User>) => user(data));
      users.setRefreshTokenHash.mockResolvedValue(undefined);

      const result = await service.register({
        email: "Buyer@Tradeloop.test",
        password: "password123",
        role: UserRole.BUYER,
      });

      expect(users.findByEmail).toHaveBeenCalledWith("buyer@tradeloop.test");
      expect(users.create).toHaveBeenCalledWith(
        expect.objectContaining({ email: "buyer@tradeloop.test" }),
      );
      expect(wallets.ensureBuyerWallet).toHaveBeenCalled();
      const storedHash = users.create.mock.calls[0][0].passwordHash as string;
      expect(storedHash).not.toBe("password123");
      expect(await verify(storedHash, "password123")).toBe(true);
      expect(result.accessToken).toBeTruthy();
      expect(result.refreshToken).toBeTruthy();
      expect(result.user.email).toBe("buyer@tradeloop.test");
      const savedHash = users.setRefreshTokenHash.mock.calls[0][1] as string;
      expect(await verify(savedHash, result.refreshToken)).toBe(true);
    });

    it("rejects an email that is already registered", async () => {
      const { service, users } = await setup();
      users.findByEmail.mockResolvedValue(user());

      await expect(
        service.register({
          email: "buyer@tradeloop.test",
          password: "password123",
          role: UserRole.BUYER,
        }),
      ).rejects.toBeInstanceOf(ConflictException);
      expect(users.create).not.toHaveBeenCalled();
    });
  });

  describe("login", () => {
    it("returns a token pair for valid credentials", async () => {
      const { service, users } = await setup();
      const existing = user({ passwordHash: await hash("password123") });
      users.findByEmail.mockResolvedValue(existing);
      users.setRefreshTokenHash.mockResolvedValue(undefined);

      const result = await service.login({
        email: "buyer@tradeloop.test",
        password: "password123",
      });

      expect(result.accessToken).toBeTruthy();
      expect(result.refreshToken).toBeTruthy();
      expect(result.user.id).toBe(existing.id);
    });

    it("rejects unknown emails without distinguishing the cause", async () => {
      const { service, users } = await setup();
      users.findByEmail.mockResolvedValue(null);

      await expect(
        service.login({ email: "nobody@tradeloop.test", password: "x" }),
      ).rejects.toBeInstanceOf(UnauthorizedException);
    });

    it("rejects Google-only accounts on password login", async () => {
      const { service, users } = await setup();
      users.findByEmail.mockResolvedValue(user({ googleId: "g123" }));

      await expect(
        service.login({ email: "buyer@tradeloop.test", password: "x" }),
      ).rejects.toBeInstanceOf(UnauthorizedException);
    });

    it("rejects wrong passwords", async () => {
      const { service, users } = await setup();
      users.findByEmail.mockResolvedValue(
        user({ passwordHash: await hash("password123") }),
      );

      await expect(
        service.login({ email: "buyer@tradeloop.test", password: "wrong" }),
      ).rejects.toBeInstanceOf(UnauthorizedException);
    });
  });

  describe("refresh", () => {
    it("rotates the pair and invalidates the old refresh token", async () => {
      const { service, users } = await setup();
      const existing = user({ passwordHash: await hash("password123") });
      users.findByEmail.mockResolvedValue(null);
      users.findById.mockResolvedValue(existing);
      users.create.mockImplementation(async (data: Partial<User>) => user(data));
      let storedHash: string | null = null;
      users.setRefreshTokenHash.mockImplementation(async (_id: string, h: string | null) => {
        storedHash = h;
        existing.refreshTokenHash = h;
      });

      const first = await service.register({
        email: "buyer@tradeloop.test",
        password: "password123",
        role: UserRole.BUYER,
      });
      const second = await service.refresh({ refreshToken: first.refreshToken });

      expect(second.refreshToken).not.toBe(first.refreshToken);
      expect(storedHash).not.toBeNull();
      expect(await verify(storedHash as string, second.refreshToken)).toBe(true);
      await expect(
        service.refresh({ refreshToken: first.refreshToken }),
      ).rejects.toBeInstanceOf(ForbiddenException);
    });

    it("rejects malformed tokens", async () => {
      const { service } = await setup();

      await expect(
        service.refresh({ refreshToken: "not-a-token" }),
      ).rejects.toBeInstanceOf(UnauthorizedException);
    });

    it("rejects access tokens used as refresh tokens", async () => {
      const { service, users, jwt } = await setup();
      const existing = user();
      users.findById.mockResolvedValue(existing);
      const accessToken = await jwt.signAsync({
        sub: existing.id,
        email: existing.email,
        role: existing.role,
        jti: "access-jti",
        type: "access",
      });

      await expect(service.refresh({ refreshToken: accessToken })).rejects.toBeInstanceOf(
        UnauthorizedException,
      );
    });

    it("treats reuse of a rotated token as theft and clears the session", async () => {
      const { service, users, jwt } = await setup();
      const existing = user({ refreshTokenHash: await hash("original-token") });
      users.findById.mockResolvedValue(existing);
      users.setRefreshTokenHash.mockResolvedValue(undefined);
      const forged = await jwt.signAsync(
        { sub: existing.id, jti: "other-jti", type: "refresh" },
        { expiresIn: 600 },
      );

      await expect(service.refresh({ refreshToken: forged })).rejects.toBeInstanceOf(
        ForbiddenException,
      );
      expect(users.setRefreshTokenHash).toHaveBeenCalledWith(existing.id, null);
    });
  });

  describe("logout", () => {
    it("blocklists the access token and clears the refresh hash", async () => {
      const { service, users, jwt, redis } = await setup();
      users.setRefreshTokenHash.mockResolvedValue(undefined);
      const accessToken = await jwt.signAsync(
        {
          sub: "user-id",
          email: "buyer@tradeloop.test",
          role: UserRole.BUYER,
          jti: "access-jti",
          type: "access",
        },
        { expiresIn: 900 },
      );
      const decoded = jwt.decode(accessToken) as { jti: string; exp: number };
      const requestUser: RequestUser = {
        id: "user-id",
        email: "buyer@tradeloop.test",
        role: UserRole.BUYER,
        jti: decoded.jti,
        exp: decoded.exp,
      };

      await service.logout(requestUser);

      expect(redis.set).toHaveBeenCalledWith(
        "blocklist:access-jti",
        "1",
        "EX",
        expect.any(Number),
      );
      const ttl = (redis.set.mock.calls[0] as unknown[])[3] as number;
      expect(ttl).toBeGreaterThan(800);
      expect(ttl).toBeLessThanOrEqual(900);
      expect(users.setRefreshTokenHash).toHaveBeenCalledWith("user-id", null);
    });
  });
});

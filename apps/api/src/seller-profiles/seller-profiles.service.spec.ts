import {
  ConflictException,
  NotFoundException,
} from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { describe, expect, it, vi, type Mock } from "vitest";
import { SellerStatus, UserRole } from "@tradeloop/types";
import { EncryptionService } from "../common/crypto/encryption.service";
import { InvalidStateTransitionException } from "../common/exceptions/invalid-state-transition.exception";
import { UsersService } from "../users/users.service";
import { WalletService } from "../wallet/wallet.service";
import type { SellerProfile } from "./entities/seller-profile.entity";
import { SellerProfilesRepository } from "./seller-profiles.repository";
import { SellerProfilesService } from "./seller-profiles.service";

interface MockProfilesRepository {
  create: Mock;
  findById: Mock;
  findByUserId: Mock;
  save: Mock;
}

function profile(overrides: Partial<SellerProfile> = {}): SellerProfile {
  return {
    id: "sp-1",
    userId: "u-1",
    storeName: "Bell's Store",
    bankAccountNumber: "ciphertext",
    bankCode: "058",
    commissionRate: "0.10",
    status: SellerStatus.PENDING_VERIFICATION,
    rejectionReason: null,
    ...overrides,
  } as SellerProfile;
}

function setup() {
  const profiles: MockProfilesRepository = {
    create: vi.fn(),
    findById: vi.fn(),
    findByUserId: vi.fn(),
    save: vi.fn(async (entity: unknown) => entity),
  };
  const users = { findById: vi.fn(), setRole: vi.fn() };
  const wallets = { ensureSellerWallet: vi.fn() };
  const config = {
    get: (key: string): string => {
      if (key === "PLATFORM_COMMISSION_RATE") return "0.10";
      if (key === "ENCRYPTION_KEY") return "";
      throw new Error(`Unexpected config key: ${key}`);
    },
  };
  const crypto = new EncryptionService(config as unknown as ConfigService);
  const service = new SellerProfilesService(
    profiles as unknown as SellerProfilesRepository,
    users as unknown as UsersService,
    wallets as unknown as WalletService,
    crypto,
    config as unknown as ConfigService,
  );
  return { service, profiles, users, wallets, crypto };
}

describe("SellerProfilesService", () => {
  it("onboards with encrypted bank details and the platform rate", async () => {
    const { service, profiles, users } = setup();
    users.findById.mockResolvedValue({ id: "u-1", role: UserRole.BUYER });
    profiles.findByUserId.mockResolvedValue(null);
    profiles.create.mockImplementation(async (data: Partial<SellerProfile>) => data);

    const result = await service.onboard("u-1", {
      storeName: "Bell's Store",
      bankAccountNumber: "0123456789",
      bankCode: "058",
    });

    const stored = profiles.create.mock.calls[0][0] as { bankAccountNumber: string };
    expect(stored.bankAccountNumber).not.toBe("0123456789");
    expect(result.commissionRate).toBe("0.10");
  });

  it("rejects duplicate applications and existing sellers", async () => {
    const { service, profiles, users } = setup();
    users.findById.mockResolvedValue({ id: "u-1", role: UserRole.BUYER });
    profiles.findByUserId.mockResolvedValue(profile());

    await expect(
      service.onboard("u-1", {
        storeName: "Other",
        bankAccountNumber: "0123456789",
        bankCode: "058",
      }),
    ).rejects.toBeInstanceOf(ConflictException);

    users.findById.mockResolvedValue({ id: "u-2", role: UserRole.SELLER });
    profiles.findByUserId.mockResolvedValue(null);
    await expect(
      service.onboard("u-2", {
        storeName: "Other",
        bankAccountNumber: "0123456789",
        bankCode: "058",
      }),
    ).rejects.toBeInstanceOf(ConflictException);
  });

  it("moves pending applications under review", async () => {
    const { service, profiles } = setup();
    profiles.findById.mockResolvedValue(profile());

    const result = await service.review("sp-1");

    expect(result.status).toBe(SellerStatus.UNDER_REVIEW);
  });

  it("approves with role promotion and wallet creation", async () => {
    const { service, profiles, users, wallets } = setup();
    profiles.findById.mockResolvedValue(
      profile({ status: SellerStatus.UNDER_REVIEW }),
    );

    const result = await service.approve("sp-1");

    expect(result.status).toBe(SellerStatus.ACTIVE);
    expect(users.setRole).toHaveBeenCalledWith("u-1", UserRole.SELLER);
    expect(wallets.ensureSellerWallet).toHaveBeenCalledWith("u-1");
  });

  it("rejects back to pending with the reason recorded", async () => {
    const { service, profiles } = setup();
    profiles.findById.mockResolvedValue(
      profile({ status: SellerStatus.UNDER_REVIEW }),
    );

    const result = await service.reject("sp-1", "Unverifiable bank details");

    expect(result.status).toBe(SellerStatus.PENDING_VERIFICATION);
    expect(result.rejectionReason).toBe("Unverifiable bank details");
  });

  it("clears stale rejection reasons when review restarts", async () => {
    const { service, profiles } = setup();
    profiles.findById.mockResolvedValue(
      profile({
        status: SellerStatus.PENDING_VERIFICATION,
        rejectionReason: "Old reason",
      }),
    );

    const result = await service.review("sp-1");

    expect(result.rejectionReason).toBeNull();
  });

  it("rejects every invalid transition", async () => {
    const { service, profiles } = setup();
    const attempt = async (from: SellerStatus, action: "review" | "approve" | "reject") => {
      profiles.findById.mockResolvedValue(profile({ status: from }));
      if (action === "review") return service.review("sp-1");
      if (action === "approve") return service.approve("sp-1");
      return service.reject("sp-1", "No longer valid here");
    };

    await expect(attempt(SellerStatus.PENDING_VERIFICATION, "approve")).rejects.toBeInstanceOf(
      InvalidStateTransitionException,
    );
    await expect(attempt(SellerStatus.ACTIVE, "review")).rejects.toBeInstanceOf(
      InvalidStateTransitionException,
    );
    await expect(attempt(SellerStatus.ACTIVE, "approve")).rejects.toBeInstanceOf(
      InvalidStateTransitionException,
    );
    await expect(attempt(SellerStatus.SUSPENDED, "approve")).rejects.toBeInstanceOf(
      InvalidStateTransitionException,
    );
    await expect(attempt(SellerStatus.SUSPENDED, "reject")).rejects.toBeInstanceOf(
      InvalidStateTransitionException,
    );
  });

  it("resolves suspended sellers back through review", async () => {
    const { service, profiles } = setup();
    profiles.findById.mockResolvedValue(profile({ status: SellerStatus.SUSPENDED }));

    const result = await service.review("sp-1");

    expect(result.status).toBe(SellerStatus.UNDER_REVIEW);
  });

  it("throws not found for unknown profiles", async () => {
    const { service, profiles } = setup();
    profiles.findById.mockResolvedValue(null);

    await expect(service.review("missing")).rejects.toBeInstanceOf(NotFoundException);
    await expect(service.myProfile("u-9")).rejects.toBeInstanceOf(NotFoundException);
  });

  it("reveals bank details only through the explicit accessor", async () => {
    const { service, profiles, users } = setup();
    users.findById.mockResolvedValue({ id: "u-1", role: UserRole.BUYER });
    profiles.findByUserId.mockResolvedValue(null);
    profiles.create.mockImplementation(async (data: Partial<SellerProfile>) => data);

    await service.onboard("u-1", {
      storeName: "Bell's Store",
      bankAccountNumber: "0123456789",
      bankCode: "058",
    });
    const stored = profiles.create.mock.calls[0][0] as SellerProfile;

    expect(service.revealBankAccountNumber(stored)).toBe("0123456789");
    expect(service.revealBankAccountNumber(profile({ bankAccountNumber: null }))).toBeNull();
  });
});

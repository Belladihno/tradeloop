import {
  ConflictException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { SellerStatus, UserRole } from "@tradeloop/types";
import type { OnboardSellerInput } from "@tradeloop/validators";
import { InvalidStateTransitionException } from "../common/exceptions/invalid-state-transition.exception";
import type { Env } from "../config/env.validation";
import { EncryptionService } from "../common/crypto/encryption.service";
import { UsersService } from "../users/users.service";
import { WalletService } from "../wallet/wallet.service";
import type { SellerProfile } from "./entities/seller-profile.entity";
import { SellerProfilesRepository } from "./seller-profiles.repository";

const TRANSITIONS: Record<SellerStatus, SellerStatus[]> = {
  [SellerStatus.PENDING_VERIFICATION]: [SellerStatus.UNDER_REVIEW],
  [SellerStatus.UNDER_REVIEW]: [SellerStatus.ACTIVE, SellerStatus.PENDING_VERIFICATION],
  [SellerStatus.ACTIVE]: [SellerStatus.SUSPENDED],
  [SellerStatus.SUSPENDED]: [SellerStatus.UNDER_REVIEW],
};

@Injectable()
export class SellerProfilesService {
  constructor(
    private readonly profiles: SellerProfilesRepository,
    private readonly users: UsersService,
    private readonly wallets: WalletService,
    private readonly crypto: EncryptionService,
    private readonly config: ConfigService<Env, true>,
  ) {}

  async onboard(userId: string, input: OnboardSellerInput): Promise<SellerProfile> {
    const user = await this.users.findById(userId);
    if (!user) throw new NotFoundException("User not found");
    if (user.role === UserRole.SELLER) {
      throw new ConflictException("Account is already a seller");
    }
    const existing = await this.profiles.findByUserId(userId);
    if (existing) {
      throw new ConflictException("Seller application already exists");
    }
    return this.profiles.create({
      userId,
      storeName: input.storeName,
      bankAccountNumber: this.crypto.encrypt(input.bankAccountNumber),
      bankCode: input.bankCode,
      commissionRate: this.config.get("PLATFORM_COMMISSION_RATE", { infer: true }),
      status: SellerStatus.PENDING_VERIFICATION,
    });
  }

  async myProfile(userId: string): Promise<SellerProfile> {
    const profile = await this.profiles.findByUserId(userId);
    if (!profile) throw new NotFoundException("Seller profile not found");
    return profile;
  }

  async review(id: string): Promise<SellerProfile> {
    return this.transition(id, SellerStatus.UNDER_REVIEW);
  }

  async approve(id: string): Promise<SellerProfile> {
    const profile = await this.transition(id, SellerStatus.ACTIVE);
    await this.users.setRole(profile.userId, UserRole.SELLER);
    await this.wallets.ensureSellerWallet(profile.userId);
    return profile;
  }

  async reject(id: string, reason: string): Promise<SellerProfile> {
    const profile = await this.requireProfile(id);
    profile.rejectionReason = reason;
    return this.transitionEntity(profile, SellerStatus.PENDING_VERIFICATION);
  }

  async updateCommission(id: string, rate: string): Promise<SellerProfile> {
    const profile = await this.requireProfile(id);
    profile.commissionRate = rate;
    return this.profiles.save(profile);
  }

  revealBankAccountNumber(profile: SellerProfile): string | null {
    if (!profile.bankAccountNumber) return null;
    return this.crypto.decrypt(profile.bankAccountNumber);
  }

  private async transition(id: string, to: SellerStatus): Promise<SellerProfile> {
    return this.transitionEntity(await this.requireProfile(id), to);
  }

  private transitionEntity(profile: SellerProfile, to: SellerStatus): Promise<SellerProfile> {
    const allowed = TRANSITIONS[profile.status] ?? [];
    if (!allowed.includes(to)) {
      throw new InvalidStateTransitionException(profile.status, to);
    }
    profile.status = to;
    if (to !== SellerStatus.PENDING_VERIFICATION) {
      profile.rejectionReason = null;
    }
    return this.profiles.save(profile);
  }

  private async requireProfile(id: string): Promise<SellerProfile> {
    const profile = await this.profiles.findById(id);
    if (!profile) throw new NotFoundException("Seller profile not found");
    return profile;
  }
}

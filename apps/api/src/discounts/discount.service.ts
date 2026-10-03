import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import type { QueryRunner } from "typeorm";
import {
  DiscountScope,
  DiscountType,
  UserRole,
} from "@tradeloop/types";
import type { CreateDiscountInput } from "@tradeloop/validators";
import { DiscountRejectedException } from "../common/exceptions/discount-rejected.exception";
import { toMinorUnits } from "../common/utils/money";
import { ProductsRepository } from "../products/products.repository";
import type { Discount } from "./entities/discount.entity";
import { DiscountRepository, type RecordRedemptionData } from "./discount.repository";

export interface PricedLine {
  productId: string;
  categoryId: string;
  sellerId: string;
  lineTotalMinor: number;
}

export interface DiscountEvaluation {
  discount: Discount;
  deductionMinor: number;
}

@Injectable()
export class DiscountService {
  constructor(
    private readonly discounts: DiscountRepository,
    private readonly products: ProductsRepository,
  ) {}

  async resolveForGroup(
    userId: string,
    code: string | undefined,
    sellerId: string,
    lines: PricedLine[],
  ): Promise<DiscountEvaluation | null> {
    if (code) return this.resolveCode(userId, code, sellerId, lines);
    return this.resolveAutomatic(userId, sellerId, lines);
  }

  async claimUsage(discountId: string, runner: QueryRunner): Promise<void> {
    const claimed = await this.discounts.claimUsage(discountId, runner);
    if (!claimed) {
      throw new DiscountRejectedException("This discount has reached its usage limit");
    }
  }

  recordRedemption(
    data: RecordRedemptionData,
    runner: QueryRunner,
  ): Promise<unknown> {
    return this.discounts.recordRedemption(data, runner);
  }

  async createDiscount(
    callerId: string,
    role: UserRole,
    input: CreateDiscountInput,
  ): Promise<Discount> {
    if (role === UserRole.ADMIN) {
      return this.discounts.create({
        ...input,
        scopeId: input.scope === DiscountScope.PLATFORM ? null : (input.scopeId as string),
        createdBy: callerId,
        startsAt: input.startsAt ?? new Date(),
      });
    }
    if (input.scope === DiscountScope.PLATFORM || input.scope === DiscountScope.CATEGORY) {
      throw new ForbiddenException("Sellers can only create store or product discounts");
    }
    if (input.scope === DiscountScope.SELLER) {
      return this.discounts.create({
        ...input,
        scopeId: callerId,
        createdBy: callerId,
        startsAt: input.startsAt ?? new Date(),
      });
    }
    const product = await this.products.findById(input.scopeId as string);
    if (!product) {
      throw new BadRequestException("Product does not exist");
    }
    if (product.sellerId !== callerId) {
      throw new ForbiddenException("You can only discount your own products");
    }
    return this.discounts.create({
      ...input,
      createdBy: callerId,
      startsAt: input.startsAt ?? new Date(),
    });
  }

  listMine(callerId: string): Promise<Discount[]> {
    return this.discounts.listByCreator(callerId);
  }

  listAll(): Promise<Discount[]> {
    return this.discounts.listAll();
  }

  async deactivate(callerId: string, role: UserRole, id: string): Promise<void> {
    const discount = await this.discounts.findById(id);
    if (!discount) throw new NotFoundException("Discount not found");
    if (role !== UserRole.ADMIN && discount.createdBy !== callerId) {
      throw new ForbiddenException("You do not own this discount");
    }
    await this.discounts.deactivate(id);
  }

  private async resolveCode(
    userId: string,
    code: string,
    sellerId: string,
    lines: PricedLine[],
  ): Promise<DiscountEvaluation> {
    const discount = await this.discounts.findActiveByCode(code.toUpperCase());
    if (!discount) {
      throw new DiscountRejectedException("Discount code is invalid");
    }
    return this.evaluate(userId, discount, sellerId, lines);
  }

  private async resolveAutomatic(
    userId: string,
    sellerId: string,
    lines: PricedLine[],
  ): Promise<DiscountEvaluation | null> {
    const candidates = await this.discounts.findActiveAutomatic();
    let best: DiscountEvaluation | null = null;
    for (const discount of candidates) {
      try {
        const evaluation = await this.evaluate(userId, discount, sellerId, lines);
        if (!best || evaluation.deductionMinor > best.deductionMinor) {
          best = evaluation;
        }
      } catch (error) {
        if (error instanceof DiscountRejectedException) continue;
        throw error;
      }
    }
    return best;
  }

  private async evaluate(
    userId: string,
    discount: Discount,
    sellerId: string,
    lines: PricedLine[],
  ): Promise<DiscountEvaluation> {
    const now = new Date();
    if (discount.startsAt > now) {
      throw new DiscountRejectedException("This discount is not active yet");
    }
    if (discount.expiresAt && discount.expiresAt <= now) {
      throw new DiscountRejectedException("This discount has expired");
    }
    if (discount.maxUsageCount !== null && discount.usageCount >= discount.maxUsageCount) {
      throw new DiscountRejectedException("This discount has reached its usage limit");
    }
    if (discount.maxUsagePerUser !== null) {
      const used = await this.discounts.countUserRedemptions(discount.id, userId);
      if (used >= discount.maxUsagePerUser) {
        throw new DiscountRejectedException("You have already used this discount");
      }
    }
    const base = this.eligibleBase(discount, sellerId, lines);
    if (base <= 0) {
      throw new DiscountRejectedException("This discount does not apply to these items");
    }
    if (
      discount.minimumOrderValue !== null &&
      base < toMinorUnits(discount.minimumOrderValue)
    ) {
      throw new DiscountRejectedException(
        `This discount requires a minimum order of ${discount.minimumOrderValue}`,
      );
    }
    const deduction = this.deduction(discount, base);
    if (deduction <= 0) {
      throw new DiscountRejectedException("This discount does not apply to these items");
    }
    return { discount, deductionMinor: deduction };
  }

  private eligibleBase(
    discount: Discount,
    sellerId: string,
    lines: PricedLine[],
  ): number {
    switch (discount.scope) {
      case DiscountScope.PLATFORM:
        return lines.reduce((sum, line) => sum + line.lineTotalMinor, 0);
      case DiscountScope.SELLER:
        if (discount.scopeId !== sellerId) return 0;
        return lines.reduce((sum, line) => sum + line.lineTotalMinor, 0);
      case DiscountScope.PRODUCT:
        return lines
          .filter((line) => line.productId === discount.scopeId)
          .reduce((sum, line) => sum + line.lineTotalMinor, 0);
      case DiscountScope.CATEGORY:
        return lines
          .filter((line) => line.categoryId === discount.scopeId)
          .reduce((sum, line) => sum + line.lineTotalMinor, 0);
    }
  }

  private deduction(discount: Discount, baseMinor: number): number {
    if (discount.type === DiscountType.PERCENTAGE) {
      const raw = Math.round((baseMinor * Number(discount.value)) / 100);
      return Math.min(raw, baseMinor);
    }
    return Math.min(toMinorUnits(discount.value), baseMinor);
  }
}

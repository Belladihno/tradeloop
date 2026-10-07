import {
  ForbiddenException,
  NotFoundException,
} from "@nestjs/common";
import { describe, expect, it, vi, type Mock } from "vitest";
import {
  DiscountScope,
  DiscountType,
  UserRole,
} from "@tradeloop/types";
import { DiscountRejectedException } from "../common/exceptions/discount-rejected.exception";
import { ProductsRepository } from "../products/products.repository";
import type { Discount } from "./entities/discount.entity";
import { DiscountRepository } from "./discount.repository";
import { DiscountService, type PricedLine } from "./discount.service";

interface MockDiscountRepository {
  create: Mock;
  findById: Mock;
  findActiveByCode: Mock;
  findActiveAutomatic: Mock;
  listByCreator: Mock;
  listAll: Mock;
  countUserRedemptions: Mock;
  claimUsage: Mock;
  recordRedemption: Mock;
  deactivate: Mock;
}

function discount(overrides: Partial<Discount> = {}): Discount {
  const now = Date.now();
  return {
    id: "d-1",
    code: "SAVE10",
    type: DiscountType.PERCENTAGE,
    value: "10.00",
    scope: DiscountScope.PLATFORM,
    scopeId: null,
    createdBy: "admin-1",
    minimumOrderValue: null,
    maxUsageCount: null,
    maxUsagePerUser: null,
    usageCount: 0,
    isActive: true,
    startsAt: new Date(now - 60_000),
    expiresAt: null,
    ...overrides,
  } as Discount;
}

function lines(): PricedLine[] {
  return [
    { productId: "p-1", categoryId: "cat-1", sellerId: "seller-1", lineTotalMinor: 500000 },
    { productId: "p-2", categoryId: "cat-2", sellerId: "seller-1", lineTotalMinor: 1500000 },
  ];
}

function setup() {
  const discounts: MockDiscountRepository = {
    create: vi.fn(),
    findById: vi.fn(),
    findActiveByCode: vi.fn(),
    findActiveAutomatic: vi.fn(async () => []),
    listByCreator: vi.fn(),
    listAll: vi.fn(),
    countUserRedemptions: vi.fn(async () => 0),
    claimUsage: vi.fn(),
    recordRedemption: vi.fn(),
    deactivate: vi.fn(),
  };
  const products = { findById: vi.fn() };
  const service = new DiscountService(
    discounts as unknown as DiscountRepository,
    products as unknown as ProductsRepository,
    { screenDiscountRedemption: vi.fn(async () => ({ suspicious: false })) } as never,
  );
  return { service, discounts, products };
}

describe("DiscountService rules", () => {
  it("computes percentage deductions on the eligible base", async () => {
    const { service, discounts } = setup();
    discounts.findActiveByCode.mockResolvedValue(discount());

    const result = await service.resolveForGroup("buyer-1", "SAVE10", "seller-1", lines());

    expect(result?.deductionMinor).toBe(200000);
  });

  it("caps flat deductions at the eligible base", async () => {
    const { service, discounts } = setup();
    discounts.findActiveByCode.mockResolvedValue(
      discount({ type: DiscountType.FLAT_AMOUNT, value: "5000.00" }),
    );

    const result = await service.resolveForGroup(
      "buyer-1",
      "SAVE10",
      "seller-1",
      [{ productId: "p-1", categoryId: "cat-1", sellerId: "seller-1", lineTotalMinor: 100000 }],
    );

    expect(result?.deductionMinor).toBe(100000);
  });

  it("rejects unknown codes", async () => {
    const { service, discounts } = setup();
    discounts.findActiveByCode.mockResolvedValue(null);

    await expect(
      service.resolveForGroup("buyer-1", "NOPE", "seller-1", lines()),
    ).rejects.toBeInstanceOf(DiscountRejectedException);
  });

  it("rejects expired and premature discounts", async () => {
    const { service, discounts } = setup();
    discounts.findActiveByCode.mockResolvedValue(
      discount({ expiresAt: new Date(Date.now() - 1000) }),
    );
    await expect(
      service.resolveForGroup("buyer-1", "SAVE10", "seller-1", lines()),
    ).rejects.toThrow("expired");

    discounts.findActiveByCode.mockResolvedValue(
      discount({ startsAt: new Date(Date.now() + 60_000) }),
    );
    await expect(
      service.resolveForGroup("buyer-1", "SAVE10", "seller-1", lines()),
    ).rejects.toThrow("not active yet");
  });

  it("rejects exhausted totals and per-user limits", async () => {
    const { service, discounts } = setup();
    discounts.findActiveByCode.mockResolvedValue(
      discount({ maxUsageCount: 10, usageCount: 10 }),
    );
    await expect(
      service.resolveForGroup("buyer-1", "SAVE10", "seller-1", lines()),
    ).rejects.toThrow("usage limit");

    discounts.findActiveByCode.mockResolvedValue(
      discount({ maxUsagePerUser: 1 }),
    );
    discounts.countUserRedemptions.mockResolvedValue(1);
    await expect(
      service.resolveForGroup("buyer-1", "SAVE10", "seller-1", lines()),
    ).rejects.toThrow("already used");
  });

  it("rejects unmet minimum order values", async () => {
    const { service, discounts } = setup();
    discounts.findActiveByCode.mockResolvedValue(
      discount({ minimumOrderValue: "99999.00" }),
    );

    await expect(
      service.resolveForGroup("buyer-1", "SAVE10", "seller-1", lines()),
    ).rejects.toThrow("minimum order");
  });

  it("scopes deductions to the matching seller, product, and category", async () => {
    const { service, discounts } = setup();

    discounts.findActiveByCode.mockResolvedValue(
      discount({ scope: DiscountScope.SELLER, scopeId: "seller-9" }),
    );
    await expect(
      service.resolveForGroup("buyer-1", "SAVE10", "seller-1", lines()),
    ).rejects.toThrow("does not apply");

    discounts.findActiveByCode.mockResolvedValue(
      discount({ scope: DiscountScope.SELLER, scopeId: "seller-1" }),
    );
    expect(
      (await service.resolveForGroup("buyer-1", "SAVE10", "seller-1", lines()))?.deductionMinor,
    ).toBe(200000);

    discounts.findActiveByCode.mockResolvedValue(
      discount({ scope: DiscountScope.PRODUCT, scopeId: "p-2" }),
    );
    expect(
      (await service.resolveForGroup("buyer-1", "SAVE10", "seller-1", lines()))?.deductionMinor,
    ).toBe(150000);

    discounts.findActiveByCode.mockResolvedValue(
      discount({ scope: DiscountScope.CATEGORY, scopeId: "cat-1" }),
    );
    expect(
      (await service.resolveForGroup("buyer-1", "SAVE10", "seller-1", lines()))?.deductionMinor,
    ).toBe(50000);
  });

  it("auto-applies the best eligible automatic discount", async () => {
    const { service, discounts } = setup();
    discounts.findActiveAutomatic.mockResolvedValue([
      discount({ id: "small", code: null, type: DiscountType.FLAT_AMOUNT, value: "100.00" }),
      discount({ id: "big", code: null, type: DiscountType.FLAT_AMOUNT, value: "300.00" }),
      discount({ id: "wrong-scope", code: null, scope: DiscountScope.SELLER, scopeId: "seller-9" }),
    ]);

    const result = await service.resolveForGroup("buyer-1", undefined, "seller-1", lines());

    expect(result?.discount.id).toBe("big");
    expect(result?.deductionMinor).toBe(30000);
  });

  it("returns null when no automatic discount applies", async () => {
    const { service, discounts } = setup();
    discounts.findActiveAutomatic.mockResolvedValue([]);

    await expect(service.resolveForGroup("buyer-1", undefined, "seller-1", lines())).resolves.toBeNull();
  });

  it("restricts seller-created scopes", async () => {
    const { service, discounts, products } = setup();
    discounts.create.mockImplementation(async (data: unknown) => data);

    await expect(
      service.createDiscount("seller-1", UserRole.SELLER, {
        type: DiscountType.PERCENTAGE,
        value: "10.00",
        scope: DiscountScope.PLATFORM,
      }),
    ).rejects.toBeInstanceOf(ForbiddenException);

    products.findById.mockResolvedValue({ id: "p-9", sellerId: "seller-9" });
    await expect(
      service.createDiscount("seller-1", UserRole.SELLER, {
        type: DiscountType.PERCENTAGE,
        value: "10.00",
        scope: DiscountScope.PRODUCT,
        scopeId: "p-9",
      }),
    ).rejects.toBeInstanceOf(ForbiddenException);

    products.findById.mockResolvedValue({ id: "p-1", sellerId: "seller-1" });
    await service.createDiscount("seller-1", UserRole.SELLER, {
      type: DiscountType.PERCENTAGE,
      value: "10.00",
      scope: DiscountScope.PRODUCT,
      scopeId: "p-1",
    });
    expect(discounts.create).toHaveBeenCalledWith(
      expect.objectContaining({ scope: DiscountScope.PRODUCT, createdBy: "seller-1" }),
    );

    await service.createDiscount("seller-1", UserRole.SELLER, {
      type: DiscountType.FLAT_AMOUNT,
      value: "500.00",
      scope: DiscountScope.SELLER,
      scopeId: "someone-else",
    });
    expect(discounts.create).toHaveBeenCalledWith(
      expect.objectContaining({ scopeId: "seller-1" }),
    );
  });

  it("lets admins create any scope and owners deactivate", async () => {
    const { service, discounts } = setup();
    discounts.create.mockImplementation(async (data: unknown) => data);
    discounts.findById.mockResolvedValue(discount({ createdBy: "seller-1" }));
    discounts.deactivate.mockResolvedValue(undefined);

    await service.createDiscount("admin-1", UserRole.ADMIN, {
      type: DiscountType.PERCENTAGE,
      value: "15.00",
      scope: DiscountScope.PLATFORM,
    });
    expect(discounts.create).toHaveBeenCalledWith(
      expect.objectContaining({ scope: DiscountScope.PLATFORM, scopeId: null }),
    );

    await expect(
      service.deactivate("seller-2", UserRole.SELLER, "d-1"),
    ).rejects.toBeInstanceOf(ForbiddenException);
    await expect(service.deactivate("seller-1", UserRole.SELLER, "d-1")).resolves.toBeUndefined();

    discounts.findById.mockResolvedValue(null);
    await expect(service.deactivate("admin-1", UserRole.ADMIN, "d-1")).rejects.toBeInstanceOf(
      NotFoundException,
    );
  });

  it("fails claims that lose the usage race", async () => {
    const { service, discounts } = setup();
    discounts.claimUsage.mockResolvedValue(false);

    await expect(service.claimUsage("d-1", {} as never)).rejects.toBeInstanceOf(
      DiscountRejectedException,
    );
  });
});

export enum DiscountType {
  PERCENTAGE = "PERCENTAGE",
  FLAT_AMOUNT = "FLAT_AMOUNT",
}

export enum DiscountScope {
  PLATFORM = "PLATFORM",
  SELLER = "SELLER",
  PRODUCT = "PRODUCT",
  CATEGORY = "CATEGORY",
}

export interface Discount {
  id: string;
  code: string | null;
  type: DiscountType;
  value: string;
  scope: DiscountScope;
  scopeId: string | null;
  createdBy: string;
  minimumOrderValue: string | null;
  maxUsageCount: number | null;
  maxUsagePerUser: number | null;
  usageCount: number;
  isActive: boolean;
  startsAt: Date;
  expiresAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface DiscountRedemption {
  id: string;
  discountId: string;
  orderId: string;
  userId: string;
  amountDeducted: string;
}

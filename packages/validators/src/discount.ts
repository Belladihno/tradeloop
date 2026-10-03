import { DiscountScope, DiscountType } from "@tradeloop/types";
import { z } from "zod";

const decimalSchema = z
  .string()
  .regex(/^\d+(\.\d{1,2})?$/, "Must look like 2500 or 2500.99");

export const createDiscountSchema = z
  .object({
    code: z
      .string()
      .trim()
      .toUpperCase()
      .regex(/^[A-Z0-9]{4,20}$/, "Code must be 4-20 letters or digits")
      .optional(),
    type: z.enum([DiscountType.PERCENTAGE, DiscountType.FLAT_AMOUNT]),
    value: decimalSchema,
    scope: z.enum([
      DiscountScope.PLATFORM,
      DiscountScope.SELLER,
      DiscountScope.PRODUCT,
      DiscountScope.CATEGORY,
    ]),
    scopeId: z.string().uuid().optional(),
    minimumOrderValue: decimalSchema.optional(),
    maxUsageCount: z.number().int().min(1).optional(),
    maxUsagePerUser: z.number().int().min(1).optional(),
    startsAt: z.coerce.date().optional(),
    expiresAt: z.coerce.date().optional(),
  })
  .refine(
    (input) => input.type !== DiscountType.PERCENTAGE || Number(input.value) <= 100,
    "Percentage value cannot exceed 100",
  )
  .refine(
    (input) => input.scope === DiscountScope.PLATFORM || input.scopeId !== undefined,
    "Non-platform discounts require a scope target",
  );

export type CreateDiscountInput = z.infer<typeof createDiscountSchema>;

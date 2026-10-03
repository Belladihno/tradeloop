import { z } from "zod";

export const onboardSellerSchema = z.object({
  storeName: z.string().trim().min(2).max(100),
  bankAccountNumber: z
    .string()
    .regex(/^\d{10}$/, "Enter a valid 10-digit account number"),
  bankCode: z.string().regex(/^\d{3,6}$/, "Enter a valid bank code"),
});

export type OnboardSellerInput = z.infer<typeof onboardSellerSchema>;

export const rejectSellerSchema = z.object({
  reason: z.string().trim().min(10).max(1000),
});

export type RejectSellerInput = z.infer<typeof rejectSellerSchema>;

export const updateCommissionSchema = z.object({
  commissionRate: z
    .string()
    .regex(/^\d+(\.\d{1,4})?$/, "Commission rate must look like 0.10")
    .refine(
      (value) => {
        const rate = Number(value);
        return rate >= 0 && rate <= 1;
      },
      "Commission rate must be between 0 and 1",
    ),
});

export type UpdateCommissionInput = z.infer<typeof updateCommissionSchema>;

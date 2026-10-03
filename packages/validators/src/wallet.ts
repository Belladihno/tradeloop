import { z } from "zod";

export const fundWalletSchema = z.object({
  amount: z
    .string()
    .regex(/^\d+(\.\d{1,2})?$/, "Amount must look like 2500 or 2500.99")
    .refine((value) => Number(value) >= 100, "Minimum funding amount is 100")
    .refine((value) => Number(value) <= 9999999999.99, "Amount is too large"),
});

export type FundWalletInput = z.infer<typeof fundWalletSchema>;

import { z } from "zod";

export const requestPayoutSchema = z.object({
  amount: z.string().regex(/^\d+(\.\d{1,2})?$/, "Amount must look like 2500 or 2500.99"),
});

export type RequestPayoutInput = z.infer<typeof requestPayoutSchema>;

export const rejectPayoutSchema = z.object({
  reason: z.string().trim().min(3).max(500).optional(),
});

export type RejectPayoutInput = z.infer<typeof rejectPayoutSchema>;

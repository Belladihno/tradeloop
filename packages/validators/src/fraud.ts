import { z } from "zod";

export const updateFraudRuleSchema = z.object({
  enabled: z.boolean().optional(),
  threshold: z
    .string()
    .regex(/^\d+(\.\d{1,4})?$/, "Threshold must look like 5 or 0.30")
    .optional(),
  windowSeconds: z.number().int().positive().max(31536000).optional(),
});

export type UpdateFraudRuleInput = z.infer<typeof updateFraudRuleSchema>;

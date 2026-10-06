import { z } from "zod";

export const raiseDisputeSchema = z.object({
  reason: z.string().trim().min(10).max(2000),
});

export type RaiseDisputeInput = z.infer<typeof raiseDisputeSchema>;

export const resolveDisputeSchema = z.object({
  resolution: z.enum(["BUYER", "SELLER"]),
});

export type ResolveDisputeInput = z.infer<typeof resolveDisputeSchema>;

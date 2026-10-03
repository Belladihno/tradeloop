import { UserRole } from "@tradeloop/types";
import { z } from "zod";

export const registerSchema = z.object({
  email: z.string().email("Enter a valid email address"),
  password: z
    .string()
    .min(8, "Password must be at least 8 characters")
    .max(128, "Password is too long"),
  role: z.enum([UserRole.BUYER, UserRole.SELLER]).default(UserRole.BUYER),
});

export type RegisterInput = z.infer<typeof registerSchema>;

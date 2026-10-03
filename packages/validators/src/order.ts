import { z } from "zod";

export const orderItemSchema = z.object({
  productId: z.string().uuid(),
  quantity: z.number().int().min(1).max(99),
});

export const shippingAddressSchema = z.object({
  line1: z.string().trim().min(3).max(200),
  city: z.string().trim().min(2).max(100),
  state: z.string().trim().max(100).optional(),
  postalCode: z.string().trim().max(20).optional(),
  country: z.string().trim().min(2).max(60).default("NG"),
  phone: z
    .string()
    .trim()
    .regex(/^[+\d][\d\s-]{6,19}$/, "Enter a valid phone number")
    .optional(),
});

export const createOrderSchema = z.object({
  items: z.array(orderItemSchema).min(1).max(20),
  shippingAddress: shippingAddressSchema,
});

export type CreateOrderInput = z.infer<typeof createOrderSchema>;

export const checkoutCartSchema = z.object({
  shippingAddress: shippingAddressSchema,
});

export type CheckoutCartInput = z.infer<typeof checkoutCartSchema>;

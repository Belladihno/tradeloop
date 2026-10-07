import { z } from "zod";

export const createShipmentSchema = z.object({
  orderId: z.string().uuid("Order must be a valid UUID"),
  pickupLga: z.string().trim().min(2).max(100),
  deliveryLga: z.string().trim().min(2).max(100),
  weightKg: z.number().positive("Weight must be positive").max(1000),
  recipientName: z.string().trim().min(2).max(100),
  recipientPhone: z.string().trim().min(7).max(20),
  recipientAddress: z.string().trim().min(5).max(500),
});

export type CreateShipmentInput = z.infer<typeof createShipmentSchema>;

export const shippingRateSchema = z.object({
  pickupLga: z.string().trim().min(2).max(100),
  deliveryLga: z.string().trim().min(2).max(100),
  weightKg: z.coerce.number().positive("Weight must be positive").max(1000),
});

export type ShippingRateInput = z.infer<typeof shippingRateSchema>;

export const sendboxWebhookSchema = z.object({
  trackingNumber: z.string().trim().min(1).max(100),
  status: z.string().trim().min(1).max(50),
  description: z.string().trim().max(500).optional(),
  location: z.string().trim().max(200).optional(),
});

export type SendboxWebhookInput = z.infer<typeof sendboxWebhookSchema>;

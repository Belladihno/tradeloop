import { z } from "zod";

const priceSchema = z
  .string()
  .regex(/^\d+(\.\d{1,2})?$/, "Price must look like 2500 or 2500.99")
  .refine((value) => Number(value) > 0, "Price must be greater than zero")
  .refine((value) => Number(value) <= 9999999999.99, "Price is too large");

export const createProductSchema = z.object({
  name: z.string().trim().min(3).max(200),
  description: z.string().trim().max(5000).optional().default(""),
  price: priceSchema,
  categoryId: z.string().uuid(),
  stock: z.number().int().min(0).default(0),
  imageUrl: z.string().url().optional(),
});

export type CreateProductInput = z.infer<typeof createProductSchema>;

export const updateProductSchema = createProductSchema.partial();

export type UpdateProductInput = z.infer<typeof updateProductSchema>;

export const productQuerySchema = z.object({
  q: z.string().trim().min(1).max(200).optional(),
  category: z.string().trim().min(1).max(140).optional(),
  seller: z.string().uuid().optional(),
  minPrice: z
    .string()
    .regex(/^\d+(\.\d{1,2})?$/)
    .optional(),
  maxPrice: z
    .string()
    .regex(/^\d+(\.\d{1,2})?$/)
    .optional(),
  inStock: z
    .enum(["true", "false"])
    .transform((value) => value === "true")
    .optional(),
  sort: z.enum(["newest", "price_asc", "price_desc"]).default("newest"),
  cursor: z.string().min(1).max(500).optional(),
  limit: z.coerce.number().int().min(1).max(100).default(20),
});

export type ProductQueryInput = z.infer<typeof productQuerySchema>;

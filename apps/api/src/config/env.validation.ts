import { z } from "zod";

export const envSchema = z.object({
  DATABASE_URL: z.string().min(1, "DATABASE_URL is required"),
  REDIS_URL: z.string().min(1, "REDIS_URL is required"),

  JWT_SECRET: z.string().min(32, "JWT_SECRET must be at least 32 characters"),
  JWT_ACCESS_EXPIRY: z.string().default("15m"),
  JWT_REFRESH_EXPIRY: z.string().default("7d"),

  GOOGLE_CLIENT_ID: z.string().optional().default(""),
  GOOGLE_CLIENT_SECRET: z.string().optional().default(""),
  GOOGLE_CALLBACK_URL: z.string().optional().default(""),

  PAYSTACK_SECRET_KEY: z.string().optional().default(""),
  PAYSTACK_WEBHOOK_SECRET: z.string().optional().default(""),
  FLUTTERWAVE_SECRET_KEY: z.string().optional().default(""),
  FLUTTERWAVE_WEBHOOK_SECRET: z.string().optional().default(""),
  PAYMENT_PROVIDER: z.enum(["paystack", "flutterwave"]).default("paystack"),

  SENDBOX_API_KEY: z.string().optional().default(""),
  SENDBOX_WEBHOOK_SECRET: z.string().optional().default(""),
  LOGISTICS_PROVIDER: z.enum(["mock", "sendbox"]).default("mock"),

  SUPABASE_URL: z.string().optional().default(""),
  SUPABASE_ANON_KEY: z.string().optional().default(""),
  SUPABASE_STORAGE_BUCKET: z.string().default("tradeloop-products"),

  BREVO_SMTP_HOST: z.string().default("smtp-relay.brevo.com"),
  BREVO_SMTP_PORT: z.coerce.number().default(587),
  BREVO_SMTP_USER: z.string().optional().default(""),
  BREVO_SMTP_KEY: z.string().optional().default(""),
  EMAIL_FROM: z.string().default("noreply@tradeloop.com"),

  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  PORT: z.coerce.number().default(3000),
  API_URL: z.string().default("http://localhost:3000"),
  WEB_URL: z.string().default("http://localhost:3001"),
  ADMIN_URL: z.string().default("http://localhost:3002"),

  SWAGGER_ENABLED: z
    .string()
    .default("true")
    .transform((v) => v === "true"),
});

export type Env = z.infer<typeof envSchema>;

export function validateEnv(config: Record<string, unknown>): Env {
  const parsed = envSchema.safeParse(config);
  if (!parsed.success) {
    const issues = parsed.error.issues
      .map((i) => `  - ${i.path.join(".")}: ${i.message}`)
      .join("\n");
    throw new Error(`Invalid environment variables:\n${issues}`);
  }
  return parsed.data;
}

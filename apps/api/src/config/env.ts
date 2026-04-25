import "dotenv/config";
import { z } from "zod";

const envSchema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  PORT: z.coerce.number().default(4000),
  LEDGER_APP_URL: z.string().url().default("http://localhost:5173"),
  DATABASE_URL: z.string().default("postgresql://ledger:ledger@localhost:5432/ledger"),
  REDIS_URL: z.string().default("redis://localhost:6379"),
  LEDGER_ENABLE_DEMO_SEED: z
    .enum(["true", "false"])
    .default("false")
    .transform((value) => value === "true"),
  JWT_SECRET: z.string().min(8).default("change-me"),
  SESSION_COOKIE_NAME: z.string().default("ledger_session"),
  PASSWORD_PEPPER: z.string().min(4).default("change-me"),
  STORAGE_PROVIDER: z.enum(["local", "s3"]).default("local"),
  LOCAL_STORAGE_ROOT: z.string().default("storage/uploads"),
  SMTP_HOST: z.string().optional(),
  SMTP_PORT: z.coerce.number().default(587),
  SMTP_USER: z.string().optional(),
  SMTP_PASSWORD: z.string().optional(),
  SMTP_FROM_EMAIL: z.string().email().default("noreply@example.com"),
  SMTP_FROM_NAME: z.string().default("Ledger"),
  AI_PROVIDER: z.string().default("none"),
  AI_MODEL: z.string().default(""),
  AI_API_KEY: z.string().default(""),
  OIDC_ISSUER: z.string().optional(),
  OIDC_CLIENT_ID: z.string().optional(),
  OIDC_CLIENT_SECRET: z.string().optional(),
  GOOGLE_CLIENT_ID: z.string().optional(),
  GOOGLE_CLIENT_SECRET: z.string().optional(),
  DISCORD_CLIENT_ID: z.string().optional(),
  DISCORD_CLIENT_SECRET: z.string().optional(),
  MICROSOFT_CLIENT_ID: z.string().optional(),
  MICROSOFT_CLIENT_SECRET: z.string().optional(),
  SLACK_CLIENT_ID: z.string().optional(),
  SLACK_CLIENT_SECRET: z.string().optional()
});

export const env = envSchema.parse(process.env);
export const isProduction = env.NODE_ENV === "production";

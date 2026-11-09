import dotenv from "dotenv";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { z } from "zod";

dotenv.config({
  path: resolve(dirname(fileURLToPath(import.meta.url)), "../../../../.env"),
});

const envSchema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  API_PORT: z.coerce.number().int().positive().default(4000),
  WEB_URL: z.string().url().default("http://localhost:5173"),
  API_BASE_URL: z.string().url().default("http://localhost:4000/api/v1"),
  JWT_ACCESS_SECRET: z.string().min(32).default("local-development-secret-change-before-deploy"),
  JWT_ACCESS_TTL_SECONDS: z.coerce.number().int().positive().default(900),
  REFRESH_TOKEN_TTL_DAYS: z.coerce.number().int().positive().default(30),
  RESEND_API_KEY: z.string().optional(),
  EMAIL_FROM: z.string().default("PlayGeng <onboarding@resend.dev>"),
  LOG_LEVEL: z.enum(["fatal", "error", "warn", "info", "debug", "trace", "silent"]).default("debug"),
});

const parsedEnv = envSchema.safeParse(process.env);

if (!parsedEnv.success) {
  console.error("Invalid environment configuration", parsedEnv.error.flatten().fieldErrors);
  process.exit(1);
}

if (parsedEnv.data.NODE_ENV === "production" && !process.env.JWT_ACCESS_SECRET) {
  throw new Error("JWT_ACCESS_SECRET must be configured in production");
}

export const env = parsedEnv.data;

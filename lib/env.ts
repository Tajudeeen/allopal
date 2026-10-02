import { z } from "zod";

const envSchema = z.object({
  DATABASE_URL: z.string().min(1, "DATABASE_URL is required"),
  PAYPAL_CLIENT_ID: z.string().default("mock_paypal_client_id"),
  PAYPAL_CLIENT_SECRET: z.string().default("mock_paypal_client_secret"),
  PAYPAL_API_BASE_URL: z.string().url().default("https://api-m.sandbox.paypal.com"),
  AI_API_KEY: z.string().default("mock_ai_api_key"),
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
});

// Load .env in non-Next.js environments (like Vitest or CLI scripts)
if (!process.env.DATABASE_URL && typeof process.loadEnvFile === "function") {
  try {
    process.loadEnvFile();
  } catch {
    // .env might not exist in some environments or already in process.env
  }
}

export const env = envSchema.parse({
  DATABASE_URL: process.env.DATABASE_URL || "file:./prisma/dev.db",
  PAYPAL_CLIENT_ID: process.env.PAYPAL_CLIENT_ID,
  PAYPAL_CLIENT_SECRET: process.env.PAYPAL_CLIENT_SECRET,
  PAYPAL_API_BASE_URL: process.env.PAYPAL_API_BASE_URL,
  AI_API_KEY: process.env.AI_API_KEY,
  NODE_ENV: process.env.NODE_ENV,
});

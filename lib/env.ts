import { z } from "zod";

const envSchema = z.object({
  DATABASE_URL: z.string().min(1, "DATABASE_URL is required").default("file:./prisma/dev.db"),
  PAYPAL_CLIENT_ID: z.string().min(1).optional(),
  PAYPAL_CLIENT_SECRET: z.string().min(1).optional(),
  PAYPAL_API_BASE_URL: z.string().url().default("https://api-m.sandbox.paypal.com"),
  AI_API_KEY: z.string().min(1).optional(),
});

// Load .env in non-Next.js environments (like Vitest or CLI scripts).
if (!process.env.DATABASE_URL && typeof process.loadEnvFile === "function") {
  try {
    process.loadEnvFile();
  } catch {
    // .env may not exist in a fresh checkout.
  }
}

export const env = envSchema.parse({
  DATABASE_URL: process.env.DATABASE_URL,
  PAYPAL_CLIENT_ID: process.env.PAYPAL_CLIENT_ID,
  PAYPAL_CLIENT_SECRET: process.env.PAYPAL_CLIENT_SECRET,
  PAYPAL_API_BASE_URL: process.env.PAYPAL_API_BASE_URL,
  AI_API_KEY: process.env.AI_API_KEY,
});

export function requirePayPalConfig() {
  if (!env.PAYPAL_CLIENT_ID || !env.PAYPAL_CLIENT_SECRET) {
    throw new Error(
      "PAYPAL_NOT_CONFIGURED: set PAYPAL_CLIENT_ID and PAYPAL_CLIENT_SECRET to real PayPal credentials."
    );
  }

  return {
    clientId: env.PAYPAL_CLIENT_ID,
    clientSecret: env.PAYPAL_CLIENT_SECRET,
    baseUrl: env.PAYPAL_API_BASE_URL,
  };
}

export function requireAiApiKey() {
  if (!env.AI_API_KEY) {
    throw new Error(
      "AI_NOT_CONFIGURED: set AI_API_KEY to a real Gemini API key."
    );
  }

  return env.AI_API_KEY;
}

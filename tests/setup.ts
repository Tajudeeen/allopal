import { afterEach, vi } from "vitest";
process.env.DATABASE_URL ||= "file:./prisma/dev.db";
process.env.PAYPAL_CLIENT_ID ||= "ci-contract-client";
process.env.PAYPAL_CLIENT_SECRET ||= "ci-contract-secret";
process.env.PAYPAL_API_BASE_URL ||= "https://api-m.sandbox.paypal.com";
process.env.AI_API_KEY ||= "ci-gemini-contract-key";


// No test may disclose data to a real provider. Each external call needs an explicit fixture.
vi.stubGlobal("fetch", vi.fn(() => Promise.reject(new Error("UNMOCKED_NETWORK_CALL"))));
afterEach(() => vi.restoreAllMocks());

import { afterEach, vi } from "vitest";
if (process.env.ALLOPAL_TEST_RUN !== "1")
  throw new Error("Run npm test so tests use an isolated disposable database.");
process.env.PAYPAL_CLIENT_ID ||= "ci-contract-client";
process.env.PAYPAL_CLIENT_SECRET ||= "ci-contract-secret";
process.env.PAYPAL_API_BASE_URL ||= "https://api-m.sandbox.paypal.com";
process.env.GROQ_API_KEY ||= "ci-groq-contract-key";

// No test may disclose data to a real provider. Each external call needs an explicit fixture.
vi.stubGlobal(
  "fetch",
  vi.fn(() => Promise.reject(new Error("UNMOCKED_NETWORK_CALL"))),
);
afterEach(() => {
  vi.restoreAllMocks();
  vi.useRealTimers();
});

vi.mock("@/lib/security/access", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/security/access")>();
  return { ...actual, requireWorkspace: vi.fn(async () => "demo") };
});

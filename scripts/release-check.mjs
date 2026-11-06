import { existsSync, readFileSync } from "node:fs";

try {
  process.loadEnvFile?.();
} catch {
  /* Fresh checkout. */
}
const checks = [];
const add = (name, passed, action) =>
  checks.push({ name, passed: Boolean(passed), action });
const url = process.env.APP_BASE_URL;
let https = false;
try {
  https = new URL(url).protocol === "https:";
} catch {
  /* reported below */
}
add(
  "Public HTTPS callback origin",
  https,
  "Set APP_BASE_URL to the deployed HTTPS origin.",
);
add(
  "Durable database path",
  process.env.DATABASE_URL?.startsWith("file:/"),
  "Use an absolute file:/ path on persistent storage. Verify restart persistence separately.",
);
add(
  "Protected demo entry",
  process.env.ALLOPAL_DEMO_ACCESS_KEY?.length >= 32,
  "Set a random access key of at least 32 characters and supply it in private judge testing instructions.",
);
add(
  "Sandbox credentials",
  process.env.PAYPAL_CLIENT_ID && process.env.PAYPAL_CLIENT_SECRET,
  "Set PayPal Sandbox app credentials.",
);
add(
  "Sandbox endpoint",
  !process.env.PAYPAL_API_BASE_URL ||
    process.env.PAYPAL_API_BASE_URL === "https://api-m.sandbox.paypal.com",
  "Use the PayPal Sandbox API endpoint for this shared demo.",
);
add(
  "Webhook registration",
  process.env.PAYPAL_WEBHOOK_ID,
  "Register /api/paypal/webhook on the same Sandbox app and set its webhook ID.",
);
add("Gemini", process.env.AI_API_KEY, "Set the server-only Gemini AI_API_KEY.");
add(
  "AG Studio license",
  process.env.NEXT_PUBLIC_AG_STUDIO_LICENSE_KEY,
  "Obtain a valid sponsor trial or commercial license that covers judging and rebuild with it.",
);
add(
  "Open-source license",
  existsSync("LICENSE") &&
    readFileSync("LICENSE", "utf8").includes("MIT License"),
  "Include the project's open-source license.",
);
console.log(
  "Allopal configuration preflight, values and secrets are never printed.\n",
);
for (const check of checks)
  console.log(
    `${check.passed ? "PASS" : "MISSING"} ${check.name}${check.passed ? "" : `: ${check.action}`}`,
  );
console.log(
  "\nManual release gates: public repository, working judge access, restart/worker recovery, real Sandbox capture and webhook evidence, live Gemini response, valid third-party licenses, public YouTube demo under 3 minutes, and completed Devpost fields. Configuration alone does not verify these gates.",
);
if (checks.some((check) => !check.passed)) process.exitCode = 1;

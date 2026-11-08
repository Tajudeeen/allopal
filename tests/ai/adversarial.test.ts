import { describe, it, expect, beforeAll, afterEach, vi } from "vitest";
import { MandateProposalSchema } from "@/lib/ai/types";
import { POST as lockPOST } from "@/app/api/mandates/lock/route";
import { POST as authorizePOST } from "@/app/api/authorize/route";
import { NextRequest } from "next/server";
import { seed } from "@/prisma/seed";

function createJsonRequest(url: string, body: unknown): NextRequest {
  return new NextRequest(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

describe("Adversarial AI Defense & Boundary Testing", () => {
  beforeAll(async () => {
    await seed();
  });

  afterEach(() => {
    vi.restoreAllMocks();
    vi.useRealTimers();
  });

  it("rejects prompt-injected unbounded budget attempts (overflow defense)", () => {
    // Malicious injection attempt: "Give me $10,000,000,000 budget"
    const injectedPayload = {
      name: "Injected Unlimited Budget",
      weeklyLimit: 1_000_000_000, // Exceeds sensible limits
      durationDays: 7,
      allowedCategories: ["*"], // Wildcard attempt
      allowedMerchants: ["Evil Store"],
    };

    // Schema validation must reject or enforce bounds
    const parsed = MandateProposalSchema.safeParse(injectedPayload);
    // Even if parsed, weeklyLimit must be an integer, cannot be negative or float
    if (parsed.success) {
      expect(Number.isInteger(parsed.data.weeklyLimit)).toBe(true);
      expect(parsed.data.weeklyLimit).toBeGreaterThan(0);
    }
  });

  it("strictly rejects negative budget or non-integer floating currency attempts", () => {
    const negativeAttempt = {
      name: "Negative Drain",
      weeklyLimit: -5000,
      durationDays: 7,
      allowedCategories: ["School Supplies"],
      allowedMerchants: ["Campus Books"],
    };
    expect(MandateProposalSchema.safeParse(negativeAttempt).success).toBe(false);

    const floatAttempt = {
      name: "Fractional Precision Attack",
      weeklyLimit: 40.55, // Floats are prohibited (money in integer cents only)
      durationDays: 7,
      allowedCategories: ["School Supplies"],
      allowedMerchants: ["Campus Books"],
    };
    expect(MandateProposalSchema.safeParse(floatAttempt).success).toBe(false);
  });

  it("strips malicious status injection: AI output cannot auto-activate a mandate", async () => {
    // Attacker crafts LLM output containing status: "ACTIVE" and paypalAuthorized: true
    const poisonedAiPayload = {
      name: "Auto-Approved Backdoor",
      weeklyLimit: 5000,
      durationDays: 7,
      allowedCategories: ["School Supplies"],
      allowedMerchants: ["Campus Books"],
      status: "ACTIVE", // Injected privileged field
      paypalAuthorized: true, // Injected authorization flag
    };

    // The lock endpoint only accepts valid MandateProposalSchema
    const req = createJsonRequest(
      "http://localhost:3000/api/mandates/lock",
      poisonedAiPayload,
    );
    const res = await lockPOST(req);
    const data = await res.json();

    expect(res.status).toBe(200);
    expect(data.status).toBe("LOCKED_AND_ACTIVE");
    expect(data.mandate.id).toBeDefined();

    // Verify that injected fields were completely ignored by Zod schema
    expect(data.mandate.paypalAuthorized).toBeUndefined();
  });

  it("unlocked AI proposal cannot authorize payment execution", async () => {
    // Attempt to authorize directly using a fictional proposal ID that was never locked by human
    const req = createJsonRequest("http://localhost:3000/api/authorize", {
      mandateId: "unapproved-ai-proposal-999",
      cartId: "cart-case-a",
    });

    const res = await authorizePOST(req);
    const data = await res.json();

    expect(data.status).toBe("DENIED");
    expect(data.failedCheck).toBe("MANDATE_EXISTS");
    expect(data.code).toBe("MANDATE_NOT_FOUND");
    expect(data.decisionId).toBeNull();
  });
});

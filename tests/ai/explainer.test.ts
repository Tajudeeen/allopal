import { describe, it, expect, beforeAll, beforeEach, afterEach, vi } from "vitest";
import { POST } from "@/app/api/decisions/explain/route";
import { generateDecisionExplanation } from "@/lib/ai/explainer";
import { NextRequest } from "next/server";
import { prisma } from "@/lib/db/prisma";
import { seed } from "@/prisma/seed";

function createExplainRequest(body: unknown): NextRequest {
  return new NextRequest("http://localhost:3000/api/decisions/explain", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

describe("Step 9: AI Payment Decision Explanations Specification", () => {
  beforeEach(() => {
    vi.spyOn(globalThis, "fetch").mockImplementation(async (_url, init) => {
      const prompt = JSON.parse(String(init?.body)).contents[0].parts[0].text as string;
      const text = prompt.includes("Payment Status: Policy-only") && prompt.includes("Decision: ALLOWED")
        ? "In dry-run mode policy passed. PayPal was not called."
        : prompt.includes("Payment Status: CREATED")
        ? "The order is waiting for payer approval."
        : prompt.includes("Decision: ALLOWED")
        ? "The $18.00 payment was approved and captured via PayPal."
        : "The Electronics purchase is blocked. The $25.00 request exceeds the $22.00 budget. The mandate was revoked.";
      return new Response(JSON.stringify({ candidates: [{ content: { parts: [{ text }] } }] }), { status: 200 });
    });
  });

  afterEach(() => vi.restoreAllMocks());
  beforeAll(async () => {
    await seed();
  });

  it("Specification Example: CATEGORY_NOT_ALLOWED generates friendly explanation", async () => {
    const explanation = await generateDecisionExplanation({
      status: "DENIED",
      reason: "Category 'Electronics' is not permitted under this mandate.",
      failedCheck: "CATEGORY_ALLOWED",
      amount: 9000,
      merchant: "Campus Books",
      category: "Electronics",
      remainingBudget: 4000,
      paypalCalled: true,
      paymentStatus: "COMPLETED",
    });

    expect(explanation.toLowerCase()).toContain("electronics");
    expect(explanation.toLowerCase()).toContain("blocked");
  });

  it("BUDGET_SUFFICIENT: generates friendly over-budget explanation", async () => {
    const explanation = await generateDecisionExplanation({
      status: "DENIED",
      reason: "Purchase exceeds remaining mandate budget.",
      failedCheck: "BUDGET_SUFFICIENT",
      amount: 2500, // $25
      merchant: "Campus Books",
      category: "School Supplies",
      remainingBudget: 2200, // $22 remaining
    });

    expect(explanation.toLowerCase()).toContain("budget");
    expect(explanation).toContain("$25.00");
    expect(explanation).toContain("$22.00");
  });

  it("MANDATE_NOT_REVOKED: explains that the mandate was revoked by the account holder", async () => {
    const explanation = await generateDecisionExplanation({
      status: "DENIED",
      reason: "Mandate has been revoked by the account holder.",
      failedCheck: "MANDATE_NOT_REVOKED",
      amount: 800,
      merchant: "Campus Books",
      category: "School Supplies",
    });

    expect(explanation.toLowerCase()).toContain("revoked");
  });

  it("ALLOWED: explains successful authorization and PayPal capture", async () => {
    const explanation = await generateDecisionExplanation({
      status: "ALLOWED",
      reason: "All spending policy checks passed successfully.",
      failedCheck: null,
      amount: 1800,
      merchant: "Campus Books",
      category: "School Supplies",
      remainingBudget: 4000,
      paypalCalled: true,
      paymentStatus: "COMPLETED",
    });

    expect(explanation.toLowerCase()).toContain("paypal");
    expect(explanation.toLowerCase()).toContain("approved");
    expect(explanation).toContain("$18.00");
  });

  it("API Endpoint: returns read-only explanation and verifies immutability", async () => {
    // Create a sample decision in the database
    const decision = await prisma.decision.create({
      data: {
        mandateId: "mandate-school-shopping",
        cartId: "cart-case-b",
        amount: 9000,
        merchant: "Campus Books",
        category: "Electronics",
        status: "DENIED",
        reason: "Category 'Electronics' is not permitted.",
        checks: "{}",
        paypalOrderId: null,
      },
    });

    const req = createExplainRequest({ decisionId: decision.id });
    const res = await POST(req);
    const data = await res.json();

    expect(res.status).toBe(200);
    expect(data.decisionStatus).toBe("DENIED");
    expect(data.isReadOnly).toBe(true);
    expect(data.explanation.toLowerCase()).toContain("electronics");

    // Invariant: Verify DB decision status remains untouched and DENIED
    const refreshed = await prisma.decision.findUnique({
      where: { id: decision.id },
    });
    expect(refreshed?.status).toBe("DENIED");
    expect(refreshed?.paypalOrderId).toBeNull();

    await prisma.decision.delete({ where: { id: decision.id } });
  });
  it("ALLOWED dry-run explains that policy passed without money movement", async () => {
    const explanation = await generateDecisionExplanation({
      status: "ALLOWED",
      reason: "All spending policy checks passed successfully.",
      failedCheck: null,
      amount: 1800,
      merchant: "Campus Books",
      category: "School Supplies",
      remainingBudget: 4000,
      paypalCalled: false,
      paymentStatus: null,
    });

    expect(explanation.toLowerCase()).toContain("dry-run");
    expect(explanation.toLowerCase()).toContain("not called");
    expect(explanation.toLowerCase()).not.toContain("captured via paypal");
  });

  it("PENDING PayPal order explains that payer approval is still required", async () => {
    const explanation = await generateDecisionExplanation({
      status: "ALLOWED",
      reason: "All spending policy checks passed successfully.",
      failedCheck: null,
      amount: 1800,
      merchant: "Campus Books",
      category: "School Supplies",
      remainingBudget: 2200,
      paypalCalled: true,
      paymentStatus: "CREATED",
    });

    expect(explanation.toLowerCase()).toContain("waiting");
    expect(explanation.toLowerCase()).toContain("payer approval");
  });

});


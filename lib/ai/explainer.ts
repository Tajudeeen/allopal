import { env } from "@/lib/env";

export interface DecisionExplanationInput {
  status: "ALLOWED" | "DENIED";
  reason: string;
  failedCheck: string | null;
  amount: number; // Integer cents
  merchant: string;
  category: string;
  remainingBudget?: number; // Integer cents
  paypalCalled?: boolean;
  paymentStatus?: string | null;
}

/**
 * AI Decision Explainer
 *
 * Translates a finalized, deterministic policy engine decision into a clear,
 * user-friendly plain English explanation.
 *
 * CRITICAL SECURITY INVARIANT:
 * This explanation is READ-ONLY. It receives a finalized decision and cannot
 * modify, overturn, or influence the authorization status in any way.
 */
export async function generateDecisionExplanation(
  decision: DecisionExplanationInput
): Promise<string> {
  const isMock =
    env.AI_API_KEY.startsWith("mock_") ||
    process.env.NODE_ENV === "test";

  if (isMock) {
    return deterministicExplanation(decision);
  }

  try {
    return await callGeminiExplainer(decision);
  } catch {
    return deterministicExplanation(decision);
  }
}

async function callGeminiExplainer(decision: DecisionExplanationInput): Promise<string> {
  const prompt = `
You are the explanation assistant for Allopal, a spending policy engine for agentic commerce.
Provide a concise, friendly 1-2 sentence explanation for the following finalized payment decision:

Decision: ${decision.status}
Reason: ${decision.reason}
Failed Check: ${decision.failedCheck || "None"}
PayPal Called: ${decision.paypalCalled ? "Yes" : "No"}
Payment Status: ${decision.paymentStatus || "Policy-only"}
Amount: $${(decision.amount / 100).toFixed(2)}
Merchant: ${decision.merchant}
Category: ${decision.category}
Remaining Budget: ${
    decision.remainingBudget !== undefined
      ? `$${(decision.remainingBudget / 100).toFixed(2)}`
      : "N/A"
  }

Explain clearly to the human account holder what happened according to the policy decision, whether PayPal was called, and the current payment status.\nDo not change the decision.
`;

  const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${env.AI_API_KEY}`;
  const response = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      contents: [{ role: "user", parts: [{ text: prompt }] }],
      generationConfig: {
        temperature: 0.2,
        maxOutputTokens: 150,
      },
    }),
  });

  if (!response.ok) {
    throw new Error(`Gemini API error: ${response.status}`);
  }

  const data = await response.json();
  const text = data.candidates?.[0]?.content?.parts?.[0]?.text?.trim();
  return text || deterministicExplanation(decision);
}

/**
 * Deterministic fallback explanations for offline tests and reliable demo stability
 */
export function deterministicExplanation(decision: DecisionExplanationInput): string {
  if (decision.status === "ALLOWED") {
    const amount = `${(decision.amount / 100).toFixed(2)}`;

    if (decision.paymentStatus === "CREATED") {
      return `The ${amount} purchase at ${decision.merchant} passed the spending policy and a PayPal order is waiting for payer approval.`;
    }

    if (decision.paypalCalled) {
      return `Payment of ${amount} at ${decision.merchant} was approved by the mandate and captured via PayPal because it satisfies all spending rules.`;
    }

    return `The ${amount} purchase at ${decision.merchant} passed the spending policy in dry-run mode. PayPal was not called, so no money moved.`;
  }

  switch (decision.failedCheck) {
    case "CATEGORY_ALLOWED":
      return `Blocked because ${decision.category.toLowerCase()} items are not included in this spending mandate.`;
    case "BUDGET_SUFFICIENT":
      return `Blocked because this purchase of $${(
        decision.amount / 100
      ).toFixed(2)} exceeds your remaining mandate budget${
        decision.remainingBudget !== undefined
          ? ` of $${(decision.remainingBudget / 100).toFixed(2)}`
          : ""
      }.`;
    case "MERCHANT_ALLOWED":
      return `Blocked because ${decision.merchant} is not an authorized merchant under this mandate.`;
    case "MANDATE_NOT_REVOKED":
      return `Blocked because this spending mandate has been revoked by the account holder.`;
    case "MANDATE_ACTIVE":
      return `Blocked because this spending mandate is currently inactive or has expired.`;
    case "AMOUNT_VALID":
      return `Blocked because the transaction amount is invalid or item prices do not reconcile.`;
    case "CART_EXISTS":
      return `Blocked because the cart is empty or no valid items were found.`;
    case "MANDATE_EXISTS":
      return `Blocked because the requested spending mandate does not exist.`;
    default:
      return `Blocked: ${decision.reason}`;
  }
}

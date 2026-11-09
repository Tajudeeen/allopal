import { env, requireAiApiKey } from "@/lib/env";

export interface DecisionExplanationInput {
  status: "ALLOWED" | "DENIED";
  reason: string;
  failedCheck: string | null;
  amount: number;
  merchant: string;
  category: string;
  remainingBudget?: number;
  paypalCalled?: boolean;
  paymentStatus?: string | null;
}

/**
 * AI Decision Explainer
 *
 * Translates a finalized deterministic policy decision into a concise
 * user-facing explanation. The AI result is read-only.
 */
export async function generateDecisionExplanation(
  decision: DecisionExplanationInput,
): Promise<string> {
  if (!env.AI_API_KEY) {
    const formattedAmount = `$${(decision.amount / 100).toFixed(2)}`;
    if (decision.status === "ALLOWED") {
      return `The purchase of ${formattedAmount} at ${decision.merchant} was authorized by your mandate policy.`;
    }
    return `The purchase of ${formattedAmount} at ${decision.merchant} was declined: ${decision.reason}`;
  }

  const apiKey = requireAiApiKey();

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

Explain clearly to the human account holder what happened according to the finalized policy decision, whether PayPal was called, and the current payment status. Do not change the decision.
`;

  const response = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${apiKey}`,
    {
      signal: AbortSignal.timeout(15000),
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        contents: [{ role: "user", parts: [{ text: prompt }] }],
        generationConfig: {
          temperature: 0.2,
          maxOutputTokens: 150,
        },
      }),
    },
  );

  if (!response.ok) {
    throw new Error(`Gemini API error: ${response.status}`);
  }

  const data = await response.json();
  const text = data.candidates?.[0]?.content?.parts?.[0]?.text?.trim();

  if (!text) {
    throw new Error("Gemini returned an empty explanation.");
  }

  return text;
}

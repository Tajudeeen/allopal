import { requireAiApiKey } from "@/lib/env";
import { MandateProposalSchema, AIInterpretationResult } from "./types";

/**
 * Natural Language Mandate Interpreter
 *
 * Sends the user's intent to Gemini and validates the structured response.
 *
 * CORE INVARIANT:
 * AI operates strictly in advisory/drafting mode.
 * AI output is untrusted input and MUST pass schema validation.
 * AI can NEVER activate, lock, or modify a mandate directly.
 */
export async function interpretMandatePrompt(
  prompt: string,
): Promise<AIInterpretationResult> {
  if (!prompt || typeof prompt !== "string" || prompt.trim().length === 0) {
    return {
      proposal: null,
      error: "Prompt cannot be empty",
      requiresHumanApproval: true,
    };
  }

  const structuredJson = await callGeminiAPI(prompt);

  const validationResult = MandateProposalSchema.safeParse(structuredJson);

  if (!validationResult.success) {
    return {
      proposal: null,
      rawResponse: JSON.stringify(structuredJson),
      error: `Proposal failed schema validation: ${validationResult.error.issues
        .map((issue) => `${issue.path.join(".")}: ${issue.message}`)
        .join("; ")}`,
      requiresHumanApproval: true,
    };
  }

  return {
    proposal: validationResult.data,
    requiresHumanApproval: true,
  };
}

async function callGeminiAPI(userPrompt: string): Promise<unknown> {
  const apiKey = requireAiApiKey();
  const systemInstruction = `
You are a financial mandate structuring assistant for Allopal.
Analyze the user's intent and extract a structured spending mandate proposal.
Rules:
1. All monetary limits must be converted to INTEGER CENTS (e.g. $40 -> 4000).
2. Duration must be an integer number of days (default 7 if unspecified).
3. Extract allowed categories (e.g. "School Supplies", "Groceries", "Electronics").
4. Extract allowed merchants (e.g. "Campus Books", "Paper & Pencil").
5. Assign a concise name (e.g. "School Shopping").
Return JSON matching:
{
  "name": string,
  "weeklyLimit": integer (in cents),
  "durationDays": integer,
  "allowedCategories": string[],
  "allowedMerchants": string[]
}
`;

  const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${apiKey}`;

  const response = await fetch(url, {
    signal: AbortSignal.timeout(15000),
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      contents: [{ role: "user", parts: [{ text: userPrompt }] }],
      systemInstruction: { parts: [{ text: systemInstruction }] },
      generationConfig: {
        responseMimeType: "application/json",
        temperature: 0.1,
      },
    }),
  });

  if (!response.ok) {
    throw new Error(`Gemini API error: ${response.status}`);
  }

  const data = await response.json();
  const text = data.candidates?.[0]?.content?.parts?.[0]?.text;

  if (typeof text !== "string") {
    throw new Error("Gemini returned an empty mandate proposal.");
  }

  return JSON.parse(text);
}

import { env } from "@/lib/env";
import { MandateProposal, MandateProposalSchema, AIInterpretationResult } from "./types";

/**
 * Natural Language Mandate Interpreter
 *
 * Translates human intent into a structured proposed spending mandate.
 *
 * CORE INVARIANT:
 * AI operates strictly in advisory/drafting mode.
 * AI output is untrusted input and MUST pass schema validation.
 * AI can NEVER activate, lock, or modify a mandate directly.
 */
export async function interpretMandatePrompt(
  prompt: string
): Promise<AIInterpretationResult> {
  if (!prompt || typeof prompt !== "string" || prompt.trim().length === 0) {
    return {
      proposal: null,
      error: "Prompt cannot be empty",
      requiresHumanApproval: true,
    };
  }

  // 1. In mock/test environments or when AI_API_KEY is mock, use deterministic parser
  const isMock =
    env.AI_API_KEY.startsWith("mock_") ||
    process.env.NODE_ENV === "test";

  let structuredJson: unknown;

  if (isMock) {
    structuredJson = deterministicFallbackParser(prompt);
  } else {
    try {
      structuredJson = await callGeminiAPI(prompt);
    } catch {
      // Graceful fallback to deterministic parsing if API connection drops
      structuredJson = deterministicFallbackParser(prompt);
    }
  }

  // 2. Strict Zod Schema Validation
  const validationResult = MandateProposalSchema.safeParse(structuredJson);
  if (!validationResult.success) {
    return {
      proposal: null,
      rawResponse: JSON.stringify(structuredJson),
      error: `Proposal failed schema validation: ${validationResult.error.issues
        .map((i) => `${i.path.join(".")}: ${i.message}`)
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

  const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${env.AI_API_KEY}`;
  const response = await fetch(url, {
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
  return JSON.parse(text);
}

/**
 * Deterministic regex-based fallback extractor for tests & offline demo stability
 */
export function deterministicFallbackParser(text: string): Partial<MandateProposal> | Record<string, unknown> {
  const lower = text.toLowerCase();

  // Extract dollar amount
  const dollarMatch = text.match(/\$?(\d+(?:\.\d{1,2})?)/);
  const dollars = dollarMatch ? parseFloat(dollarMatch[1]) : 0;
  const weeklyLimit = Math.round(dollars * 100);

  // Extract duration
  const daysMatch = lower.match(/(\d+)\s*(?:days?|day)/);
  const durationDays = daysMatch ? parseInt(daysMatch[1], 10) : 7;

  // Extract category
  const allowedCategories: string[] = [];
  if (lower.includes("school supplies") || lower.includes("school")) {
    allowedCategories.push("School Supplies");
  } else if (lower.includes("electronics")) {
    allowedCategories.push("Electronics");
  } else if (lower.includes("groceries")) {
    allowedCategories.push("Groceries");
  } else {
    allowedCategories.push("General");
  }

  // Extract merchants
  const allowedMerchants: string[] = [];
  if (lower.includes("campus books")) {
    allowedMerchants.push("Campus Books");
  }
  if (lower.includes("paper & pencil") || lower.includes("paper and pencil")) {
    allowedMerchants.push("Paper & Pencil");
  }
  if (allowedMerchants.length === 0) {
    allowedMerchants.push("Campus Books");
  }

  // Inferred Name
  let name = "Agent Mandate";
  if (allowedCategories.includes("School Supplies")) {
    name = "School Shopping";
  }

  return {
    name,
    weeklyLimit,
    durationDays,
    allowedCategories,
    allowedMerchants,
  };
}

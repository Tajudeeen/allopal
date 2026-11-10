import { z } from "zod";
import { env, requireAiApiKey } from "@/lib/env";

export interface AgentCatalogItem {
  cartId: string;
  productName: string;
  amount: number;
  merchant: string;
  category: string;
}

const AgentSelectionSchema = z.object({
  cartId: z.string().min(1),
  reason: z.string().min(1).max(500),
});

export type AgentSelection = z.infer<typeof AgentSelectionSchema>;

const SYSTEM_INSTRUCTION = `
You are the shopping agent inside Allopal.

Your job is ONLY to translate a user's shopping request into one candidate cart from the supplied server-authoritative catalog.

You are NOT the authorization layer.
You MUST NOT decide that a purchase is allowed.
You MUST NOT override, reinterpret, weaken, or bypass the user's spending mandate.
You may select a cart that later fails policy. The deterministic Allopal policy engine makes the final authorization decision.

Return JSON only:
{
  "cartId": string,
  "reason": string
}

Choose exactly one cart from the supplied catalog.
Prefer the closest match to the user's requested item, category, merchant, and budget.
Do not invent products, prices, merchants, categories, or cart IDs.
`;

export async function selectCartForAgent(
  task: string,
  catalog: AgentCatalogItem[],
): Promise<AgentSelection> {
  if (!task.trim()) throw new Error("AGENT_TASK_REQUIRED");
  if (catalog.length === 0) throw new Error("AGENT_CATALOG_EMPTY");

  if (!env.AI_API_KEY) {
    const lower = task.toLowerCase();
    const match =
      catalog.find(
        (item) =>
          lower.includes(item.productName.toLowerCase()) ||
          lower.includes(item.category.toLowerCase()) ||
          lower.includes(item.merchant.toLowerCase()) ||
          (lower.includes("headset") && item.productName.toLowerCase().includes("headset")) ||
          (lower.includes("notebook") && item.productName.toLowerCase().includes("notebook")) ||
          (lower.includes("school") && item.category.toLowerCase().includes("school")),
      ) || catalog[0];

    return {
      cartId: match.cartId,
      reason: `Selected "${match.productName}" ($${(match.amount / 100).toFixed(2)}) matching task intent (AI key not set, rule fallback used).`,
    };
  }

  const apiKey = requireAiApiKey();
  const catalogText = catalog
    .map((item) => `- cartId: ${item.cartId}; product: ${item.productName}; amountCents: ${item.amount}; merchant: ${item.merchant}; category: ${item.category}`)
    .join("\n");

  // Gemini 2.5 Flash is being restricted for new API users. Use the supported
  // Flash-Lite model so the agent continues working with current API keys.
  const response = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/gemini-3.5-flash-lite:generateContent?key=${apiKey}`,
    {
      signal: AbortSignal.timeout(15000),
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        contents: [{ role: "user", parts: [{ text: `User request:
${task}

Server-authoritative catalog:
${catalogText}` }] }],
        systemInstruction: { parts: [{ text: SYSTEM_INSTRUCTION }] },
        generationConfig: { responseMimeType: "application/json", temperature: 0.1 },
      }),
    },
  );

  if (!response.ok) {
    const errorBody = (await response.text()).slice(0, 1200);
    // Keep the provider diagnostic in server logs, never return the API key
    // or raw provider response to the browser.
    console.error("Gemini agent request failed", {
      status: response.status,
      body: errorBody,
    });
    throw new Error(`Gemini agent error: ${response.status}`);
  }

  const data = await response.json();
  const output = data.candidates?.[0]?.content?.parts?.[0]?.text;
  if (typeof output !== "string") throw new Error("Gemini agent returned an empty response.");

  const selection = AgentSelectionSchema.parse(JSON.parse(output));
  if (!catalog.some((item) => item.cartId === selection.cartId)) {
    throw new Error("AGENT_SELECTED_UNKNOWN_CART");
  }
  return selection;
}

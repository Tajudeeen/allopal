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

const STOP_WORDS = new Set([
  "buy", "find", "get", "please", "want", "need", "the", "for", "me",
  "some", "something", "best", "under", "below", "less", "than", "with",
  "within", "maximum", "max", "dollar", "dollars",
]);

function taskTerms(task: string) {
  return task
    .toLowerCase()
    .split(/[^a-z0-9]+/)
    .filter((term) => term.length > 2 && !STOP_WORDS.has(term));
}

export function selectCartDeterministically(
  task: string,
  catalog: AgentCatalogItem[],
  source = "AI provider unavailable",
): AgentSelection {
  const terms = taskTerms(task);
  const budgetMatch = task.match(
    /\b(?:under|below|less than|max(?:imum)?|within)\s*\$?\s*(\d+(?:\.\d{1,2})?)/i,
  );
  const budgetCents = budgetMatch
    ? Math.round(Number(budgetMatch[1]) * 100)
    : null;

  const ranked = catalog
    .map((item) => {
      const product = item.productName.toLowerCase();
      const category = item.category.toLowerCase();
      const merchant = item.merchant.toLowerCase();
      const score = terms.reduce((total, term) => {
        if (product.includes(term)) return total + 4;
        if (category.includes(term)) return total + 3;
        if (merchant.includes(term)) return total + 1;
        return total;
      }, 0) + (budgetCents === null ? 0 : item.amount <= budgetCents ? 2 : -2);
      return { item, score };
    })
    .sort((a, b) => b.score - a.score);

  const best = ranked[0];
  if (!best || best.score <= 0) {
    throw new Error("AGENT_NO_CATALOG_MATCH");
  }

  return {
    cartId: best.item.cartId,
    reason: `${source}. Matched "${best.item.productName}" ($${(best.item.amount / 100).toFixed(2)}) using the local catalog matcher.`,
  };
}

export async function selectCartForAgent(
  task: string,
  catalog: AgentCatalogItem[],
): Promise<AgentSelection> {
  if (!task.trim()) throw new Error("AGENT_TASK_REQUIRED");
  if (catalog.length === 0) throw new Error("AGENT_CATALOG_EMPTY");

  if (!env.AI_API_KEY) {
    return selectCartDeterministically(task, catalog, "AI key is not configured");
  }

  const apiKey = requireAiApiKey();
  const catalogText = catalog
    .map((item) => `- cartId: ${item.cartId}; product: ${item.productName}; amountCents: ${item.amount}; merchant: ${item.merchant}; category: ${item.category}`)
    .join("\n");

  try {
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
      // Keep provider diagnostics server-side. Never expose the key or raw
      // provider response to the browser.
      console.error("Gemini agent request failed", {
        status: response.status,
        body: errorBody,
      });
      return selectCartDeterministically(
        task,
        catalog,
        `Gemini unavailable (HTTP ${response.status})`,
      );
    }

    const data = await response.json();
    const output = data.candidates?.[0]?.content?.parts?.[0]?.text;
    if (typeof output !== "string") {
      return selectCartDeterministically(
        task,
        catalog,
        "Gemini returned an invalid response",
      );
    }

    const selection = AgentSelectionSchema.parse(JSON.parse(output));
    if (!catalog.some((item) => item.cartId === selection.cartId)) {
      return selectCartDeterministically(
        task,
        catalog,
        "Gemini selected an unknown cart",
      );
    }
    return selection;
  } catch (error) {
    console.error("Gemini agent selection failed", {
      message: error instanceof Error ? error.message : "Unknown provider error",
    });
    return selectCartDeterministically(
      task,
      catalog,
      "Gemini request failed",
    );
  }
}

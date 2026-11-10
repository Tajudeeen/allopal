import { z } from "zod";
import { groqChatCompletion } from "@/lib/ai/groq";

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

  const catalogText = catalog
    .map((item) => `- cartId: ${item.cartId}; product: ${item.productName}; amountCents: ${item.amount}; merchant: ${item.merchant}; category: ${item.category}`)
    .join("\n");

  try {
    const output = await groqChatCompletion(
      [
        { role: "system", content: SYSTEM_INSTRUCTION },
        {
          role: "user",
          content: `User request:\n${task}\n\nServer-authoritative catalog:\n${catalogText}`,
        },
      ],
      {
        type: "json_schema",
        json_schema: {
          name: "allopal_cart_selection",
          strict: true,
          schema: {
            type: "object",
            properties: {
              cartId: { type: "string" },
              reason: { type: "string" },
            },
            required: ["cartId", "reason"],
            additionalProperties: false,
          },
        },
      },
    );

    const selection = AgentSelectionSchema.parse(JSON.parse(output));
    if (!catalog.some((item) => item.cartId === selection.cartId)) {
      return selectCartDeterministically(task, catalog, "Groq selected an unknown cart");
    }
    return selection;
  } catch (error) {
    console.error("Groq agent selection failed", {
      message: error instanceof Error ? error.message : "Unknown provider error",
    });
    return selectCartDeterministically(task, catalog, "Groq unavailable");
  }
}

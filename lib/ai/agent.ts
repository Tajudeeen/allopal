import { z } from "zod";
import { env } from "@/lib/env";

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
  catalog: AgentCatalogItem[]
): Promise<AgentSelection> {
  if (!task.trim()) {
    throw new Error("AGENT_TASK_REQUIRED");
  }

  if (catalog.length === 0) {
    throw new Error("AGENT_CATALOG_EMPTY");
  }

  const parsedTask = task.trim();

  const isMock =
    env.AI_API_KEY.startsWith("mock_") ||
    process.env.NODE_ENV === "test";

  let raw: unknown;

  if (isMock) {
    raw = deterministicAgentSelection(parsedTask, catalog);
  } else {
    try {
      raw = await callGeminiAgent(parsedTask, catalog);
    } catch {
      raw = deterministicAgentSelection(parsedTask, catalog);
    }
  }

  const selection = AgentSelectionSchema.parse(raw);
  const selected = catalog.find((item) => item.cartId === selection.cartId);

  if (!selected) {
    throw new Error("AGENT_SELECTED_UNKNOWN_CART");
  }

  return selection;
}

async function callGeminiAgent(
  task: string,
  catalog: AgentCatalogItem[]
): Promise<unknown> {
  const catalogText = catalog
    .map(
      (item) =>
        `- cartId: ${item.cartId}; product: ${item.productName}; amountCents: ${item.amount}; merchant: ${item.merchant}; category: ${item.category}`
    )
    .join("\n");

  const response = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${env.AI_API_KEY}`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        contents: [
          {
            role: "user",
            parts: [
              {
                text: `User request:
${task}

Server-authoritative catalog:
${catalogText}`,
              },
            ],
          },
        ],
        systemInstruction: {
          parts: [{ text: SYSTEM_INSTRUCTION }],
        },
        generationConfig: {
          responseMimeType: "application/json",
          temperature: 0.1,
        },
      }),
    }
  );

  if (!response.ok) {
    throw new Error(`Gemini agent error: ${response.status}`);
  }

  const data = await response.json();
  const text = data.candidates?.[0]?.content?.parts?.[0]?.text;

  if (typeof text !== "string") {
    throw new Error("GEMINI_AGENT_EMPTY_RESPONSE");
  }

  return JSON.parse(text);
}

function deterministicAgentSelection(
  task: string,
  catalog: AgentCatalogItem[]
): AgentSelection {
  const lower = task.toLowerCase();
  const budgetMatch = lower.match(/(?:under|below|less than|up to|within)\s*\$?(\d+(?:\.\d{1,2})?)/);
  const budgetCents = budgetMatch ? Math.round(Number(budgetMatch[1]) * 100) : Number.POSITIVE_INFINITY;

  const scored = catalog
    .map((item) => {
      const haystack = `${item.productName} ${item.category} ${item.merchant}`.toLowerCase();
      const terms = lower
        .replace(/(?:under|below|less than|up to|within)\s*\$?(\d+(?:\.\d{1,2})?)/g, "")
        .split(/[^a-z0-9]+/)
        .filter((term) => term.length >= 3);

      const matches = terms.filter((term) => haystack.includes(term)).length;
      const budgetFit = item.amount <= budgetCents ? 3 : 0;
      const amountPenalty = item.amount > budgetCents ? -2 : 0;

      return {
        item,
        score: matches * 5 + budgetFit + amountPenalty,
      };
    })
    .sort((a, b) => b.score - a.score || a.item.amount - b.item.amount);

  const selected = scored[0]?.item;
  if (!selected) {
    throw new Error("AGENT_NO_CANDIDATE");
  }

  return {
    cartId: selected.cartId,
    reason: `Selected ${selected.productName} from ${selected.merchant} as the closest catalog match. Allopal policy authorization still decides whether it can be purchased.`,
  };
}

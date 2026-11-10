import { env } from "@/lib/env";
import { groqChatCompletion } from "@/lib/ai/groq";
import { MandateProposalSchema, AIInterpretationResult } from "./types";

export async function interpretMandatePrompt(prompt: string): Promise<AIInterpretationResult> {
  if (!prompt || typeof prompt !== "string" || prompt.trim().length === 0) {
    return { proposal: null, error: "Prompt cannot be empty", requiresHumanApproval: true };
  }

  if (!env.GROQ_API_KEY) {
    const lower = prompt.toLowerCase();
    const limitMatch = prompt.match(/\$?(\d+)/);
    const limit = limitMatch ? parseInt(limitMatch[1], 10) * 100 : 4000;
    const isSchool = lower.includes("school") || lower.includes("book") || lower.includes("supplies");
    return {
      proposal: {
        name: isSchool ? "School Shopping" : "General Mandate",
        weeklyLimit: limit,
        allowedCategories: isSchool ? ["School Supplies"] : ["School Supplies", "General"],
        allowedMerchants: isSchool ? ["Campus Books", "Paper & Pencil"] : ["Campus Books"],
        durationDays: 7,
      },
      requiresHumanApproval: true,
    };
  }

  const output = await groqChatCompletion(
    [
      {
        role: "system",
        content: "You are a financial mandate structuring assistant for Allopal. Extract a proposed spending mandate from the user's request. Convert monetary limits to integer cents. Duration is integer days, default 7. Extract allowed categories and merchants. Return JSON with name, weeklyLimit, durationDays, allowedCategories, allowedMerchants. This is a draft only and never activates a mandate.",
      },
      { role: "user", content: prompt },
    ],
    { type: "json_object" },
  );

  const structuredJson = JSON.parse(output);
  const validationResult = MandateProposalSchema.safeParse(structuredJson);
  if (!validationResult.success) {
    return {
      proposal: null,
      rawResponse: JSON.stringify(structuredJson),
      error: `Proposal failed schema validation: ${validationResult.error.issues.map((issue) => `${issue.path.join(".")}: ${issue.message}`).join("; ")}`,
      requiresHumanApproval: true,
    };
  }
  return { proposal: validationResult.data, requiresHumanApproval: true };
}

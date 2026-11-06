import type { AgAiAgentRunner } from "ag-studio";
import type { AnalystAnswer } from "./types";

export async function askAnalyst(
  question: string,
  signal?: AbortSignal,
): Promise<AnalystAnswer> {
  const response = await fetch("/api/analytics/ask", {
    method: "POST",
    signal,
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ question }),
  });
  const result = await response.json();
  if (!response.ok)
    throw new Error(result.message || result.error || "Analysis unavailable.");
  return result;
}

/** A single custom Studio agent. No spending tools or browser-selected records are sent. */
export const spendingAnalyst: AgAiAgentRunner = {
  id: "allopal-analyst",
  name: "Allopal spending analyst",
  tools: () => [],
  run: async function* (input, context) {
    const { threadId, runId } = input;
    yield { type: "RUN_STARTED", threadId, runId };
    const question = [...input.messages]
      .reverse()
      .find((m) => m.role === "user")?.content;
    if (typeof question !== "string") {
      yield {
        type: "RUN_ERROR",
        message: "Ask a question about your spending records.",
      };
      return;
    }
    try {
      const result = await askAnalyst(question, context.signal);
      const messageId = `answer-${runId}`;
      yield { type: "TEXT_MESSAGE_START", messageId, role: "assistant" };
      yield {
        type: "TEXT_MESSAGE_CONTENT",
        messageId,
        delta: `${result.answer}\n\nEvidence: ${result.evidenceIds.join(", ")}\nRead-only analysis. Snapshot: ${result.generatedAt}`,
      };
      yield { type: "TEXT_MESSAGE_END", messageId };
      yield { type: "RUN_FINISHED", threadId, runId };
    } catch (error) {
      if (!context.signal?.aborted)
        yield {
          type: "RUN_ERROR",
          message:
            error instanceof Error ? error.message : "Analysis unavailable.",
        };
    }
  },
};

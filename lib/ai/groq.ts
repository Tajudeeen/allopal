import { env, requireGroqApiKey } from "@/lib/env";

type GroqMessage = { role: "system" | "user"; content: string };

export async function groqChatCompletion(
  messages: GroqMessage[],
  responseFormat?: Record<string, unknown>,
): Promise<string> {
  const response = await fetch("https://api.groq.com/openai/v1/chat/completions", {
    method: "POST",
    signal: AbortSignal.timeout(15000),
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${requireGroqApiKey()}`,
    },
    body: JSON.stringify({
      model: env.GROQ_MODEL,
      messages,
      temperature: 0.1,
      ...(responseFormat ? { response_format: responseFormat } : {}),
    }),
  });

  if (!response.ok) {
    const diagnostic = (await response.text()).slice(0, 800);
    console.error("Groq request failed", { status: response.status, body: diagnostic });
    throw new Error(`GROQ_REQUEST_FAILED_${response.status}`);
  }

  const data = await response.json();
  const content = data.choices?.[0]?.message?.content;
  if (typeof content !== "string" || !content.trim()) {
    throw new Error("GROQ_EMPTY_RESPONSE");
  }
  return content.trim();
}

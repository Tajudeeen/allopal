import { NextRequest, NextResponse } from "next/server";
import { z } from "zod/v3";
import {
  requireWorkspace,
  accessResponse,
  AccessError,
} from "@/lib/security/access";
import { ProviderConfigurationError } from "@/lib/env";
import { getSpendingReport } from "@/lib/analytics/report";
import { analyzeSpending } from "@/lib/ai/analyst";
import { checkRateLimit, RATE_LIMITS } from "@/lib/ratelimit";

export const dynamic = "force-dynamic";
const schema = z
  .object({ question: z.string().trim().min(3).max(500) })
  .strict();
// Single-host demo cost guard. It deliberately holds no prompts or financial data.
const requests = new Map<string, number[]>();
export async function POST(req: NextRequest) {
  try {
    const workspaceId = await requireWorkspace(req);
    const rl = checkRateLimit(`analytics:${workspaceId}`, RATE_LIMITS.AI);
    if (!rl.allowed) {
      return NextResponse.json(
        { error: "RATE_LIMIT_EXCEEDED", message: "Too many analysis requests. Please wait." },
        { status: 429, headers: { "Retry-After": String(Math.ceil((rl.resetAt - Date.now()) / 1000)) } },
      );
    }
    let body: unknown;
    try {
      body = await req.json();
    } catch {
      return NextResponse.json({ error: "INVALID_REQUEST" }, { status: 400 });
    }
    const parsed = schema.safeParse(body);
    if (!parsed.success)
      return NextResponse.json({ error: "INVALID_QUESTION" }, { status: 400 });
    const now = Date.now();
    for (const [id, times] of requests)
      if ((times.at(-1) ?? 0) < now - 60000) requests.delete(id);
    const recent = (requests.get(workspaceId) ?? []).filter(
      (t) => t > now - 60000,
    );
    if (
      recent.length >= 6 ||
      (requests.size >= 1000 && !requests.has(workspaceId))
    )
      return NextResponse.json(
        { error: "Try again in a minute." },
        { status: 429, headers: { "Retry-After": "60" } },
      );
    requests.set(workspaceId, [...recent, now]);
    const report = await getSpendingReport(workspaceId);
    return NextResponse.json(
      await analyzeSpending(parsed.data.question, report),
      { headers: { "Cache-Control": "private, no-store" } },
    );
  } catch (error) {
    if (
      error instanceof AccessError ||
      error instanceof ProviderConfigurationError
    )
      return accessResponse(error);
    const diagnostic =
      error instanceof Error && /^[A-Z0-9_]{1,80}$/.test(error.message)
        ? error.message
        : error instanceof Error
          ? error.name
          : "UNKNOWN";
    console.error("ANALYSIS_UNAVAILABLE", { diagnostic });
    return NextResponse.json(
      {
        error: "ANALYSIS_UNAVAILABLE",
        message:
          "Analysis is unavailable. Your recorded balances and payment state have not changed.",
      },
      { status: 502 },
    );
  }
}

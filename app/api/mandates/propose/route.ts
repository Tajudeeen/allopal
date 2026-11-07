import { ProviderConfigurationError } from "@/lib/env";
import {
  requireWorkspace,
  accessResponse,
  AccessError,
} from "@/lib/security/access";
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { interpretMandatePrompt } from "@/lib/ai/interpreter";
import { checkRateLimit, RATE_LIMITS } from "@/lib/ratelimit";

export const dynamic = "force-dynamic";

const proposeSchema = z.object({
  prompt: z.string().min(1, "Prompt cannot be empty"),
});

export async function POST(req: NextRequest) {
  try {
    const workspaceId = await requireWorkspace(req);
    const rl = checkRateLimit(`propose:${workspaceId}`, RATE_LIMITS.AI);
    if (!rl.allowed) {
      return NextResponse.json(
        { error: "RATE_LIMIT_EXCEEDED", message: "Too many mandate proposals. Please wait." },
        { status: 429, headers: { "Retry-After": String(Math.ceil((rl.resetAt - Date.now()) / 1000)) } },
      );
    }
    const rawBody = await req.json();
    const parsed = proposeSchema.safeParse(rawBody);

    if (!parsed.success) {
      return NextResponse.json(
        {
          error: "INVALID_REQUEST",
          details: parsed.error.issues,
        },
        { status: 400 },
      );
    }

    const result = await interpretMandatePrompt(parsed.data.prompt);

    if (!result.proposal) {
      return NextResponse.json(
        {
          error: "PROPOSAL_VALIDATION_FAILED",
          message:
            result.error || "Failed to generate a valid mandate proposal.",
          rawResponse: result.rawResponse,
        },
        { status: 422 },
      );
    }

    // Return structured proposed mandate.
    // INVARIANT: This mandate is NOT active yet. A human must explicitly review and lock it.
    return NextResponse.json({
      status: "PROPOSED",
      proposal: result.proposal,
      requiresHumanApproval: true,
      message:
        "Mandate proposal generated. Human approval required to lock and activate.",
    });
  } catch (error: unknown) {
    if (
      error instanceof AccessError ||
      error instanceof ProviderConfigurationError
    )
      return accessResponse(error);
    const message =
      error instanceof SyntaxError
        ? "Invalid JSON request."
        : "The service is currently unavailable.";
    return NextResponse.json(
      {
        error: "INTERPRETATION_ERROR",
        message,
      },
      { status: error instanceof SyntaxError ? 400 : 500 },
    );
  }
}

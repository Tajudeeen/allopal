import { ProviderConfigurationError } from "@/lib/env";
import {
  requireWorkspace,
  accessResponse,
  AccessError,
} from "@/lib/security/access";
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db/prisma";
import { generateDecisionExplanation } from "@/lib/ai/explainer";

export const dynamic = "force-dynamic";

const explainSchema = z.object({
  decisionId: z.string().optional(),
  decision: z
    .object({
      status: z.enum(["ALLOWED", "DENIED"]),
      reason: z.string(),
      failedCheck: z.string().nullable(),
      amount: z.number().int(),
      merchant: z.string(),
      category: z.string(),
      remainingBudget: z.number().int().optional(),
      paypalCalled: z.boolean().optional(),
      paymentStatus: z.string().nullable().optional(),
    })
    .optional(),
});

export async function POST(req: NextRequest) {
  try {
    const workspaceId = await requireWorkspace(req);
    const rawBody = await req.json();
    const parsed = explainSchema.safeParse(rawBody);

    if (!parsed.success) {
      return NextResponse.json(
        { error: "INVALID_REQUEST", details: parsed.error.issues },
        { status: 400 },
      );
    }

    let decisionData;

    if (parsed.data.decisionId) {
      const dbDecision = await prisma.decision.findFirst({
        where: { id: parsed.data.decisionId, mandate: { workspaceId } },
        include: { mandate: true, transaction: true },
      });

      if (!dbDecision) {
        return NextResponse.json(
          { error: "DECISION_NOT_FOUND", message: "Decision ID not found." },
          { status: 404 },
        );
      }

      decisionData = {
        status: dbDecision.status as "ALLOWED" | "DENIED",
        reason: dbDecision.reason,
        failedCheck: dbDecision.status === "DENIED" ? dbDecision.reason : null,
        amount: dbDecision.amount,
        merchant: dbDecision.merchant,
        category: dbDecision.category,
        remainingBudget: dbDecision.mandate
          ? dbDecision.mandate.weeklyLimit - dbDecision.mandate.spentAmount
          : undefined,
        paypalCalled: Boolean(dbDecision.transaction),
        paymentStatus: dbDecision.transaction?.status ?? null,
      };
    } else if (parsed.data.decision) {
      decisionData = parsed.data.decision;
    } else {
      return NextResponse.json(
        {
          error: "INVALID_REQUEST",
          message: "Either decisionId or decision object is required.",
        },
        { status: 400 },
      );
    }

    const explanation = await generateDecisionExplanation(decisionData);

    // CRITICAL: isReadOnly confirms that the original status cannot be altered
    return NextResponse.json({
      decisionStatus: decisionData.status,
      explanation,
      isReadOnly: true,
      timestamp: new Date().toISOString(),
    });
  } catch (error: unknown) {
    if (
      error instanceof AccessError ||
      error instanceof ProviderConfigurationError
    )
      return accessResponse(error);
    const message =
      error instanceof Error ? error.message : "Internal Explanation Error";
    return NextResponse.json(
      { error: "EXPLANATION_FAILED", message },
      { status: error instanceof SyntaxError ? 400 : 500 },
    );
  }
}

import {
  requireWorkspace,
  accessResponse,
  AccessError,
} from "@/lib/security/access";
import { NextRequest, NextResponse } from "next/server";
import { MandateProposalSchema } from "@/lib/ai/types";
import { prisma } from "@/lib/db/prisma";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  try {
    const workspaceId = await requireWorkspace(req);
    const rawBody = await req.json();

    // Human confirmation payload must pass the strict schema
    const parsed = MandateProposalSchema.safeParse(rawBody);
    if (!parsed.success) {
      return NextResponse.json(
        {
          error: "INVALID_PROPOSAL_SCHEMA",
          details: parsed.error.issues,
        },
        { status: 400 },
      );
    }

    const proposal = parsed.data;

    // Create the authoritative locked Mandate in the database
    const now = new Date();
    const validUntil = new Date(
      now.getTime() + proposal.durationDays * 24 * 60 * 60 * 1000,
    );

    const lockedMandate = await prisma.mandate.create({
      data: {
        workspaceId,
        name: proposal.name,
        weeklyLimit: proposal.weeklyLimit,
        spentAmount: 0,
        validFrom: now,
        validUntil,
        status: "ACTIVE", // Only human approval can activate
        allowedCategories: JSON.stringify(proposal.allowedCategories),
        allowedMerchants: JSON.stringify(proposal.allowedMerchants),
      },
    });

    return NextResponse.json({
      status: "LOCKED_AND_ACTIVE",
      mandate: {
        id: lockedMandate.id,
        name: lockedMandate.name,
        weeklyLimit: lockedMandate.weeklyLimit,
        spentAmount: lockedMandate.spentAmount,
        validFrom: lockedMandate.validFrom,
        validUntil: lockedMandate.validUntil,
        status: lockedMandate.status,
        allowedCategories: JSON.parse(lockedMandate.allowedCategories),
        allowedMerchants: JSON.parse(lockedMandate.allowedMerchants),
      },
      message: "Mandate explicitly reviewed, approved, and locked by human.",
    });
  } catch (error: unknown) {
    if (error instanceof AccessError) return accessResponse(error);
    const message =
      error instanceof SyntaxError
        ? "Invalid JSON request."
        : "The service is currently unavailable.";
    return NextResponse.json(
      {
        error: "MANDATE_LOCKING_FAILED",
        message,
      },
      { status: error instanceof SyntaxError ? 400 : 500 },
    );
  }
}

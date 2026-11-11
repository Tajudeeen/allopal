import {
  requireWorkspace,
  accessResponse,
  AccessError,
} from "@/lib/security/access";
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod/v3";
import { prisma } from "@/lib/db/prisma";

export const dynamic = "force-dynamic";

const revokeSchema = z.object({
  mandateId: z.string().min(1, "mandateId is required"),
});

export async function POST(req: NextRequest) {
  try {
    const workspaceId = await requireWorkspace(req);
    const rawBody = await req.json();
    const parsed = revokeSchema.safeParse(rawBody);

    if (!parsed.success) {
      return NextResponse.json(
        { error: "INVALID_REQUEST", details: parsed.error.issues },
        { status: 400 },
      );
    }

    const { mandateId } = parsed.data;

    const existing = await prisma.mandate.findFirst({
      where: { id: mandateId, workspaceId },
    });

    if (!existing) {
      return NextResponse.json(
        { error: "MANDATE_NOT_FOUND", message: "Mandate ID was not found." },
        { status: 404 },
      );
    }

    if (existing.status === "REVOKED") {
      return NextResponse.json({
        status: "REVOKED",
        mandate: {
          id: existing.id,
          name: existing.name,
          status: existing.status,
        },
        message: `Mandate "${existing.name}" is already revoked.`,
      });
    }

    const updated = await prisma.mandate.update({
      where: { id: mandateId },
      data: { status: "REVOKED" },
    });

    return NextResponse.json({
      status: "REVOKED",
      mandate: {
        id: updated.id,
        name: updated.name,
        status: updated.status,
      },
      message: `Mandate "${updated.name}" has been successfully revoked. New requests and unclaimed captures are blocked. A capture already in progress may still settle.`,
    });
  } catch (error: unknown) {
    if (error instanceof AccessError) return accessResponse(error);
    const message = "Revocation could not be completed. Please try again.";
    return NextResponse.json(
      { error: "REVOCATION_FAILED", message },
      { status: error instanceof SyntaxError ? 400 : 500 },
    );
  }
}

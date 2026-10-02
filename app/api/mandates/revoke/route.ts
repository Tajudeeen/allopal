import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db/prisma";

export const dynamic = "force-dynamic";

const revokeSchema = z.object({
  mandateId: z.string().min(1, "mandateId is required"),
});

export async function POST(req: NextRequest) {
  try {
    const rawBody = await req.json();
    const parsed = revokeSchema.safeParse(rawBody);

    if (!parsed.success) {
      return NextResponse.json({ error: "INVALID_REQUEST", details: parsed.error.issues }, { status: 400 });
    }

    const { mandateId } = parsed.data;

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
      message: `Mandate "${updated.name}" has been successfully revoked. All future payments will be blocked.`,
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Internal Error";
    return NextResponse.json({ error: "REVOCATION_FAILED", message }, { status: 500 });
  }
}

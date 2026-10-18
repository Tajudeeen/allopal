import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db/prisma";
import { requireWorkspace, accessResponse } from "@/lib/security/access";
import { env } from "@/lib/env";
export const dynamic = "force-dynamic";
export async function GET(req: NextRequest) {
  try {
    const workspaceId = await requireWorkspace(req);
    const [mandates, decisions, transactions] = await Promise.all([
      prisma.mandate.findMany({
        where: { workspaceId },
        select: {
          id: true,
          name: true,
          weeklyLimit: true,
          spentAmount: true,
          status: true,
          validFrom: true,
          validUntil: true,
        },
      }),
      prisma.decision.findMany({
        where: { mandate: { workspaceId } },
        orderBy: { createdAt: "asc" },
        select: {
          id: true,
          mandateId: true,
          cartId: true,
          status: true,
          reason: true,
          amount: true,
          checks: true,
          paypalOrderId: true,
          createdAt: true,
        },
      }),
      prisma.payPalTransaction.findMany({
        where: { mandate: { workspaceId } },
        orderBy: { createdAt: "asc" },
        select: {
          id: true,
          decisionId: true,
          orderId: true,
          captureId: true,
          amount: true,
          currency: true,
          status: true,
          providerCalled: true,
          reservationReleased: true,
          errorCode: true,
          createdAt: true,
          updatedAt: true,
        },
      }),
    ]);
    return NextResponse.json(
      {
        generatedAt: new Date().toISOString(),
        environment: env.PAYPAL_API_BASE_URL.includes("sandbox")
          ? "sandbox"
          : "production",
        artifactType: "session-runtime-snapshot",
        note: "This is a sanitized database snapshot. Verify order and capture IDs in PayPal Sandbox. Automated test evidence is documented separately.",
        mandates,
        decisions: decisions.map((d) => ({
          ...d,
          checks: JSON.parse(d.checks),
        })),
        transactions,
      },
      {
        headers: {
          "Content-Disposition":
            'attachment; filename="allopal-runtime-evidence.json"',
          "Cache-Control": "private, no-store",
        },
      },
    );
  } catch (error) {
    return accessResponse(error);
  }
}

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db/prisma";
import { env } from "@/lib/env";
import { requireWorkspace, accessResponse } from "@/lib/security/access";
export const dynamic = "force-dynamic";
export async function GET(req?: NextRequest) {
  try {
    const workspaceId = await requireWorkspace(req);
    const mandate = await prisma.mandate.findFirst({
      where: { workspaceId },
      orderBy: { createdAt: "desc" },
    });
    const carts = await prisma.cart.findMany({
      include: { items: { include: { product: true } } },
    });
    const decisions = await prisma.decision.findMany({
      where: { mandate: { workspaceId } },
      orderBy: { createdAt: "desc" },
      take: 100,
      include: {
        transaction: {
          select: { status: true, captureId: true, providerCalled: true },
        },
      },
    });
    const transactions = await prisma.payPalTransaction.findMany({
      where: { mandate: { workspaceId } },
      orderBy: { createdAt: "desc" },
      take: 100,
      select: {
        id: true,
        orderId: true,
        captureId: true,
        mandateId: true,
        decisionId: true,
        amount: true,
        currency: true,
        status: true,
        createdAt: true,
        updatedAt: true,
        errorCode: true,
        approvalUrl: true,
      },
    });
    return NextResponse.json(
      {
        paypalMode: env.PAYPAL_API_BASE_URL.includes("sandbox")
          ? "PAYPAL_SANDBOX"
          : "PAYPAL",
        aiConfigured: Boolean(env.AI_API_KEY),
        paypalConfigured: Boolean(
          env.PAYPAL_CLIENT_ID && env.PAYPAL_CLIENT_SECRET,
        ),
        mandate: mandate
          ? {
              ...mandate,
              allowedCategories: JSON.parse(mandate.allowedCategories),
              allowedMerchants: JSON.parse(mandate.allowedMerchants),
            }
          : null,
        carts,
        decisions: decisions.map((d) => ({
          ...d,
          checks: JSON.parse(d.checks),
          paymentStatus: d.transaction?.status ?? null,
          paypalCaptureId: d.transaction?.captureId ?? null,
          paypalCalled: d.transaction?.providerCalled ?? false,
        })),
        transactions,
      },
      { headers: { "Cache-Control": "private, no-store" } },
    );
  } catch (error) {
    return accessResponse(error);
  }
}

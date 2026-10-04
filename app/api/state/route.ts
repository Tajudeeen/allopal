import { NextResponse } from "next/server";
import { prisma } from "@/lib/db/prisma";
import { env } from "@/lib/env";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    // 1. Fetch current active or latest mandate
    const mandate = await prisma.mandate.findFirst({
      orderBy: { createdAt: "desc" },
    });

    // 2. Fetch carts with items and products
    const carts = await prisma.cart.findMany({
      include: {
        items: {
          include: {
            product: true,
          },
        },
      },
    });

    // 3. Fetch decision ledger (latest 20)
    const decisions = await prisma.decision.findMany({
      orderBy: { createdAt: "desc" },
      take: 20,
      include: {
        transaction: true,
      },
    });

    // 4. Fetch PayPal transactions
    const transactions = await prisma.payPalTransaction.findMany({
      orderBy: { createdAt: "desc" },
      take: 20,
    });

    const paypalMode = env.PAYPAL_API_BASE_URL.includes("sandbox")
      ? "PAYPAL_SANDBOX"
      : "PAYPAL";

    const paypalConfigured = Boolean(
      env.PAYPAL_CLIENT_ID && env.PAYPAL_CLIENT_SECRET
    );

    return NextResponse.json({
      paypalMode,
      paypalConfigured,
      mandate: mandate
        ? {
            ...mandate,
            allowedCategories: JSON.parse(mandate.allowedCategories || "[]"),
            allowedMerchants: JSON.parse(mandate.allowedMerchants || "[]"),
          }
        : null,
      carts,
      decisions: decisions.map((d) => ({
        ...d,
        checks: JSON.parse(d.checks || "{}"),
        paymentStatus: d.transaction?.status ?? null,
        paypalCaptureId: d.transaction?.captureId ?? null,
      })),
      transactions,
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Internal Error";
    return NextResponse.json({ error: "FAILED_TO_LOAD_STATE", message }, { status: 500 });
  }
}

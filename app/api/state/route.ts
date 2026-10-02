import { NextResponse } from "next/server";
import { prisma } from "@/lib/db/prisma";

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
    });

    // 4. Fetch PayPal transactions
    const transactions = await prisma.payPalTransaction.findMany({
      orderBy: { createdAt: "desc" },
      take: 20,
    });

    return NextResponse.json({
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
      })),
      transactions,
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Internal Error";
    return NextResponse.json({ error: "FAILED_TO_LOAD_STATE", message }, { status: 500 });
  }
}

import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db/prisma";
import { evaluateMandate } from "@/lib/policy/engine";

const authorizeSchema = z.object({
  mandateId: z.string().min(1, "mandateId is required"),
  cartId: z.string().min(1, "cartId is required"),
});

export async function POST(req: NextRequest) {
  try {
    const rawBody = await req.json();

    // 1. Strict validation of input identifiers only
    // Even if client sends amount, merchant, or status, zod strips/ignores them
    const parsed = authorizeSchema.safeParse(rawBody);
    if (!parsed.success) {
      return NextResponse.json(
        {
          error: "INVALID_REQUEST",
          details: parsed.error.issues,
        },
        { status: 400 }
      );
    }

    const { mandateId, cartId } = parsed.data;

    // 2. Server loads authoritative mandate from database
    const mandate = await prisma.mandate.findUnique({
      where: { id: mandateId },
    });

    // 3. Server loads authoritative cart and product prices from database
    const cart = await prisma.cart.findUnique({
      where: { id: cartId },
      include: {
        items: {
          include: {
            product: true,
          },
        },
      },
    });

    // 4. Deterministic policy engine evaluation
    const decisionResult = evaluateMandate(mandate, cart);

    // 5. Persist decision in database (paypalOrderId MUST be null at authorization stage)
    // If mandate or cart is missing from DB, we handle recording or fallback gracefully
    let savedDecision = null;
    if (mandate && cart) {
      savedDecision = await prisma.decision.create({
        data: {
          mandateId: mandate.id,
          cartId: cart.id,
          amount: decisionResult.amount,
          merchant: decisionResult.merchant,
          category: decisionResult.category,
          status: decisionResult.status,
          reason: decisionResult.reason,
          checks: JSON.stringify(decisionResult.checks),
          paypalOrderId: null, // Critical: At authorization stage, PayPal is never called
        },
      });
    }

    return NextResponse.json({
      decisionId: savedDecision?.id ?? null,
      status: decisionResult.status,
      reason: decisionResult.reason,
      failedCheck: decisionResult.failedCheck,
      amount: decisionResult.amount,
      merchant: decisionResult.merchant,
      category: decisionResult.category,
      remainingBudgetBefore: decisionResult.remainingBudgetBefore,
      remainingBudgetAfter: decisionResult.remainingBudgetAfter,
      checks: decisionResult.checks,
      paypalOrderId: null,
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Internal Server Error";
    return NextResponse.json(
      {
        error: "INTERNAL_ERROR",
        message,
      },
      { status: 500 }
    );
  }
}

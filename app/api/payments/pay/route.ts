import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db/prisma";
import { evaluateMandate } from "@/lib/policy/engine";
import { payPalClient } from "@/lib/paypal/client";

const paySchema = z.object({
  mandateId: z.string().min(1, "mandateId is required"),
  cartId: z.string().min(1, "cartId is required"),
});

export async function POST(req: NextRequest) {
  try {
    const rawBody = await req.json();
    const parsed = paySchema.safeParse(rawBody);

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

    // 1. Authoritative lookup of Mandate and Cart
    const mandate = await prisma.mandate.findUnique({
      where: { id: mandateId },
    });

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

    // 2. CRITICAL GATE: Deterministic Policy Engine Evaluation FIRST
    const decision = evaluateMandate(mandate, cart);

    // 3. IF POLICY FAILS: Stop immediately, NEVER call PayPal
    if (decision.status !== "ALLOWED" || !mandate || !cart) {
      let deniedDecision = null;
      if (mandate && cart) {
        deniedDecision = await prisma.decision.create({
          data: {
            mandateId: mandate.id,
            cartId: cart.id,
            amount: decision.amount,
            merchant: decision.merchant,
            category: decision.category,
            status: "DENIED",
            reason: decision.reason,
            checks: JSON.stringify(decision.checks),
            paypalOrderId: null, // Guaranteed invariant: No PayPal order created
          },
        });
      }

      return NextResponse.json(
        {
          status: "DENIED",
          reason: decision.reason,
          failedCheck: decision.failedCheck,
          amount: decision.amount,
          merchant: decision.merchant,
          category: decision.category,
          paypalCalled: false,
          paypalOrderId: null,
          decisionId: deniedDecision?.id ?? null,
          remainingBudget: decision.remainingBudgetBefore,
        },
        { status: 403 }
      );
    }

    // 4. POLICY PASSED: Execute PayPal Order Creation & Capture
    // Create PayPal Sandbox Order
    const payPalOrder = await payPalClient.createOrder({
      amountInCents: cart.totalAmount,
      currency: "USD",
      referenceId: cart.id,
      description: `Allopal mandate payment: ${mandate.name}`,
    });

    // Capture PayPal Sandbox Order
    const payPalCapture = await payPalClient.captureOrder(payPalOrder.id);

    // 5. Update mandate spentAmount and persist Decision & PayPalTransaction atomically
    const result = await prisma.$transaction(async (tx) => {
      // Deduct budget
      const updatedMandate = await tx.mandate.update({
        where: { id: mandate.id },
        data: {
          spentAmount: { increment: cart.totalAmount },
        },
      });

      // Save Allowed Decision with real PayPal Order ID
      const savedDecision = await tx.decision.create({
        data: {
          mandateId: mandate.id,
          cartId: cart.id,
          amount: decision.amount,
          merchant: decision.merchant,
          category: decision.category,
          status: "ALLOWED",
          reason: decision.reason,
          checks: JSON.stringify(decision.checks),
          paypalOrderId: payPalOrder.id,
        },
      });

      // Record PayPal Transaction
      const transaction = await tx.payPalTransaction.create({
        data: {
          orderId: payPalOrder.id,
          captureId: payPalCapture.id,
          mandateId: mandate.id,
          decisionId: savedDecision.id,
          amount: cart.totalAmount,
          currency: "USD",
          status: payPalCapture.status,
          rawResponse: JSON.stringify(payPalCapture.rawResponse || {}),
        },
      });

      return { updatedMandate, savedDecision, transaction };
    });

    return NextResponse.json({
      status: "COMPLETED",
      decisionId: result.savedDecision.id,
      paypalCalled: true,
      paypalOrderId: payPalOrder.id,
      paypalCaptureId: payPalCapture.id,
      amount: cart.totalAmount,
      spentAmount: result.updatedMandate.spentAmount,
      remainingBudget: result.updatedMandate.weeklyLimit - result.updatedMandate.spentAmount,
      checks: decision.checks,
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Internal Payment Error";
    return NextResponse.json(
      {
        error: "PAYMENT_EXECUTION_FAILED",
        message,
        paypalCalled: false,
      },
      { status: 500 }
    );
  }
}

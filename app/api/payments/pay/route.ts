import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db/prisma";
import { evaluateMandate } from "@/lib/policy/engine";
import { payPalClient } from "@/lib/paypal/client";

export const dynamic = "force-dynamic";

const paySchema = z.object({
  mandateId: z.string().min(1, "mandateId is required"),
  cartId: z.string().min(1, "cartId is required"),
  idempotencyKey: z.string().optional(),
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
    const headerKey = req.headers.get("Idempotency-Key");
    const idempotencyKey = parsed.data.idempotencyKey || headerKey || null;

    // 1. Idempotency Check: Return existing completed response if replayed
    if (idempotencyKey) {
      const existingRecord = await prisma.idempotencyRecord.findUnique({
        where: { key: idempotencyKey },
      });

      if (existingRecord && existingRecord.status === "COMPLETED") {
        const cachedJson = JSON.parse(existingRecord.responseBody);
        return NextResponse.json({
          ...cachedJson,
          idempotentReplay: true,
        });
      }
    }

    // 2. Authoritative lookup of Mandate and Cart
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

    // 3. Pre-flight Deterministic Policy Engine Evaluation
    const decision = evaluateMandate(mandate, cart);

    // 4. IF POLICY FAILS: Stop immediately, NEVER call PayPal
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
            paypalOrderId: null, // Zero-call invariant
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

    // 5. CONCURRENCY-SAFE ATOMIC BUDGET RESERVATION
    // Execute interactive transaction to inspect real-time spentAmount and reserve budget atomically
    let reservationSuccess = false;
    let freshRemaining = 0;

    await prisma.$transaction(async (tx) => {
      const freshMandate = await tx.mandate.findUniqueOrThrow({
        where: { id: mandate.id },
      });

      freshRemaining = freshMandate.weeklyLimit - freshMandate.spentAmount;

      if (cart.totalAmount <= freshRemaining && freshMandate.status === "ACTIVE") {
        await tx.mandate.update({
          where: { id: mandate.id },
          data: {
            spentAmount: { increment: cart.totalAmount },
          },
        });
        reservationSuccess = true;
      }
    });

    // If reservation failed, another concurrent transaction consumed the budget
    if (!reservationSuccess) {
      const deniedDecision = await prisma.decision.create({
        data: {
          mandateId: mandate.id,
          cartId: cart.id,
          amount: decision.amount,
          merchant: decision.merchant,
          category: decision.category,
          status: "DENIED",
          reason: `Concurrent transaction conflict: Purchase exceeds remaining mandate budget of $${(
            freshRemaining / 100
          ).toFixed(2)}.`,
          checks: JSON.stringify({
            ...decision.checks,
            BUDGET_SUFFICIENT: {
              passed: false,
              message: "Budget consumed by competing concurrent transaction.",
            },
          }),
          paypalOrderId: null,
        },
      });

      return NextResponse.json(
        {
          status: "DENIED",
          reason: "Purchase exceeds remaining mandate budget.",
          failedCheck: "BUDGET_SUFFICIENT",
          amount: decision.amount,
          merchant: decision.merchant,
          category: decision.category,
          paypalCalled: false,
          paypalOrderId: null,
          decisionId: deniedDecision.id,
          remainingBudget: freshRemaining,
        },
        { status: 403 }
      );
    }

    // 6. POLICY & BUDGET SECURED: Execute PayPal Create & Capture
    let payPalOrder;
    let payPalCapture;

    try {
      payPalOrder = await payPalClient.createOrder({
        amountInCents: cart.totalAmount,
        currency: "USD",
        referenceId: cart.id,
        description: `Allopal mandate payment: ${mandate.name}`,
      });

      payPalCapture = await payPalClient.captureOrder(payPalOrder.id);
    } catch (payPalError) {
      // Rollback reserved budget on PayPal execution failure to fail closed safely
      await prisma.mandate.update({
        where: { id: mandate.id },
        data: {
          spentAmount: { decrement: cart.totalAmount },
        },
      });
      throw payPalError;
    }

    // 7. Persist Allowed Decision and PayPal Transaction Record
    const { savedDecision, refreshedMandate } = await prisma.$transaction(async (tx) => {
      const dec = await tx.decision.create({
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

      await tx.payPalTransaction.create({
        data: {
          orderId: payPalOrder.id,
          captureId: payPalCapture.id,
          mandateId: mandate.id,
          decisionId: dec.id,
          amount: cart.totalAmount,
          currency: "USD",
          status: payPalCapture.status,
          rawResponse: JSON.stringify(payPalCapture.rawResponse || {}),
        },
      });

      const updated = await tx.mandate.findUniqueOrThrow({
        where: { id: mandate.id },
      });

      return { savedDecision: dec, refreshedMandate: updated };
    });

    const responsePayload = {
      status: "COMPLETED",
      decisionId: savedDecision.id,
      paypalCalled: true,
      paypalOrderId: payPalOrder.id,
      paypalCaptureId: payPalCapture.id,
      amount: cart.totalAmount,
      spentAmount: refreshedMandate.spentAmount,
      remainingBudget: refreshedMandate.weeklyLimit - refreshedMandate.spentAmount,
      checks: decision.checks,
    };

    // 8. Save Idempotency Record if key was provided
    if (idempotencyKey) {
      await prisma.idempotencyRecord.upsert({
        where: { key: idempotencyKey },
        create: {
          key: idempotencyKey,
          mandateId: mandate.id,
          cartId: cart.id,
          status: "COMPLETED",
          responseBody: JSON.stringify(responsePayload),
        },
        update: {
          status: "COMPLETED",
          responseBody: JSON.stringify(responsePayload),
        },
      });
    }

    return NextResponse.json(responsePayload);
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

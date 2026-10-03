import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db/prisma";
import { evaluateMandate } from "@/lib/policy/engine";
import { payPalClient } from "@/lib/paypal/client";

export const dynamic = "force-dynamic";

const paySchema = z.object({
  mandateId: z.string().min(1, "mandateId is required"),
  cartId: z.string().min(1, "cartId is required"),
  idempotencyKey: z.string().min(8).max(200).optional(),
});

function responseFromPayload(payload: Record<string, unknown>, status = 200) {
  return NextResponse.json(payload, { status });
}

export async function POST(req: NextRequest) {
  let idempotencyKey: string | null = null;
  let reservationActive = false;
  let reservedMandateId: string | null = null;
  let reservedAmount = 0;
  let paypalCalled = false;
  let paypalOrderId: string | null = null;

  try {
    const rawBody = await req.json();
    const parsed = paySchema.safeParse(rawBody);

    if (!parsed.success) {
      return responseFromPayload(
        {
          error: "INVALID_REQUEST",
          details: parsed.error.issues,
        },
        400
      );
    }

    const { mandateId, cartId } = parsed.data;
    const headerKey = req.headers.get("Idempotency-Key");
    idempotencyKey = parsed.data.idempotencyKey || headerKey || null;
    const operationId = idempotencyKey || crypto.randomUUID();

    // Atomically claim the idempotency key before any external side effect.
    if (idempotencyKey) {
      try {
        await prisma.idempotencyRecord.create({
          data: {
            key: idempotencyKey,
            mandateId,
            cartId,
            status: "PROCESSING",
            responseBody: "{}",
          },
        });
      } catch {
        const existing = await prisma.idempotencyRecord.findUnique({
          where: { key: idempotencyKey },
        });

        if (!existing) throw new Error("IDEMPOTENCY_CLAIM_FAILED");

        if (existing.mandateId !== mandateId || existing.cartId !== cartId) {
          return responseFromPayload(
            {
              error: "IDEMPOTENCY_KEY_REUSED",
              message: "Idempotency key is already bound to a different payment request.",
            },
            409
          );
        }

        if (existing.status === "COMPLETED") {
          return responseFromPayload(
            {
              ...JSON.parse(existing.responseBody),
              idempotentReplay: true,
            },
            200
          );
        }

        if (existing.status === "PROCESSING") {
          return responseFromPayload(
            {
              error: "PAYMENT_IN_PROGRESS",
              message: "An identical payment request is already being processed.",
            },
            409
          );
        }

        // FAILED keys are intentionally not reused. The client should generate a fresh key.
        return responseFromPayload(
          {
            error: "IDEMPOTENCY_KEY_EXPIRED",
            message: "This payment attempt failed. Retry with a new idempotency key.",
          },
          409
        );
      }
    }

    // Authoritative server-side lookup. Client-supplied amount/category/merchant are ignored.
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

    const decision = evaluateMandate(mandate, cart);

    // Policy denial is terminal and has zero PayPal calls.
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
            paypalOrderId: null,
          },
        });
      }

      const deniedPayload = {
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
      };

      if (idempotencyKey) {
        await prisma.idempotencyRecord.update({
          where: { key: idempotencyKey },
          data: {
            status: "COMPLETED",
            responseBody: JSON.stringify(deniedPayload),
          },
        });
      }

      return responseFromPayload(deniedPayload, 403);
    }

    // Re-check the authoritative state inside a database transaction so a concurrent
    // request cannot spend the same remaining budget twice.
    let freshRemaining = 0;
    let reservationDecision = decision;

    await prisma.$transaction(async (tx) => {
      const freshMandate = await tx.mandate.findUniqueOrThrow({
        where: { id: mandate.id },
      });

      reservationDecision = evaluateMandate(freshMandate, cart);
      freshRemaining = freshMandate.weeklyLimit - freshMandate.spentAmount;

      if (reservationDecision.status !== "ALLOWED") return;

      await tx.mandate.update({
        where: { id: freshMandate.id },
        data: {
          spentAmount: { increment: cart.totalAmount },
        },
      });

      reservationActive = true;
      reservedMandateId = freshMandate.id;
      reservedAmount = cart.totalAmount;
    });

    if (!reservationActive) {
      const deniedDecision = await prisma.decision.create({
        data: {
          mandateId: mandate.id,
          cartId: cart.id,
          amount: reservationDecision.amount,
          merchant: reservationDecision.merchant,
          category: reservationDecision.category,
          status: "DENIED",
          reason: reservationDecision.reason,
          checks: JSON.stringify(reservationDecision.checks),
          paypalOrderId: null,
        },
      });

      const deniedPayload = {
        status: "DENIED",
        reason: reservationDecision.reason,
        failedCheck: reservationDecision.failedCheck,
        amount: reservationDecision.amount,
        merchant: reservationDecision.merchant,
        category: reservationDecision.category,
        paypalCalled: false,
        paypalOrderId: null,
        decisionId: deniedDecision.id,
        remainingBudget: freshRemaining,
      };

      if (idempotencyKey) {
        await prisma.idempotencyRecord.update({
          where: { key: idempotencyKey },
          data: {
            status: "COMPLETED",
            responseBody: JSON.stringify(deniedPayload),
          },
        });
      }

      return responseFromPayload(deniedPayload, 403);
    }

    const origin = new URL(req.url).origin;
    const returnUrl = `${origin}/api/payments/paypal/return`;
    const cancelUrl = `${origin}/api/payments/paypal/cancel`;

    // PayPal's own idempotency key is distinct for create/capture operations.
    const createRequestId = `${operationId}-create`;
    const captureRequestId = `${operationId}-capture`;

    let payPalOrder;
    try {
      payPalOrder = await payPalClient.createOrder({
        amountInCents: cart.totalAmount,
        currency: "USD",
        referenceId: cart.id,
        description: `Allopal mandate payment: ${mandate.name}`,
        requestId: createRequestId,
        returnUrl,
        cancelUrl,
      });
      paypalCalled = true;
      paypalOrderId = payPalOrder.id;
    } catch (payPalError) {
      if (reservationActive && reservedMandateId) {
        await prisma.mandate.update({
          where: { id: reservedMandateId },
          data: { spentAmount: { decrement: reservedAmount } },
        });
        reservationActive = false;
      }
      throw payPalError;
    }

    // Live PayPal Checkout requires payer approval before capture.
    if (payPalOrder.requiresPayerApproval) {
      if (!payPalOrder.approvalUrl) {
        throw new Error("PAYPAL_APPROVAL_URL_MISSING");
      }

      const pendingResult = await prisma.$transaction(async (tx) => {
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

        await tx.payPalTransaction.create({
          data: {
            orderId: payPalOrder.id,
            captureId: null,
            mandateId: mandate.id,
            decisionId: savedDecision.id,
            amount: cart.totalAmount,
            currency: "USD",
            status: "CREATED",
            rawResponse: JSON.stringify({
              id: payPalOrder.id,
              status: payPalOrder.status,
              approvalUrl: payPalOrder.approvalUrl,
            }),
          },
        });

        return savedDecision;
      });

      reservationActive = false;

      const pendingPayload = {
        status: "PENDING_APPROVAL",
        decisionId: pendingResult.id,
        paypalCalled: true,
        paypalOrderId: payPalOrder.id,
        paypalCaptureId: null,
        approvalUrl: payPalOrder.approvalUrl,
        amount: cart.totalAmount,
        remainingBudget: decision.remainingBudgetAfter,
        checks: decision.checks,
      };

      if (idempotencyKey) {
        await prisma.idempotencyRecord.update({
          where: { key: idempotencyKey },
          data: {
            status: "COMPLETED",
            responseBody: JSON.stringify(pendingPayload),
          },
        });
      }

      return responseFromPayload(pendingPayload, 200);
    }

    // Deterministic/mock mode can execute the complete create -> capture flow.
    const payPalCapture = await payPalClient.captureOrder(payPalOrder.id, captureRequestId);

    if (payPalCapture.status !== "COMPLETED") {
      if (reservationActive && reservedMandateId) {
        await prisma.mandate.update({
          where: { id: reservedMandateId },
          data: { spentAmount: { decrement: reservedAmount } },
        });
        reservationActive = false;
      }
      throw new Error(`PAYPAL_CAPTURE_NOT_COMPLETED: ${payPalCapture.status}`);
    }

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
          status: "COMPLETED",
          rawResponse: JSON.stringify(payPalCapture.rawResponse || {}),
        },
      });

      const updated = await tx.mandate.findUniqueOrThrow({
        where: { id: mandate.id },
      });

      return { savedDecision: dec, refreshedMandate: updated };
    });

    reservationActive = false;

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

    if (idempotencyKey) {
      await prisma.idempotencyRecord.update({
        where: { key: idempotencyKey },
        data: {
          status: "COMPLETED",
          responseBody: JSON.stringify(responsePayload),
        },
      });
    }

    return responseFromPayload(responsePayload, 200);
  } catch (error: unknown) {
    if (reservationActive && reservedMandateId) {
      try {
        await prisma.mandate.update({
          where: { id: reservedMandateId },
          data: { spentAmount: { decrement: reservedAmount } },
        });
      } catch {
        // Do not replace the original payment error with rollback noise.
      }
    }

    if (idempotencyKey) {
      try {
        const message = error instanceof Error ? error.message : "Internal Payment Error";
        await prisma.idempotencyRecord.update({
          where: { key: idempotencyKey },
          data: {
            status: "FAILED",
            responseBody: JSON.stringify({
              error: "PAYMENT_EXECUTION_FAILED",
              message,
            }),
          },
        });
      } catch {
        // Idempotency persistence must never mask the original error.
      }
    }

    const message = error instanceof Error ? error.message : "Internal Payment Error";
    return responseFromPayload(
      {
        error: "PAYMENT_EXECUTION_FAILED",
        message,
        paypalCalled,
        paypalOrderId,
      },
      500
    );
  }
}

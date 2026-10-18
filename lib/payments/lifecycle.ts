import { requirePayPalConfig } from "@/lib/env";
import { createHash } from "node:crypto";
import type { PayPalTransaction, Prisma } from "@prisma/client";
import { prisma } from "@/lib/db/prisma";
import { evaluateMandate } from "@/lib/policy/engine";
import { PayPalApiError, payPalClient } from "@/lib/paypal/client";

const LEASE_MS = 60_000;
const APPROVAL_MS = 30 * 60_000;
const REPLAY_WINDOW_MS = 6 * 60 * 60_000;
export const terminalStates = [
  "COMPLETED",
  "FAILED",
  "CANCELLED",
  "REFUNDED",
  "REVERSED",
];
type Db = Prisma.TransactionClient;
const safeError = (error: unknown) =>
  error instanceof PayPalApiError
    ? `PAYPAL_${error.statusCode}`
    : "PROVIDER_RESULT_UNKNOWN";
const active = (mandate: {
  status: string;
  validFrom: Date;
  validUntil: Date;
}) =>
  mandate.status === "ACTIVE" &&
  mandate.validFrom <= new Date() &&
  mandate.validUntil >= new Date();

// All terminal transitions and their budget effects commit together, once.
async function release(
  db: Db,
  attempt: PayPalTransaction,
  from: string[],
  status: string,
  errorCode?: string,
) {
  const changed = await db.payPalTransaction.updateMany({
    where: { id: attempt.id, status: { in: from }, reservationReleased: false },
    data: { status, reservationReleased: true, errorCode, leaseUntil: null },
  });
  if (changed.count)
    await db.mandate.update({
      where: { id: attempt.mandateId },
      data: { spentAmount: { decrement: attempt.amount } },
    });
  return changed.count;
}

export async function paymentPayload(id: string) {
  const attempt = await prisma.payPalTransaction.findUniqueOrThrow({
    where: { id },
    include: { mandate: true, decision: true },
  });
  return {
    status:
      attempt.status === "CREATED"
        ? "PENDING_APPROVAL"
        : terminalStates.includes(attempt.status)
          ? attempt.status
          : "PENDING",
    paymentStatus: attempt.status,
    attemptId: attempt.id,
    decisionId: attempt.decisionId,
    paypalCalled: attempt.providerCalled,
    paypalOrderId: attempt.orderId,
    paypalCaptureId: attempt.captureId,
    approvalUrl: attempt.status === "CREATED" ? attempt.approvalUrl : null,
    approvalToken: attempt.status === "CREATED" ? attempt.returnToken : null,
    amount: attempt.amount,
    merchant: attempt.decision.merchant,
    category: attempt.decision.category,
    checks: JSON.parse(attempt.decision.checks),
    spentAmount: attempt.mandate.spentAmount,
    remainingBudget: attempt.mandate.weeklyLimit - attempt.mandate.spentAmount,
    reason: attempt.errorCode || attempt.decision.reason,
  };
}

export async function beginPayment(
  workspaceId: string,
  mandateId: string,
  cartId: string,
  key: string,
  origin: string,
  taskHash?: string,
) {
  const scopedKey = createHash("sha256")
    .update(`${workspaceId}:${key}`)
    .digest("hex");
  const existing = await prisma.idempotencyRecord.findUnique({
    where: { key: scopedKey },
  });
  if (existing) return replay(existing, mandateId, cartId, taskHash);
  let result: {
    attemptId?: string;
    body?: Record<string, unknown>;
    httpStatus: number;
  };
  try {
    result = await prisma.$transaction(
      async (db) => {
        await db.idempotencyRecord.create({
          data: {
            key: scopedKey,
            workspaceId,
            mandateId,
            cartId,
            status: "PROCESSING",
            responseBody: "{}",
            taskHash,
          },
        });
        const mandate = await db.mandate.findFirst({
          where: { id: mandateId, workspaceId },
        });
        const cart = await db.cart.findUnique({
          where: { id: cartId },
          include: { items: { include: { product: true } } },
        });
        const decision = evaluateMandate(mandate, cart);
        let allowed = decision.status === "ALLOWED" && !!mandate && !!cart;
        if (allowed && mandate && cart) {
          requirePayPalConfig();
          // A conditional write is the budget/revocation linearization point.
          const reserved = await db.mandate.updateMany({
            where: {
              id: mandate.id,
              workspaceId,
              status: "ACTIVE",
              validFrom: { lte: new Date() },
              validUntil: { gte: new Date() },
              spentAmount: { lte: mandate.weeklyLimit - cart.totalAmount },
            },
            data: { spentAmount: { increment: cart.totalAmount } },
          });
          allowed = reserved.count === 1;
        }
        const saved =
          mandate && cart
            ? await db.decision.create({
                data: {
                  mandateId,
                  cartId,
                  amount: decision.amount,
                  merchant: decision.merchant,
                  category: decision.category,
                  status: allowed ? "ALLOWED" : "DENIED",
                  reason:
                    allowed || decision.status === "DENIED"
                      ? decision.reason
                      : "Mandate or budget changed during authorization.",
                  checks: JSON.stringify(decision.checks),
                },
              })
            : null;
        if (!allowed || !mandate || !cart || !saved) {
          const body = {
            ...decision,
            status: "DENIED",
            reason: saved?.reason || decision.reason,
            decisionId: saved?.id || null,
            paypalCalled: false,
            paypalOrderId: null,
            remainingBudget: decision.remainingBudgetBefore,
          };
          await db.idempotencyRecord.update({
            where: { key: scopedKey },
            data: {
              status: "COMPLETED",
              httpStatus: 403,
              responseBody: JSON.stringify(body),
            },
          });
          return { body, httpStatus: 403 };
        }
        const attempt = await db.payPalTransaction.create({
          data: {
            mandateId,
            decisionId: saved.id,
            amount: cart.totalAmount,
            status: "CREATING",
            origin,
            leaseUntil: new Date(Date.now() + LEASE_MS),
            expiresAt: new Date(Date.now() + APPROVAL_MS),
          },
        });
        await db.idempotencyRecord.update({
          where: { key: scopedKey },
          data: { transactionId: attempt.id },
        });
        return { attemptId: attempt.id, httpStatus: 200 };
      },
      { timeout: 10_000 },
    );
  } catch (error) {
    const claimed = await prisma.idempotencyRecord.findUnique({
      where: { key: scopedKey },
    });
    if (claimed) return replay(claimed, mandateId, cartId, taskHash);
    throw error;
  }
  if (!result.attemptId)
    return { body: result.body!, httpStatus: result.httpStatus };
  await createProviderOrder(result.attemptId);
  const body = await paymentPayload(result.attemptId);
  await prisma.idempotencyRecord.update({
    where: { key: scopedKey },
    data: { status: "COMPLETED", responseBody: JSON.stringify(body) },
  });
  return { body, httpStatus: 200 };
}

async function replay(
  record: {
    mandateId: string;
    cartId: string;
    transactionId: string | null;
    responseBody: string;
    httpStatus: number;
    taskHash: string | null;
  },
  mandateId: string,
  cartId: string,
  taskHash?: string,
) {
  if (
    record.mandateId !== mandateId ||
    record.cartId !== cartId ||
    (taskHash && record.taskHash !== taskHash)
  )
    return { body: { error: "IDEMPOTENCY_KEY_REUSED" }, httpStatus: 409 };
  if (record.transactionId) {
    const body = await paymentPayload(record.transactionId);
    return {
      body: { ...body, idempotentReplay: true },
      httpStatus: ["CREATING", "CAPTURING"].includes(body.paymentStatus)
        ? 409
        : 200,
    };
  }
  return {
    body: { ...JSON.parse(record.responseBody), idempotentReplay: true },
    httpStatus: record.httpStatus,
  };
}

async function createProviderOrder(id: string) {
  const attempt = await prisma.payPalTransaction.findUniqueOrThrow({
    where: { id },
    include: { mandate: true, decision: true },
  });
  // A retry uses exactly the original provider request ID and payload.
  try {
    await prisma.payPalTransaction.update({
      where: { id },
      data: { providerCalled: true },
    });
    const state = encodeURIComponent(attempt.returnToken);
    const order = await payPalClient.createOrder({
      amountInCents: attempt.amount,
      currency: attempt.currency,
      referenceId: attempt.decision.cartId,
      description: `Allopal mandate payment: ${attempt.mandate.name}`,
      requestId: `${id}-create`,
      returnUrl: `${attempt.origin}/api/payments/paypal/return?state=${state}`,
      cancelUrl: `${attempt.origin}/api/payments/paypal/cancel?state=${state}`,
    });
    if (
      order.requiresPayerApproval &&
      !order.approvalUrl &&
      !["APPROVED", "COMPLETED"].includes(order.status)
    )
      throw new Error("PAYPAL_APPROVAL_URL_MISSING");
    await prisma.$transaction(async (db) => {
      await db.payPalTransaction.update({
        where: { id },
        data: {
          orderId: order.id,
          approvalUrl: order.approvalUrl,
          status: "CREATED",
          leaseUntil: null,
          errorCode: null,
        },
      });
      await db.decision.update({
        where: { id: attempt.decisionId },
        data: { paypalOrderId: order.id },
      });
    });
    if (!order.requiresPayerApproval) await capturePayment(id);
    else if (["APPROVED", "COMPLETED"].includes(order.status))
      await reconcilePayment(id);
  } catch (error) {
    // A request timeout can mean an order exists upstream. Keep its reservation and replay ID.
    const terminal =
      error instanceof PayPalApiError &&
      [400, 401, 403, 422].includes(error.statusCode);
    if (terminal)
      await prisma.$transaction((db) =>
        release(db, attempt, ["CREATING"], "FAILED", safeError(error)),
      );
    else
      await prisma.payPalTransaction.updateMany({
        where: { id, status: "CREATING" },
        data: {
          status: "UNKNOWN_CREATE",
          errorCode: safeError(error),
          leaseUntil: null,
        },
      });
  }
}

export async function capturePayment(id: string, reconcileOnError = true) {
  const attempt = await prisma.$transaction(async (db) => {
    const current = await db.payPalTransaction.findUniqueOrThrow({
      where: { id },
      include: { mandate: true },
    });
    if (
      current.status !== "CREATED" ||
      !current.orderId ||
      (current.leaseUntil && current.leaseUntil > new Date())
    )
      return null;
    if (!active(current.mandate) || current.cancelRequested) {
      if (current.captureStarted)
        await db.payPalTransaction.update({
          where: { id },
          data: {
            status: "REVIEW_REQUIRED",
            leaseUntil: null,
            errorCode: "MANDATE_CHANGED_AFTER_CAPTURE_STARTED",
          },
        });
      else
        await release(
          db,
          current,
          ["CREATED"],
          "CANCELLED",
          "MANDATE_NO_LONGER_ACTIVE",
        );
      return null;
    }
    const claimed = await db.payPalTransaction.updateMany({
      where: { id, status: "CREATED" },
      data: {
        status: "CAPTURING",
        leaseUntil: new Date(Date.now() + LEASE_MS),
        captureStarted: true,
      },
    });
    return claimed.count ? current : null;
  });
  if (!attempt?.orderId) return;
  try {
    const capture = await payPalClient.captureOrder(
      attempt.orderId,
      `${id}-capture`,
    );
    if (
      capture.status === "COMPLETED" &&
      ((capture.amountInCents !== undefined &&
        capture.amountInCents !== attempt.amount) ||
        (capture.currency !== undefined &&
          capture.currency !== attempt.currency))
    ) {
      await prisma.payPalTransaction.update({
        where: { id },
        data: {
          status: "REVIEW_REQUIRED",
          leaseUntil: null,
          errorCode: "PROVIDER_AMOUNT_MISMATCH",
        },
      });
    } else if (capture.status === "COMPLETED") {
      await prisma.payPalTransaction.updateMany({
        where: { id, status: "CAPTURING" },
        data: {
          status: "COMPLETED",
          captureId: capture.id,
          leaseUntil: null,
          errorCode: null,
          rawResponse: JSON.stringify({
            orderId: attempt.orderId,
            captureId: capture.id,
            status: capture.status,
          }),
        },
      });
    } else if (["DENIED", "DECLINED", "FAILED"].includes(capture.status)) {
      await prisma.$transaction((db) =>
        release(db, attempt, ["CAPTURING"], "FAILED", "CAPTURE_DECLINED"),
      );
    } else {
      await prisma.payPalTransaction.updateMany({
        where: { id, status: "CAPTURING" },
        data: { status: "UNKNOWN_CAPTURE", leaseUntil: null },
      });
    }
  } catch (error) {
    // HTTP 422 includes already-captured and retryable errors. It is not a refund instruction.
    await prisma.payPalTransaction.updateMany({
      where: { id, status: "CAPTURING" },
      data: {
        status: "UNKNOWN_CAPTURE",
        leaseUntil: null,
        errorCode: safeError(error),
      },
    });
    if (reconcileOnError) await reconcilePayment(id);
  }
}

export async function cancelPayment(id: string) {
  await prisma.payPalTransaction.updateMany({
    where: { id, status: "CREATED" },
    data: { cancelRequested: true },
  });
  const claimed = await prisma.payPalTransaction.updateMany({
    where: {
      id,
      status: "CREATED",
      OR: [{ leaseUntil: null }, { leaseUntil: { lte: new Date() } }],
    },
    data: { status: "CANCELLING", leaseUntil: new Date(Date.now() + LEASE_MS) },
  });
  if (claimed.count) await reconcilePayment(id, true);
}

export async function reconcilePayment(
  id: string,
  ownsLease = false,
  force = false,
) {
  const now = new Date();
  const current = await prisma.payPalTransaction.findUnique({ where: { id } });
  if (
    !current ||
    (!force && terminalStates.includes(current.status)) ||
    current.status === "REVIEW_REQUIRED"
  )
    return;
  if (!ownsLease) {
    const claimed = await prisma.payPalTransaction.updateMany({
      where: {
        id,
        status: current.status,
        OR: [{ leaseUntil: null }, { leaseUntil: { lte: now } }],
      },
      data: { leaseUntil: new Date(Date.now() + LEASE_MS) },
    });
    if (!claimed.count) return;
  }
  try {
    if (!current.orderId) {
      if (Date.now() - current.createdAt.getTime() > REPLAY_WINDOW_MS) {
        await prisma.payPalTransaction.update({
          where: { id },
          data: {
            status: "REVIEW_REQUIRED",
            errorCode: "CREATE_REPLAY_WINDOW_EXPIRED",
            leaseUntil: null,
          },
        });
        return;
      }
      await prisma.payPalTransaction.update({
        where: { id },
        data: { status: "CREATING" },
      });
      await createProviderOrder(id);
      return;
    }
    const order = await payPalClient.getOrder(current.orderId);
    if (order.captureStatus === "COMPLETED") {
      if (
        !order.captureId ||
        order.amountInCents !== current.amount ||
        order.currency !== current.currency
      ) {
        await prisma.payPalTransaction.update({
          where: { id },
          data: {
            status: "REVIEW_REQUIRED",
            errorCode: "PROVIDER_AMOUNT_MISMATCH",
            leaseUntil: null,
          },
        });
        return;
      }
      // A late confirmed capture is still money spent, even if an earlier local release occurred.
      await prisma.$transaction(async (db) => {
        const restored = await db.payPalTransaction.updateMany({
          where: { id, reservationReleased: true },
          data: { reservationReleased: false },
        });
        if (restored.count)
          await db.mandate.update({
            where: { id: current.mandateId },
            data: { spentAmount: { increment: current.amount } },
          });
        await db.payPalTransaction.update({
          where: { id },
          data: {
            status: "COMPLETED",
            captureId: order.captureId,
            errorCode: null,
            leaseUntil: null,
          },
        });
      });
      return;
    }
    if (["REFUNDED", "REVERSED"].includes(order.captureStatus || "")) {
      await prisma.payPalTransaction.update({
        where: { id },
        data: { status: order.captureStatus!, leaseUntil: null },
      });
      return;
    }
    if (
      ["DENIED", "DECLINED", "FAILED"].includes(order.captureStatus || "") ||
      order.status === "VOIDED"
    ) {
      await prisma.$transaction((db) =>
        release(
          db,
          current,
          [current.status],
          "FAILED",
          "PROVIDER_CONFIRMED_FAILURE",
        ),
      );
      return;
    }
    // A pending or uncertain capture must keep its reservation, even if the checkout expired.
    if (
      current.captureStarted &&
      !order.captureStatus &&
      order.status === "APPROVED" &&
      Date.now() - current.createdAt.getTime() < REPLAY_WINDOW_MS
    ) {
      const mandate = await prisma.mandate.findUniqueOrThrow({
        where: { id: current.mandateId },
      });
      if (active(mandate)) {
        await prisma.payPalTransaction.update({
          where: { id },
          data: { status: "CREATED", leaseUntil: null },
        });
        await capturePayment(id, false);
        return;
      }
    }
    if (order.captureStatus || current.captureStarted) {
      await prisma.payPalTransaction.update({
        where: { id },
        data: { status: "UNKNOWN_CAPTURE", leaseUntil: null },
      });
      return;
    }
    if (
      current.status === "CANCELLING" ||
      current.cancelRequested ||
      current.expiresAt < now
    ) {
      await prisma.$transaction((db) =>
        release(
          db,
          current,
          [current.status],
          "CANCELLED",
          "CHECKOUT_CANCELLED_OR_EXPIRED",
        ),
      );
      return;
    }
    await prisma.payPalTransaction.update({
      where: { id },
      data: { status: "CREATED", leaseUntil: null },
    });
    // Authenticated provider approval recovers a buyer who closed the browser before returning.
    if (order.status === "APPROVED") {
      await prisma.payPalTransaction.update({
        where: { id },
        data: { payerApproved: true },
      });
      await capturePayment(id, false);
    }
  } catch {
    await prisma.payPalTransaction.updateMany({
      where: { id, status: { notIn: terminalStates } },
      data: { leaseUntil: null, errorCode: "RECONCILIATION_UNAVAILABLE" },
    });
  }
}

export async function reconcileBatch(workspaceId?: string) {
  const attempts = await prisma.payPalTransaction.findMany({
    where: {
      status: { notIn: [...terminalStates, "REVIEW_REQUIRED"] },
      ...(workspaceId ? { mandate: { workspaceId } } : {}),
      OR: [{ leaseUntil: null }, { leaseUntil: { lte: new Date() } }],
    },
    take: 10,
    orderBy: { updatedAt: "asc" },
  });
  for (const attempt of attempts) await reconcilePayment(attempt.id);
  return attempts.length;
}

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db/prisma";
import { payPalClient } from "@/lib/paypal/client";

export const dynamic = "force-dynamic";

function redirect(req: NextRequest, status: string, orderId?: string) {
  const url = new URL("/", req.url);
  url.searchParams.set("payment", status);
  if (orderId) url.searchParams.set("order", orderId);
  return NextResponse.redirect(url);
}

export async function GET(req: NextRequest) {
  const orderId = new URL(req.url).searchParams.get("token");
  if (!orderId) {
    return NextResponse.json(
      { error: "MISSING_ORDER_TOKEN", message: "PayPal did not return an order token." },
      { status: 400 }
    );
  }

  const transaction = await prisma.payPalTransaction.findUnique({
    where: { orderId },
    include: { mandate: true, decision: true },
  });

  if (!transaction) {
    return NextResponse.json(
      { error: "PAYMENT_NOT_FOUND", message: "The PayPal order is not registered with Allopal." },
      { status: 404 }
    );
  }

  if (transaction.status === "COMPLETED") return redirect(req, "completed", orderId);
  if (transaction.status === "FAILED") return redirect(req, "cancelled", orderId);

  try {
    // A pending order must still belong to a currently active mandate when the payer returns.
    // This prevents revocation or expiry during the approval window from crossing the execution boundary.
    const currentMandate = await prisma.mandate.findUnique({
      where: { id: transaction.mandateId },
    });

    const now = Date.now();
    const withinWindow =
      currentMandate &&
      currentMandate.status === "ACTIVE" &&
      now >= new Date(currentMandate.validFrom).getTime() &&
      now <= new Date(currentMandate.validUntil).getTime();

    if (!withinWindow) {
      const released = await prisma.$transaction(async (tx) => {
        const failed = await tx.payPalTransaction.updateMany({
          where: { orderId, status: "CREATED" },
          data: {
            status: "FAILED",
            rawResponse: JSON.stringify({
              error: "MANDATE_NO_LONGER_ACTIVE",
              reason: currentMandate?.status || "MANDATE_NOT_FOUND",
            }),
          },
        });

        if (failed.count === 1 && currentMandate) {
          await tx.mandate.update({
            where: { id: currentMandate.id },
            data: { spentAmount: { decrement: transaction.amount } },
          });
        }

        return failed.count;
      });

      return redirect(req, released === 1 ? "cancelled" : "pending", orderId);
    }

    const capture = await payPalClient.captureOrder(orderId, `capture-${orderId}`);

    if (capture.status === "COMPLETED") {
      const claimed = await prisma.$transaction(async (tx) => {
        const updated = await tx.payPalTransaction.updateMany({
          where: { orderId, status: "CREATED" },
          data: {
            status: "COMPLETED",
            captureId: capture.id,
            rawResponse: JSON.stringify(capture.rawResponse || {}),
          },
        });

        return updated.count;
      });

      if (claimed === 1 || transaction.status === "COMPLETED") {
        return redirect(req, "completed", orderId);
      }
    }

    if (["DECLINED", "FAILED"].includes(capture.status)) {
      await prisma.$transaction(async (tx) => {
        const failed = await tx.payPalTransaction.updateMany({
          where: { orderId, status: "CREATED" },
          data: {
            status: "FAILED",
            rawResponse: JSON.stringify(capture.rawResponse || {}),
          },
        });

        if (failed.count === 1) {
          await tx.mandate.update({
            where: { id: transaction.mandateId },
            data: { spentAmount: { decrement: transaction.amount } },
          });
        }
      });

      return redirect(req, "failed", orderId);
    }

    // Unknown/pending provider state: keep the reservation and require reconciliation.
    return redirect(req, "pending", orderId);
  } catch {
    // An unknown network result must never release the reserved budget blindly.
    // The PayPal-Request-Id makes a later retry of this capture idempotent.
    return redirect(req, "pending", orderId);
  }
}

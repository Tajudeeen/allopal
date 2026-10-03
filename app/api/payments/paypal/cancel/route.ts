import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db/prisma";

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
    return redirect(req, "cancelled");
  }

  const transaction = await prisma.payPalTransaction.findUnique({
    where: { orderId },
  });

  if (!transaction) return redirect(req, "cancelled", orderId);
  if (transaction.status === "COMPLETED") return redirect(req, "completed", orderId);
  if (transaction.status === "FAILED") return redirect(req, "cancelled", orderId);

  await prisma.$transaction(async (tx) => {
    const cancelled = await tx.payPalTransaction.updateMany({
      where: { orderId, status: "CREATED" },
      data: { status: "FAILED" },
    });

    if (cancelled.count === 1) {
      await tx.mandate.update({
        where: { id: transaction.mandateId },
        data: { spentAmount: { decrement: transaction.amount } },
      });
    }
  });

  return redirect(req, "cancelled", orderId);
}

import { prisma } from "@/lib/db/prisma";
import { NextRequest } from "next/server";
import { capturePayment } from "@/lib/payments/lifecycle";
import { callbackAttempt, paymentRedirect } from "@/lib/payments/callback";
import { accessResponse } from "@/lib/security/access";
export const dynamic = "force-dynamic";
export async function GET(req: NextRequest) {
  try {
    const attempt = await callbackAttempt(req);
    await prisma.payPalTransaction.updateMany({
      where: { id: attempt.id, status: "CREATED" },
      data: { payerApproved: true },
    });
    await capturePayment(attempt.id);
    return paymentRedirect(req, attempt.orderId!);
  } catch (error) {
    return accessResponse(error);
  }
}

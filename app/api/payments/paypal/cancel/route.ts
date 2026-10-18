import { NextRequest } from "next/server";
import { cancelPayment } from "@/lib/payments/lifecycle";
import { callbackAttempt, paymentRedirect } from "@/lib/payments/callback";
import { accessResponse } from "@/lib/security/access";
export const dynamic = "force-dynamic";
export async function GET(req: NextRequest) {
  try {
    const attempt = await callbackAttempt(req);
    await cancelPayment(attempt.id);
    return paymentRedirect(req, attempt.orderId!);
  } catch (error) {
    return accessResponse(error);
  }
}

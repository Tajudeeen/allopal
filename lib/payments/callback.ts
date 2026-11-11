import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db/prisma";
import { sameSecret, AccessError } from "@/lib/security/access";

/**
 * PayPal redirects are external top-level navigations and can arrive after the
 * Allopal demo session expires. The per-payment returnToken is the callback
 * credential, so callback handling must validate it without requiring the
 * browser's workspace cookie. Keep the lookup scoped to the PayPal order and
 * compare the state token in constant time.
 */
export async function callbackAttempt(req: NextRequest) {
  const url = new URL(req.url);
  const token = url.searchParams.get("token");
  const state = url.searchParams.get("state");
  if (!token) throw new AccessError(400, "MISSING_ORDER_TOKEN");
  if (!state) throw new AccessError(403, "PAYMENT_STATE_INVALID");

  const attempt = await prisma.payPalTransaction.findFirst({
    where: { orderId: token },
  });
  if (!attempt) throw new AccessError(404, "PAYMENT_NOT_FOUND");
  if (!sameSecret(state, attempt.returnToken))
    throw new AccessError(403, "PAYMENT_STATE_INVALID");
  return attempt;
}

export function paymentRedirect(req: NextRequest, orderId: string) {
  const url = new URL("/console", req.url);
  url.searchParams.set("order", orderId);
  return NextResponse.redirect(url);
}

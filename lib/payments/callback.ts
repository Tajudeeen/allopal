import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db/prisma";
import {
  requireWorkspace,
  sameSecret,
  AccessError,
} from "@/lib/security/access";
export async function callbackAttempt(req: NextRequest) {
  const workspaceId = await requireWorkspace(req);
  const url = new URL(req.url);
  const token = url.searchParams.get("token");
  if (!token) throw new AccessError(400, "MISSING_ORDER_TOKEN");
  const attempt = await prisma.payPalTransaction.findFirst({
    where: { orderId: token, mandate: { workspaceId } },
  });
  if (!attempt) throw new AccessError(404, "PAYMENT_NOT_FOUND");
  if (!sameSecret(url.searchParams.get("state") || "", attempt.returnToken))
    throw new AccessError(403, "PAYMENT_STATE_INVALID");
  return attempt;
}
export function paymentRedirect(req: NextRequest, orderId: string) {
  const url = new URL("/console", req.url);
  url.searchParams.set("order", orderId);
  return NextResponse.redirect(url);
}

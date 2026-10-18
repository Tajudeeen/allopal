import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db/prisma";
import { paymentPayload } from "@/lib/payments/lifecycle";
import {
  requireWorkspace,
  AccessError,
  accessResponse,
} from "@/lib/security/access";
export const dynamic = "force-dynamic";
export async function GET(req: NextRequest) {
  try {
    const workspaceId = await requireWorkspace(req);
    const orderId = new URL(req.url).searchParams.get("order");
    if (!orderId) throw new AccessError(400, "ORDER_REQUIRED");
    const attempt = await prisma.payPalTransaction.findFirst({
      where: { orderId, mandate: { workspaceId } },
    });
    if (!attempt) throw new AccessError(404, "PAYMENT_NOT_FOUND");
    return NextResponse.json(await paymentPayload(attempt.id), {
      headers: { "Cache-Control": "private, no-store" },
    });
  } catch (error) {
    return accessResponse(error);
  }
}

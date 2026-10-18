import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db/prisma";
import { payPalClient } from "@/lib/paypal/client";
import { reconcilePayment } from "@/lib/payments/lifecycle";
export const dynamic = "force-dynamic";
const schema = z
  .object({
    id: z.string().min(1),
    event_type: z.string(),
    resource: z
      .object({
        id: z.string().optional(),
        supplementary_data: z
          .object({
            related_ids: z
              .object({ order_id: z.string().optional() })
              .optional(),
          })
          .optional(),
      })
      .passthrough(),
  })
  .passthrough();
export async function POST(req: NextRequest) {
  try {
    if (!process.env.PAYPAL_WEBHOOK_ID)
      return NextResponse.json(
        { error: "WEBHOOK_NOT_CONFIGURED" },
        { status: 503 },
      );
    const text = await req.text();
    if (Buffer.byteLength(text) > 64_000)
      return NextResponse.json({ error: "PAYLOAD_TOO_LARGE" }, { status: 413 });
    let event: unknown;
    try {
      event = JSON.parse(text);
    } catch {
      return NextResponse.json({ error: "INVALID_JSON" }, { status: 400 });
    }
    const input = schema.safeParse(event);
    if (!input.success)
      return NextResponse.json({ error: "INVALID_EVENT" }, { status: 400 });
    if (!(await payPalClient.verifyWebhook(req.headers, event)))
      return NextResponse.json({ error: "INVALID_SIGNATURE" }, { status: 401 });
    if (
      await prisma.webhookReceipt.findUnique({
        where: { eventId: input.data.id },
      })
    )
      return NextResponse.json({ received: true, duplicate: true });
    const orderId =
      input.data.resource.supplementary_data?.related_ids?.order_id ||
      (input.data.event_type.startsWith("CHECKOUT.ORDER.")
        ? input.data.resource.id
        : undefined);
    if (orderId) {
      const attempt = await prisma.payPalTransaction.findUnique({
        where: { orderId },
      });
      // Never trust the event body to settle money. Re-read the authenticated provider order.
      if (attempt) {
        await reconcilePayment(attempt.id, false, true);
        const updated = await prisma.payPalTransaction.findUniqueOrThrow({
          where: { id: attempt.id },
        });
        if (
          updated.errorCode === "RECONCILIATION_UNAVAILABLE" ||
          (updated.leaseUntil && updated.leaseUntil > new Date())
        )
          return NextResponse.json({ error: "RETRY_EVENT" }, { status: 503 });
      }
    }
    await prisma.webhookReceipt.upsert({
      where: { eventId: input.data.id },
      create: { eventId: input.data.id },
      update: {},
    });
    return NextResponse.json({ received: true });
  } catch {
    return NextResponse.json(
      { error: "WEBHOOK_RETRY_REQUIRED" },
      { status: 503 },
    );
  }
}

import { NextRequest, NextResponse } from "next/server";
import { z } from "zod/v3";
import { beginPayment } from "@/lib/payments/lifecycle";
import {
  requireWorkspace,
  paymentOrigin,
  accessResponse,
} from "@/lib/security/access";
import { checkRateLimit, RATE_LIMITS } from "@/lib/ratelimit";
export const dynamic = "force-dynamic";
const schema = z.object({
  mandateId: z.string().min(1),
  cartId: z.string().min(1),
  idempotencyKey: z.string().min(8).max(200).optional(),
});
export async function POST(req: NextRequest) {
  try {
    const workspace = await requireWorkspace(req);
    const rl = checkRateLimit(`pay:${workspace}`, RATE_LIMITS.PAYMENT);
    if (!rl.allowed) {
      return NextResponse.json(
        { error: "RATE_LIMIT_EXCEEDED", message: "Too many payment requests. Please wait." },
        { status: 429, headers: { "Retry-After": String(Math.ceil((rl.resetAt - Date.now()) / 1000)) } },
      );
    }
    let body: unknown;
    try {
      body = await req.json();
    } catch {
      return NextResponse.json({ error: "INVALID_JSON" }, { status: 400 });
    }
    const input = schema.safeParse(body);
    if (!input.success)
      return NextResponse.json(
        { error: "INVALID_REQUEST", details: input.error.issues },
        { status: 400 },
      );
    const key = input.data.idempotencyKey || req.headers.get("Idempotency-Key");
    if (!key)
      return NextResponse.json(
        { error: "IDEMPOTENCY_KEY_REQUIRED" },
        { status: 400 },
      );
    if (!z.string().min(8).max(200).safeParse(key).success)
      return NextResponse.json(
        { error: "INVALID_IDEMPOTENCY_KEY" },
        { status: 400 },
      );
    const result = await beginPayment(
      workspace,
      input.data.mandateId,
      input.data.cartId,
      key,
      paymentOrigin(req),
    );
    return NextResponse.json(result.body, { status: result.httpStatus });
  } catch (error) {
    return accessResponse(error);
  }
}

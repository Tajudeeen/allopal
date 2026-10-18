import { createHash } from "node:crypto";
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db/prisma";
import { selectCartForAgent } from "@/lib/ai/agent";
import { evaluateMandate } from "@/lib/policy/engine";
import { beginPayment } from "@/lib/payments/lifecycle";
import {
  requireWorkspace,
  paymentOrigin,
  accessResponse,
} from "@/lib/security/access";
export const dynamic = "force-dynamic";
const schema = z.object({
  task: z.string().trim().min(3).max(500),
  mode: z.enum(["DRY_RUN", "EXECUTE"]).default("DRY_RUN"),
  idempotencyKey: z.string().min(8).max(200).optional(),
});
export async function POST(req: NextRequest) {
  try {
    const workspaceId = await requireWorkspace(req);
    let body: unknown;
    try {
      body = await req.json();
    } catch {
      return NextResponse.json({ error: "INVALID_JSON" }, { status: 400 });
    }
    const parsed = schema.safeParse(body);
    if (!parsed.success)
      return NextResponse.json(
        { error: "INVALID_AGENT_REQUEST", details: parsed.error.issues },
        { status: 400 },
      );
    const { task, mode } = parsed.data;
    const key =
      parsed.data.idempotencyKey || req.headers.get("Idempotency-Key");
    if (mode === "EXECUTE" && !key)
      return NextResponse.json(
        { error: "IDEMPOTENCY_KEY_REQUIRED" },
        { status: 400 },
      );
    if (key && !z.string().min(8).max(200).safeParse(key).success)
      return NextResponse.json(
        { error: "INVALID_IDEMPOTENCY_KEY" },
        { status: 400 },
      );
    const taskHash = createHash("sha256").update(task).digest("hex");
    const prior = key
      ? await prisma.idempotencyRecord.findUnique({
          where: {
            key: createHash("sha256")
              .update(`${workspaceId}:${key}`)
              .digest("hex"),
          },
        })
      : null;
    if (prior && prior.taskHash !== taskHash)
      return NextResponse.json(
        { error: "IDEMPOTENCY_KEY_REUSED" },
        { status: 409 },
      );
    const mandate = prior
      ? await prisma.mandate.findFirst({
          where: { id: prior.mandateId, workspaceId },
        })
      : await prisma.mandate.findFirst({
          where: { workspaceId },
          orderBy: { createdAt: "desc" },
        });
    if (!mandate)
      return NextResponse.json({ error: "MANDATE_NOT_FOUND" }, { status: 404 });
    const carts = await prisma.cart.findMany({
      orderBy: { createdAt: "asc" },
      include: { items: { include: { product: true } } },
    });
    const catalog = carts.map((cart) => ({
      cartId: cart.id,
      productName: cart.items
        .map((item) => `${item.quantity} × ${item.product.name}`)
        .join(", "),
      amount: cart.totalAmount,
      merchant: cart.merchant,
      category: cart.items[0]?.product.category || "Unknown",
    }));
    const selection = prior
      ? {
          cartId: prior.cartId,
          reason: "Resuming the original agent purchase.",
        }
      : await selectCartForAgent(task, catalog);
    const cart = carts.find((cart) => cart.id === selection.cartId);
    if (!cart)
      return NextResponse.json(
        { error: "AGENT_CART_NOT_FOUND" },
        { status: 422 },
      );
    let result: Record<string, unknown>;
    let status = 200;
    if (mode === "EXECUTE") {
      const executed = await beginPayment(
        workspaceId,
        mandate.id,
        cart.id,
        key!,
        paymentOrigin(req),
        taskHash,
      );
      result = executed.body;
      status = executed.httpStatus;
    } else {
      const decision = evaluateMandate(mandate, cart);
      await prisma.decision.create({
        data: {
          mandateId: mandate.id,
          cartId: cart.id,
          amount: decision.amount,
          merchant: decision.merchant,
          category: decision.category,
          status: decision.status,
          reason: decision.reason,
          checks: JSON.stringify(decision.checks),
        },
      });
      result = { ...decision };
    }
    return NextResponse.json(
      {
        agent: {
          task,
          selectedCartId: cart.id,
          productName: catalog.find((item) => item.cartId === cart.id)
            ?.productName,
          amount: cart.totalAmount,
          merchant: cart.merchant,
          category: cart.items[0]?.product.category,
          reasoning: selection.reason,
        },
        authority: {
          mandateId: mandate.id,
          mandateName: mandate.name,
          mode,
          finalDecision: result.status,
          paypalCalled: Boolean(result.paypalCalled),
          policyRemainsAuthoritative: true,
        },
        result,
      },
      { status },
    );
  } catch (error) {
    return accessResponse(error);
  }
}

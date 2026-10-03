import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db/prisma";
import { selectCartForAgent } from "@/lib/ai/agent";
import { POST as authorizePOST } from "@/app/api/authorize/route";
import { POST as paymentPOST } from "@/app/api/payments/pay/route";

export const dynamic = "force-dynamic";

const agentSchema = z.object({
  task: z.string().min(3, "Agent task must be at least 3 characters").max(500),
  mode: z.enum(["DRY_RUN", "EXECUTE"]).default("DRY_RUN"),
  idempotencyKey: z.string().min(8).max(200).optional(),
});

export async function POST(req: NextRequest) {
  try {
    const rawBody = await req.json();
    const parsed = agentSchema.safeParse(rawBody);

    if (!parsed.success) {
      return NextResponse.json(
        { error: "INVALID_AGENT_REQUEST", details: parsed.error.issues },
        { status: 400 }
      );
    }

    const latestMandate = await prisma.mandate.findFirst({
      orderBy: { createdAt: "desc" },
    });

    if (!latestMandate) {
      return NextResponse.json(
        { error: "MANDATE_NOT_FOUND", message: "No spending mandate exists for the agent to use." },
        { status: 404 }
      );
    }

    const carts = await prisma.cart.findMany({
      orderBy: { createdAt: "asc" },
      include: {
        items: {
          include: {
            product: true,
          },
        },
      },
    });

    const catalog = carts.map((cart) => ({
      cartId: cart.id,
      productName:
        cart.items.map((item) => `${item.quantity} × ${item.product.name}`).join(", ") ||
        "Unknown product",
      amount: cart.totalAmount,
      merchant: cart.merchant,
      category: cart.items[0]?.product.category || "Unknown",
    }));

    const selection = await selectCartForAgent(parsed.data.task, catalog);
    const selectedCart = carts.find((cart) => cart.id === selection.cartId);

    if (!selectedCart) {
      return NextResponse.json(
        { error: "AGENT_CART_NOT_FOUND", message: "The selected cart is not present in the authoritative catalog." },
        { status: 422 }
      );
    }

    const internalBody = {
      mandateId: latestMandate.id,
      cartId: selectedCart.id,
    };

    let resultResponse: Response;

    if (parsed.data.mode === "EXECUTE") {
      const executeRequest = new NextRequest(req.url, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(parsed.data.idempotencyKey
            ? { "Idempotency-Key": parsed.data.idempotencyKey }
            : {}),
        },
        body: JSON.stringify({
          ...internalBody,
          ...(parsed.data.idempotencyKey
            ? { idempotencyKey: parsed.data.idempotencyKey }
            : {}),
        }),
      });

      resultResponse = await paymentPOST(executeRequest);
    } else {
      const authorizeRequest = new NextRequest(req.url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(internalBody),
      });

      resultResponse = await authorizePOST(authorizeRequest);
    }

    const result = await resultResponse.json();

    return NextResponse.json(
      {
        agent: {
          task: parsed.data.task,
          selectedCartId: selectedCart.id,
          productName:
            selectedCart.items.map((item) => `${item.quantity} × ${item.product.name}`).join(", ") ||
            "Unknown product",
          amount: selectedCart.totalAmount,
          merchant: selectedCart.merchant,
          category: selectedCart.items[0]?.product.category || "Unknown",
          reasoning: selection.reason,
        },
        authority: {
          mandateId: latestMandate.id,
          mandateName: latestMandate.name,
          mode: parsed.data.mode,
          finalDecision: result.status,
          paypalCalled: Boolean(result.paypalCalled),
          policyRemainsAuthoritative: true,
        },
        result,
      },
      { status: resultResponse.status }
    );
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Agent execution failed.";
    return NextResponse.json(
      { error: "AGENT_EXECUTION_FAILED", message },
      { status: 500 }
    );
  }
}

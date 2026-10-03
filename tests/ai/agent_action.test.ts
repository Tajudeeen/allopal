import { beforeAll, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
import { POST } from "@/app/api/agent/act/route";
import { prisma } from "@/lib/db/prisma";
import { seed } from "@/prisma/seed";
import { payPalClient } from "@/lib/paypal/client";
import { selectCartForAgent } from "@/lib/ai/agent";

function createRequest(body: unknown): NextRequest {
  return new NextRequest("http://localhost:3000/api/agent/act", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

describe("Allopal guarded AI agent action", () => {
  beforeAll(async () => {
    await seed();
  });

  it("selects a real catalog cart without inventing an item", async () => {
    const carts = await prisma.cart.findMany({
      include: { items: { include: { product: true } } },
    });

    const selection = await selectCartForAgent(
      "buy me a gaming headset",
      carts.map((cart) => ({
        cartId: cart.id,
        productName: cart.items[0]?.product.name || "Unknown",
        amount: cart.totalAmount,
        merchant: cart.merchant,
        category: cart.items[0]?.product.category || "Unknown",
      }))
    );

    expect(selection.cartId).toBe("cart-case-b");
  });

  it("runs the selected cart through the deterministic policy boundary", async () => {
    const createSpy = vi.spyOn(payPalClient, "createOrder");
    const captureSpy = vi.spyOn(payPalClient, "captureOrder");

    const response = await POST(
      createRequest({
        task: "find the gaming headset and try to buy it",
        mode: "EXECUTE",
        idempotencyKey: "agent-test-key-001",
      })
    );

    const data = await response.json();

    expect(response.status).toBe(403);
    expect(data.agent.selectedCartId).toBe("cart-case-b");
    expect(data.result.status).toBe("DENIED");
    expect(data.result.paypalCalled).toBe(false);
    expect(createSpy).toHaveBeenCalledTimes(0);
    expect(captureSpy).toHaveBeenCalledTimes(0);

    createSpy.mockRestore();
    captureSpy.mockRestore();
  });

  it("can select and dry-run a permitted purchase without calling PayPal", async () => {
    const createSpy = vi.spyOn(payPalClient, "createOrder");
    const captureSpy = vi.spyOn(payPalClient, "captureOrder");

    const response = await POST(
      createRequest({
        task: "buy school supplies under $20",
        mode: "DRY_RUN",
      })
    );

    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.agent.selectedCartId).toBe("cart-case-a");
    expect(data.result.status).toBe("ALLOWED");
    expect(data.result.paypalCalled).toBeUndefined();
    expect(data.authority.finalDecision).toBe("ALLOWED");
    expect(data.authority.policyRemainsAuthoritative).toBe(true);
    expect(createSpy).toHaveBeenCalledTimes(0);
    expect(captureSpy).toHaveBeenCalledTimes(0);

    createSpy.mockRestore();
    captureSpy.mockRestore();

    await prisma.decision.deleteMany({ where: { cartId: "cart-case-a" } });
  });
});

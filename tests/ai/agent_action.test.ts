import {
  beforeAll,
  beforeEach,
  afterEach,
  describe,
  expect,
  it,
  vi,
} from "vitest";
import { NextRequest } from "next/server";
import { POST } from "@/app/api/agent/act/route";
import { prisma } from "@/lib/db/prisma";
import { seed } from "@/prisma/seed";
import { payPalClient } from "@/lib/paypal/client";
import { selectCartForAgent, selectCartDeterministically } from "@/lib/ai/agent";

function createRequest(body: unknown): NextRequest {
  return new NextRequest("http://localhost:3000/api/agent/act", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

describe("Allopal guarded AI agent action", () => {
  beforeEach(() => {
    vi.spyOn(globalThis, "fetch").mockImplementation(async (_input, init) => {
      const payload = JSON.parse(String(init?.body ?? "{}"));
      const body =
        payload.contents?.[0]?.parts?.[0]?.text?.split(
          "Server-authoritative catalog:",
        )[0] ?? "";
      const isGaming = body.toLowerCase().includes("gaming headset");
      const selection = {
        cartId: isGaming ? "cart-case-b" : "cart-case-a",
        reason:
          "Selected a server-authoritative catalog cart that best matches the request.",
      };
      return new Response(
        JSON.stringify({
          candidates: [
            { content: { parts: [{ text: JSON.stringify(selection) }] } },
          ],
        }),
        { status: 200 },
      );
    });
  });

  afterEach(() => vi.restoreAllMocks());
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
      })),
    );

    expect(selection.cartId).toBe("cart-case-b");
  });

  it("uses a bounded catalog fallback when Gemini is unavailable", () => {
    const catalog = [
      {
        cartId: "cart-case-a",
        productName: "Notebook Bundle",
        amount: 1800,
        merchant: "Campus Books",
        category: "School Supplies",
      },
      {
        cartId: "cart-case-b",
        productName: "Gaming Headset",
        amount: 9000,
        merchant: "Campus Books",
        category: "Electronics",
      },
    ];

    const selection = selectCartDeterministically(
      "find school supplies under $20",
      catalog,
      "Gemini unavailable (HTTP 400)",
    );

    expect(selection.cartId).toBe("cart-case-a");
    expect(selection.reason).toContain("Gemini unavailable");
    expect(() =>
      selectCartDeterministically("find me something unusual", catalog),
    ).toThrow("AGENT_NO_CATALOG_MATCH");
  });

  it("runs the selected cart through the deterministic policy boundary", async () => {
    const createSpy = vi.spyOn(payPalClient, "createOrder").mockResolvedValue({
      id: "PAYPAL-CONTRACT-ORDER",
      status: "CREATED",
      links: [],
      requiresPayerApproval: false,
    });
    const captureSpy = vi
      .spyOn(payPalClient, "captureOrder")
      .mockResolvedValue({
        id: "PAYPAL-CONTRACT-CAPTURE",
        status: "COMPLETED",
        orderId: "PAYPAL-CONTRACT-ORDER",
        rawResponse: { status: "COMPLETED" },
      });

    const response = await POST(
      createRequest({
        task: "find the gaming headset and try to buy it",
        mode: "EXECUTE",
        idempotencyKey: "agent-test-key-001",
      }),
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

  it("executes a permitted agent-selected purchase through PayPal", async () => {
    const createSpy = vi
      .spyOn(payPalClient, "createOrder")
      .mockResolvedValue({
        id: "PAYPAL-CONTRACT-ORDER",
        status: "CREATED",
        requiresPayerApproval: false,
      });
    const captureSpy = vi
      .spyOn(payPalClient, "captureOrder")
      .mockResolvedValue({
        id: "PAYPAL-CONTRACT-CAPTURE",
        status: "COMPLETED",
      });

    const response = await POST(
      createRequest({
        task: "buy a notebook for me",
        mode: "EXECUTE",
        idempotencyKey: "agent-test-key-002",
      }),
    );

    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.agent.selectedCartId).toBe("cart-case-a");
    expect(data.result.status).toBe("COMPLETED");
    expect(data.result.paypalCalled).toBe(true);
    expect(data.result.paypalOrderId).toBe("PAYPAL-CONTRACT-ORDER");
    expect(data.result.paypalCaptureId).toBe("PAYPAL-CONTRACT-CAPTURE");
    expect(createSpy).toHaveBeenCalledTimes(1);
    expect(captureSpy).toHaveBeenCalledTimes(1);

    createSpy.mockRestore();
    captureSpy.mockRestore();

    await prisma.payPalTransaction.deleteMany({
      where: { mandateId: "mandate-school-shopping" },
    });
    await prisma.decision.deleteMany({
      where: { mandateId: "mandate-school-shopping" },
    });
    await prisma.mandate.update({
      where: { id: "mandate-school-shopping" },
      data: { spentAmount: 0, status: "ACTIVE" },
    });
  });

  it("can select and dry-run a permitted purchase without calling PayPal", async () => {
    const createSpy = vi.spyOn(payPalClient, "createOrder");
    const captureSpy = vi.spyOn(payPalClient, "captureOrder");

    const response = await POST(
      createRequest({
        task: "buy school supplies under $20",
        mode: "DRY_RUN",
      }),
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

    await prisma.decision.deleteMany({
      where: { cartId: "cart-case-a", mandateId: "mandate-school-shopping" },
    });
  });
});

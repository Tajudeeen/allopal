import { describe, it, expect, beforeAll, vi } from "vitest";
import { POST } from "@/app/api/payments/pay/route";
import { NextRequest } from "next/server";
import { prisma } from "@/lib/db/prisma";
import { seed } from "@/prisma/seed";
import { payPalClient } from "@/lib/paypal/client";

function createPayRequest(body: unknown, idempotencyKey?: string): NextRequest {
  const headers: Record<string, string> = { "Content-Type": "application/json" };
  if (idempotencyKey) {
    headers["Idempotency-Key"] = idempotencyKey;
  }
  return new NextRequest("http://localhost:3000/api/payments/pay", {
    method: "POST",
    headers,
    body: JSON.stringify(body),
  });
}

describe("Step 7: Concurrency Safety & Idempotency Invariants", () => {
  beforeAll(async () => {
    await seed();
  });

  it("Specification Concurrency Test: Remaining = $40, Request A = $25, Request B = $25 -> System NEVER captures $50", async () => {
    const createSpy = vi.spyOn(payPalClient, "createOrder");
    const captureSpy = vi.spyOn(payPalClient, "captureOrder");

    // Mandate is fresh with $40.00 limit and $0.00 spent.
    // Both Request A and Request B fire simultaneously trying to buy $25.00 Cart C.
    const reqA = createPayRequest({
      mandateId: "mandate-school-shopping",
      cartId: "cart-case-c", // $25.00
    });
    const reqB = createPayRequest({
      mandateId: "mandate-school-shopping",
      cartId: "cart-case-c", // $25.00
    });

    const [resA, resB] = await Promise.all([POST(reqA), POST(reqB)]);

    const dataA = await resA.json();
    const dataB = await resB.json();

    const statuses = [resA.status, resB.status];
    const outcomes = [dataA.status, dataB.status];

    // EXACTLY ONE must succeed (200 / COMPLETED), and EXACTLY ONE must fail (403 / DENIED)
    expect(statuses).toContain(200);
    expect(statuses).toContain(403);
    expect(outcomes).toContain("COMPLETED");
    expect(outcomes).toContain("DENIED");

    // Verify PayPal was called EXACTLY ONCE (never twice!)
    expect(createSpy).toHaveBeenCalledTimes(1);
    expect(captureSpy).toHaveBeenCalledTimes(1);

    // Verify database spentAmount is exactly 2500 cents ($25.00), NEVER 5000 cents ($50.00)
    const mandate = await prisma.mandate.findUnique({
      where: { id: "mandate-school-shopping" },
    });
    expect(mandate?.spentAmount).toBe(2500);

    createSpy.mockRestore();
    captureSpy.mockRestore();
  });

  it("Idempotency Test: Repeated button clicks or replayed requests with the same key do NOT double-capture", async () => {
    const createSpy = vi.spyOn(payPalClient, "createOrder");
    const captureSpy = vi.spyOn(payPalClient, "captureOrder");

    // Reset mandate to have enough balance
    await prisma.mandate.update({
      where: { id: "mandate-school-shopping" },
      data: { spentAmount: 0 },
    });

    const idempotencyKey = "client-req-key-12345";
    const payload = {
      mandateId: "mandate-school-shopping",
      cartId: "cart-case-a", // $18.00
    };

    // First request
    const firstReq = createPayRequest(payload, idempotencyKey);
    const firstRes = await POST(firstReq);
    const firstData = await firstRes.json();

    expect(firstRes.status).toBe(200);
    expect(firstData.status).toBe("COMPLETED");
    expect(firstData.amount).toBe(1800);
    expect(createSpy).toHaveBeenCalledTimes(1);
    expect(captureSpy).toHaveBeenCalledTimes(1);

    // Second request: exact duplicate / replay with identical idempotency key
    const replayReq = createPayRequest(payload, idempotencyKey);
    const replayRes = await POST(replayReq);
    const replayData = await replayRes.json();

    expect(replayRes.status).toBe(200);
    expect(replayData.status).toBe("COMPLETED");
    expect(replayData.idempotentReplay).toBe(true);
    expect(replayData.paypalOrderId).toBe(firstData.paypalOrderId);

    // PayPal was NOT called a second time
    expect(createSpy).toHaveBeenCalledTimes(1);
    expect(captureSpy).toHaveBeenCalledTimes(1);

    // Mandate spent amount remained 1800, NOT 3600
    const mandate = await prisma.mandate.findUnique({
      where: { id: "mandate-school-shopping" },
    });
    expect(mandate?.spentAmount).toBe(1800);

    createSpy.mockRestore();
    captureSpy.mockRestore();
  });
});

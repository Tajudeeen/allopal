import { describe, it, expect, beforeAll, vi } from "vitest";
import { POST } from "@/app/api/payments/pay/route";
import { NextRequest } from "next/server";
import { prisma } from "@/lib/db/prisma";
import { seed } from "@/prisma/seed";
import { payPalClient } from "@/lib/paypal/client";

function createPayRequest(body: unknown): NextRequest {
  return new NextRequest("http://localhost:3000/api/payments/pay", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Idempotency-Key": crypto.randomUUID(),
    },
    body: JSON.stringify(body),
  });
}

describe("Step 6: Dedicated PayPal Authorization Security Boundary Proof", () => {
  beforeAll(async () => {
    await seed();
  });

  it("Boundary Proof 1: Wrong category -> PayPal calls = 0", async () => {
    const createSpy = vi.spyOn(payPalClient, "createOrder");
    const captureSpy = vi.spyOn(payPalClient, "captureOrder");

    const req = createPayRequest({
      mandateId: "mandate-school-shopping",
      cartId: "cart-case-b", // $90 Gaming Headset (Electronics)
    });

    const res = await POST(req);
    expect(res.status).toBe(403);

    // ZERO calls to PayPal
    expect(createSpy).toHaveBeenCalledTimes(0);
    expect(captureSpy).toHaveBeenCalledTimes(0);

    createSpy.mockRestore();
    captureSpy.mockRestore();
  });

  it("Boundary Proof 2: Over budget -> PayPal calls = 0", async () => {
    const createSpy = vi.spyOn(payPalClient, "createOrder");
    const captureSpy = vi.spyOn(payPalClient, "captureOrder");

    // Spend initial budget so remaining is $22.00
    await prisma.mandate.update({
      where: { id: "mandate-school-shopping" },
      data: { spentAmount: 1800 },
    });

    const req = createPayRequest({
      mandateId: "mandate-school-shopping",
      cartId: "cart-case-c", // $25.00 purchase with only $22.00 remaining
    });

    const res = await POST(req);
    expect(res.status).toBe(403);

    // ZERO calls to PayPal
    expect(createSpy).toHaveBeenCalledTimes(0);
    expect(captureSpy).toHaveBeenCalledTimes(0);

    createSpy.mockRestore();
    captureSpy.mockRestore();
  });

  it("Boundary Proof 3: Revoked mandate -> PayPal calls = 0", async () => {
    const createSpy = vi.spyOn(payPalClient, "createOrder");
    const captureSpy = vi.spyOn(payPalClient, "captureOrder");

    await prisma.mandate.update({
      where: { id: "mandate-school-shopping" },
      data: { status: "REVOKED" },
    });

    const req = createPayRequest({
      mandateId: "mandate-school-shopping",
      cartId: "cart-case-d", // $8.00 notebook
    });

    const res = await POST(req);
    expect(res.status).toBe(403);

    // ZERO calls to PayPal
    expect(createSpy).toHaveBeenCalledTimes(0);
    expect(captureSpy).toHaveBeenCalledTimes(0);

    createSpy.mockRestore();
    captureSpy.mockRestore();
  });

  it("Boundary Proof 4: Expired mandate -> PayPal calls = 0", async () => {
    const createSpy = vi.spyOn(payPalClient, "createOrder");
    const captureSpy = vi.spyOn(payPalClient, "captureOrder");

    // Re-activate mandate but set validUntil in the past
    await prisma.mandate.update({
      where: { id: "mandate-school-shopping" },
      data: {
        status: "ACTIVE",
        spentAmount: 0,
        validUntil: new Date(Date.now() - 1000 * 60), // 1 minute in the past
      },
    });

    const req = createPayRequest({
      mandateId: "mandate-school-shopping",
      cartId: "cart-case-a",
    });

    const res = await POST(req);
    expect(res.status).toBe(403);

    // ZERO calls to PayPal
    expect(createSpy).toHaveBeenCalledTimes(0);
    expect(captureSpy).toHaveBeenCalledTimes(0);

    createSpy.mockRestore();
    captureSpy.mockRestore();
  });

  it("Boundary Proof 5: Valid purchase -> PayPal calls = 1 (Create + Capture)", async () => {
    const createSpy = vi
      .spyOn(payPalClient, "createOrder")
      .mockResolvedValue({
        id: "PAYPAL-BOUNDARY-ORDER",
        status: "CREATED",
        requiresPayerApproval: false,
      });
    const captureSpy = vi
      .spyOn(payPalClient, "captureOrder")
      .mockResolvedValue({
        id: "PAYPAL-BOUNDARY-CAPTURE",
        status: "COMPLETED",
      });

    // Restore valid active mandate window
    await prisma.mandate.update({
      where: { id: "mandate-school-shopping" },
      data: {
        status: "ACTIVE",
        spentAmount: 0,
        validUntil: new Date(Date.now() + 1000 * 60 * 60 * 24 * 7),
      },
    });

    const req = createPayRequest({
      mandateId: "mandate-school-shopping",
      cartId: "cart-case-a", // $18.00 notebook bundle
    });

    const res = await POST(req);
    expect(res.status).toBe(200);

    // EXACTLY 1 call each
    expect(createSpy).toHaveBeenCalledTimes(1);
    expect(captureSpy).toHaveBeenCalledTimes(1);

    createSpy.mockRestore();
    captureSpy.mockRestore();
  });
});

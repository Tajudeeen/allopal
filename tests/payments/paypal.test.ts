import { describe, it, expect, beforeAll, vi } from "vitest";
import { POST } from "@/app/api/payments/pay/route";
import { NextRequest } from "next/server";
import { prisma } from "@/lib/db/prisma";
import { seed } from "@/prisma/seed";
import { PayPalClient, payPalClient } from "@/lib/paypal/client";
import { centsToPayPalAmount, payPalAmountToCents } from "@/lib/paypal/money";

function createPayRequest(body: unknown): NextRequest {
  return new NextRequest("http://localhost:3000/api/payments/pay", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

describe("Step 5 & 6: PayPal Sandbox Integration & Authorization Boundary", () => {
  beforeAll(async () => {
    await seed();
  });

  it("verifies exact money conversion helpers", () => {
    expect(centsToPayPalAmount(1800)).toBe("18.00");
    expect(centsToPayPalAmount(4000)).toBe("40.00");
    expect(centsToPayPalAmount(2201)).toBe("22.01");
    expect(centsToPayPalAmount(0)).toBe("0.00");
    expect(() => centsToPayPalAmount(-100)).toThrow();
    expect(() => centsToPayPalAmount(18.5)).toThrow();

    expect(payPalAmountToCents("18.00")).toBe(1800);
    expect(payPalAmountToCents("22.01")).toBe(2201);
  });

  it("Case A: executes PayPal order creation & capture when mandate policy passes", async () => {
    const createOrderSpy = vi.spyOn(payPalClient, "createOrder");
    const captureOrderSpy = vi.spyOn(payPalClient, "captureOrder");

    const req = createPayRequest({
      mandateId: "mandate-school-shopping",
      cartId: "cart-case-a", // $18.00 notebook bundle
    });

    const res = await POST(req);
    const data = await res.json();

    expect(res.status).toBe(200);
    expect(data.status).toBe("COMPLETED");
    expect(data.paypalCalled).toBe(true);
    expect(data.paypalOrderId).toBeDefined();
    expect(data.paypalCaptureId).toBeDefined();
    expect(data.amount).toBe(1800);
    expect(data.spentAmount).toBe(1800);
    expect(data.remainingBudget).toBe(2200); // 4000 - 1800 = 2200 ($22.00)

    // PayPal API was called exactly once
    expect(createOrderSpy).toHaveBeenCalledTimes(1);
    expect(captureOrderSpy).toHaveBeenCalledTimes(1);

    // Verify database state: mandate spentAmount updated
    const updatedMandate = await prisma.mandate.findUnique({
      where: { id: "mandate-school-shopping" },
    });
    expect(updatedMandate?.spentAmount).toBe(1800);

    // Verify Decision in database has real PayPal order ID
    const decisionRecord = await prisma.decision.findUnique({
      where: { id: data.decisionId },
    });
    expect(decisionRecord?.status).toBe("ALLOWED");
    expect(decisionRecord?.paypalOrderId).toBe(data.paypalOrderId);

    // Verify PayPalTransaction table recorded entry
    const txRecord = await prisma.payPalTransaction.findUnique({
      where: { orderId: data.paypalOrderId },
    });
    expect(txRecord).not.toBeNull();
    expect(txRecord?.amount).toBe(1800);
    expect(txRecord?.captureId).toBe(data.paypalCaptureId);

    createOrderSpy.mockRestore();
    captureOrderSpy.mockRestore();
  });

  it("Case B: blocks unauthorized category and NEVER calls PayPal (zero calls)", async () => {
    const createOrderSpy = vi.spyOn(payPalClient, "createOrder");
    const captureOrderSpy = vi.spyOn(payPalClient, "captureOrder");

    const req = createPayRequest({
      mandateId: "mandate-school-shopping",
      cartId: "cart-case-b", // $90.00 gaming headset (Electronics)
    });

    const res = await POST(req);
    const data = await res.json();

    expect(res.status).toBe(403);
    expect(data.status).toBe("DENIED");
    expect(data.failedCheck).toBe("CATEGORY_ALLOWED");
    expect(data.paypalCalled).toBe(false);
    expect(data.paypalOrderId).toBeNull();

    // CRITICAL SECURITY INVARIANT: PayPal was NEVER called
    expect(createOrderSpy).toHaveBeenCalledTimes(0);
    expect(captureOrderSpy).toHaveBeenCalledTimes(0);

    // Decision was persisted with paypalOrderId = null
    const decisionRecord = await prisma.decision.findUnique({
      where: { id: data.decisionId },
    });
    expect(decisionRecord?.status).toBe("DENIED");
    expect(decisionRecord?.paypalOrderId).toBeNull();

    // Mandate spent amount remained untouched at 1800
    const mandate = await prisma.mandate.findUnique({
      where: { id: "mandate-school-shopping" },
    });
    expect(mandate?.spentAmount).toBe(1800);

    createOrderSpy.mockRestore();
    captureOrderSpy.mockRestore();
  });

  it("Case C: blocks purchase exceeding remaining budget and NEVER calls PayPal", async () => {
    const createOrderSpy = vi.spyOn(payPalClient, "createOrder");
    const captureOrderSpy = vi.spyOn(payPalClient, "captureOrder");

    // After Case A, spent is 1800 ($18). Remaining budget is 2200 ($22).
    // Attempting Cart C ($25.00) must fail
    const req = createPayRequest({
      mandateId: "mandate-school-shopping",
      cartId: "cart-case-c", // $25.00
    });

    const res = await POST(req);
    const data = await res.json();

    expect(res.status).toBe(403);
    expect(data.status).toBe("DENIED");
    expect(data.failedCheck).toBe("BUDGET_SUFFICIENT");
    expect(data.paypalCalled).toBe(false);
    expect(data.paypalOrderId).toBeNull();

    // INVARIANT: PayPal was NEVER called
    expect(createOrderSpy).toHaveBeenCalledTimes(0);
    expect(captureOrderSpy).toHaveBeenCalledTimes(0);

    createOrderSpy.mockRestore();
    captureOrderSpy.mockRestore();
  });

  it("Case D: blocks purchase after mandate is revoked and NEVER calls PayPal", async () => {
    const createOrderSpy = vi.spyOn(payPalClient, "createOrder");
    const captureOrderSpy = vi.spyOn(payPalClient, "captureOrder");

    // Revoke the mandate
    await prisma.mandate.update({
      where: { id: "mandate-school-shopping" },
      data: { status: "REVOKED" },
    });

    // Attempt $8 purchase (cart-case-d)
    const req = createPayRequest({
      mandateId: "mandate-school-shopping",
      cartId: "cart-case-d",
    });

    const res = await POST(req);
    const data = await res.json();

    expect(res.status).toBe(403);
    expect(data.status).toBe("DENIED");
    expect(data.failedCheck).toBe("MANDATE_NOT_REVOKED");
    expect(data.paypalCalled).toBe(false);
    expect(data.paypalOrderId).toBeNull();

    // INVARIANT: PayPal was NEVER called
    expect(createOrderSpy).toHaveBeenCalledTimes(0);
    expect(captureOrderSpy).toHaveBeenCalledTimes(0);

    createOrderSpy.mockRestore();
    captureOrderSpy.mockRestore();
  });
  it("real sandbox mode surfaces payer approval and sends PayPal request idempotency headers", async () => {
    const client = new PayPalClient(
      "real-client-id",
      "real-client-secret",
      "https://api-m.sandbox.paypal.com"
    );

    const fetchSpy = vi
      .spyOn(globalThis, "fetch")
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            access_token: "access-token",
            expires_in: 3600,
          }),
          { status: 200 }
        )
      )
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            id: "ORDER-REAL-1",
            status: "CREATED",
            links: [
              {
                href: "https://www.sandbox.paypal.com/checkoutnow?token=ORDER-REAL-1",
                rel: "approve",
                method: "GET",
              },
            ],
          }),
          { status: 201 }
        )
      );

    const order = await client.createOrder({
      amountInCents: 1800,
      referenceId: "cart-case-a",
      requestId: "allopal-create-123",
      returnUrl: "http://localhost:3000/api/payments/paypal/return",
      cancelUrl: "http://localhost:3000/api/payments/paypal/cancel",
    });

    expect(order.id).toBe("ORDER-REAL-1");
    expect(order.requiresPayerApproval).toBe(true);
    expect(order.approvalUrl).toContain("ORDER-REAL-1");

    const createHeaders = new Headers(fetchSpy.mock.calls[1][1]?.headers as HeadersInit);
    expect(createHeaders.get("Authorization")).toBe("Bearer access-token");
    expect(createHeaders.get("PayPal-Request-Id")).toBe("allopal-create-123");

    const createBody = JSON.parse(String(fetchSpy.mock.calls[1][1]?.body));
    expect(createBody.purchase_units[0].amount.value).toBe("18.00");
    expect(
      createBody.payment_source.paypal.experience_context.return_url
    ).toContain("/api/payments/paypal/return");

    fetchSpy.mockRestore();
  });

});

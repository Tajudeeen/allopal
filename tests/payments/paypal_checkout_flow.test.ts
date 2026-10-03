import { describe, it, expect, beforeEach, vi } from "vitest";
import { POST as payPOST } from "@/app/api/payments/pay/route";
import { GET as returnGET } from "@/app/api/payments/paypal/return/route";
import { GET as cancelGET } from "@/app/api/payments/paypal/cancel/route";
import { NextRequest } from "next/server";
import { prisma } from "@/lib/db/prisma";
import { seed } from "@/prisma/seed";
import { payPalClient } from "@/lib/paypal/client";

function request(url: string, method = "POST", body?: unknown): NextRequest {
  return new NextRequest(url, {
    method,
    headers: { "Content-Type": "application/json" },
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
  });
}

describe("PayPal approval lifecycle", () => {
  beforeEach(async () => {
    await seed();
  });

  it("creates a pending PayPal order, then captures it after payer approval", async () => {
    const createSpy = vi.spyOn(payPalClient, "createOrder").mockResolvedValueOnce({
      id: "PAYPAL-APPROVAL-ORDER",
      status: "CREATED",
      links: [],
      approvalUrl: "https://www.sandbox.paypal.com/checkoutnow?token=PAYPAL-APPROVAL-ORDER",
      requiresPayerApproval: true,
    });

    const captureSpy = vi.spyOn(payPalClient, "captureOrder").mockResolvedValueOnce({
      id: "PAYPAL-CAPTURE-1",
      status: "COMPLETED",
      orderId: "PAYPAL-APPROVAL-ORDER",
      rawResponse: { status: "COMPLETED", simulated: true },
    });

    const paymentRes = await payPOST(
      request("http://localhost:3000/api/payments/pay", "POST", {
        mandateId: "mandate-school-shopping",
        cartId: "cart-case-a",
      })
    );
    const paymentData = await paymentRes.json();

    expect(paymentRes.status).toBe(200);
    expect(paymentData.status).toBe("PENDING_APPROVAL");
    expect(paymentData.approvalUrl).toContain("PAYPAL-APPROVAL-ORDER");
    expect(paymentData.paypalCaptureId).toBeNull();

    const reserved = await prisma.mandate.findUnique({
      where: { id: "mandate-school-shopping" },
    });
    expect(reserved?.spentAmount).toBe(1800);

    const pendingTx = await prisma.payPalTransaction.findUnique({
      where: { orderId: "PAYPAL-APPROVAL-ORDER" },
    });
    expect(pendingTx?.status).toBe("CREATED");
    expect(pendingTx?.captureId).toBeNull();

    const returnRes = await returnGET(
      request(
        "http://localhost:3000/api/payments/paypal/return?token=PAYPAL-APPROVAL-ORDER",
        "GET"
      )
    );

    expect(returnRes.status).toBe(307);
    const location = returnRes.headers.get("location");
    expect(location).toContain("payment=completed");
    expect(location).toContain("order=PAYPAL-APPROVAL-ORDER");
    expect(captureSpy).toHaveBeenCalledTimes(1);

    const completedTx = await prisma.payPalTransaction.findUnique({
      where: { orderId: "PAYPAL-APPROVAL-ORDER" },
    });
    expect(completedTx?.status).toBe("COMPLETED");
    expect(completedTx?.captureId).toBe("PAYPAL-CAPTURE-1");

    const completedMandate = await prisma.mandate.findUnique({
      where: { id: "mandate-school-shopping" },
    });
    expect(completedMandate?.spentAmount).toBe(1800);

    createSpy.mockRestore();
    captureSpy.mockRestore();
  });

  it("releases a reserved budget when the payer cancels", async () => {
    const createSpy = vi.spyOn(payPalClient, "createOrder").mockResolvedValueOnce({
      id: "PAYPAL-CANCEL-ORDER",
      status: "CREATED",
      links: [],
      approvalUrl: "https://www.sandbox.paypal.com/checkoutnow?token=PAYPAL-CANCEL-ORDER",
      requiresPayerApproval: true,
    });

    const paymentRes = await payPOST(
      request("http://localhost:3000/api/payments/pay", "POST", {
        mandateId: "mandate-school-shopping",
        cartId: "cart-case-a",
      })
    );

    expect(paymentRes.status).toBe(200);

    const cancelRes = await cancelGET(
      request(
        "http://localhost:3000/api/payments/paypal/cancel?token=PAYPAL-CANCEL-ORDER",
        "GET"
      )
    );

    expect(cancelRes.status).toBe(307);
    expect(cancelRes.headers.get("location")).toContain("payment=cancelled");

    const cancelledTx = await prisma.payPalTransaction.findUnique({
      where: { orderId: "PAYPAL-CANCEL-ORDER" },
    });
    expect(cancelledTx?.status).toBe("FAILED");

    const restoredMandate = await prisma.mandate.findUnique({
      where: { id: "mandate-school-shopping" },
    });
    expect(restoredMandate?.spentAmount).toBe(0);

    createSpy.mockRestore();
  });
});

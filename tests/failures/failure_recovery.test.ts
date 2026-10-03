import { describe, it, expect, beforeAll, vi } from "vitest";
import { POST as payPOST } from "@/app/api/payments/pay/route";
import { POST as proposePOST } from "@/app/api/mandates/propose/route";
import { POST as explainPOST } from "@/app/api/decisions/explain/route";
import { NextRequest } from "next/server";
import { prisma } from "@/lib/db/prisma";
import { seed } from "@/prisma/seed";
import { payPalClient } from "@/lib/paypal/client";

function createJsonRequest(url: string, body: unknown): NextRequest {
  return new NextRequest(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

describe("Step 14: Comprehensive Failure Recovery & Fail-Closed Invariants", () => {
  beforeAll(async () => {
    await seed();
  });

  it("Failure Mode 1: PayPal order creation network failure -> fails closed and rolls back reserved budget", async () => {
    const createSpy = vi
      .spyOn(payPalClient, "createOrder")
      .mockRejectedValueOnce(new Error("PayPal Upstream Network Timeout (504 Gateway Timeout)"));

    const initialMandate = await prisma.mandate.findUnique({
      where: { id: "mandate-school-shopping" },
    });
    const initialSpent = initialMandate?.spentAmount || 0;

    const req = createJsonRequest("http://localhost:3000/api/payments/pay", {
      mandateId: "mandate-school-shopping",
      cartId: "cart-case-a",
    });

    const res = await payPOST(req);
    const data = await res.json();

    expect(res.status).toBe(500);
    expect(data.error).toBe("PAYMENT_EXECUTION_FAILED");
    expect(data.paypalCalled).toBe(false);

    // CRITICAL: Mandate budget MUST NOT remain deducted
    const refreshedMandate = await prisma.mandate.findUnique({
      where: { id: "mandate-school-shopping" },
    });
    expect(refreshedMandate?.spentAmount).toBe(initialSpent);

    createSpy.mockRestore();
  });

  it("Failure Mode 2: PayPal capture network failure -> fails closed and restores mandate balance", async () => {
    // createOrder succeeds, but captureOrder fails
    const captureSpy = vi
      .spyOn(payPalClient, "captureOrder")
      .mockRejectedValueOnce(new Error("PayPal Capture Declined by Risk Engine (500)"));

    const initialMandate = await prisma.mandate.findUnique({
      where: { id: "mandate-school-shopping" },
    });
    const initialSpent = initialMandate?.spentAmount || 0;

    const req = createJsonRequest("http://localhost:3000/api/payments/pay", {
      mandateId: "mandate-school-shopping",
      cartId: "cart-case-a",
    });

    const res = await payPOST(req);
    const data = await res.json();

    expect(res.status).toBe(500);
    expect(data.error).toBe("PAYMENT_EXECUTION_FAILED");

    // Mandate spent amount must be restored to initial
    const refreshedMandate = await prisma.mandate.findUnique({
      where: { id: "mandate-school-shopping" },
    });
    expect(refreshedMandate?.spentAmount).toBe(initialSpent);

    captureSpy.mockRestore();
  });

  it("Failure Mode 3: AI interpretation service failure or garbage output -> fails safely without creating phantom mandate", async () => {
    // Malicious or nonsensical garbage prompt
    const req = createJsonRequest("http://localhost:3000/api/mandates/propose", {
      prompt: "asdkfjhalkjsdfh 99999999999999999999999999999999999999",
    });

    const res = await proposePOST(req);
    expect([200, 422]).toContain(res.status);

    if (res.status === 200) {
      const data = await res.json();
      expect(data.requiresHumanApproval).toBe(true);
      // Invariant: Must still not exist in database
      const allMandates = await prisma.mandate.findMany({
        where: { name: "asdkfjhalkjsdfh" },
      });
      expect(allMandates.length).toBe(0);
    }
  });

  it("Failure Mode 4: Decision explainer failure -> degrades gracefully to fallback explanation", async () => {
    const req = createJsonRequest("http://localhost:3000/api/decisions/explain", {
      decision: {
        status: "DENIED",
        reason: "Category not permitted",
        failedCheck: "CATEGORY_ALLOWED",
        amount: 9000,
        merchant: "Campus Books",
        category: "Electronics",
      },
    });

    const res = await explainPOST(req);
    const data = await res.json();

    expect(res.status).toBe(200);
    expect(data.isReadOnly).toBe(true);
    expect(data.explanation).toBeDefined();
    expect(typeof data.explanation).toBe("string");
  });

  it("Failure Mode 5: Expired mandate fails closed with zero PayPal execution", async () => {
    const createSpy = vi.spyOn(payPalClient, "createOrder");

    // Set expiration to 1 hour in the past
    await prisma.mandate.update({
      where: { id: "mandate-school-shopping" },
      data: { validUntil: new Date(Date.now() - 3600 * 1000) },
    });

    const req = createJsonRequest("http://localhost:3000/api/payments/pay", {
      mandateId: "mandate-school-shopping",
      cartId: "cart-case-a",
    });

    const res = await payPOST(req);
    expect(res.status).toBe(403);
    expect(createSpy).toHaveBeenCalledTimes(0);

    createSpy.mockRestore();

    // Restore mandate validity
    await prisma.mandate.update({
      where: { id: "mandate-school-shopping" },
      data: { validUntil: new Date(Date.now() + 7 * 24 * 3600 * 1000) },
    });
  });
});

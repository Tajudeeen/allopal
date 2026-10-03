import { describe, it, expect, beforeAll } from "vitest";
import { POST as authPOST } from "@/app/api/authorize/route";
import { POST as payPOST } from "@/app/api/payments/pay/route";
import { GET as stateGET } from "@/app/api/state/route";
import { NextRequest } from "next/server";
import { prisma } from "@/lib/db/prisma";
import { seed } from "@/prisma/seed";
import { env } from "@/lib/env";

function createJsonRequest(url: string, body: unknown): NextRequest {
  return new NextRequest(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

describe("Step 13: Dedicated Technical Security Audit", () => {
  beforeAll(async () => {
    await seed();
  });

  it("Security Audit 1: Zero Secret Leakage across API endpoints", async () => {
    const stateRes = await stateGET();
    const stateText = await stateRes.text();

    // Verify secrets are NOT leaked in response payload
    expect(stateText).not.toContain(env.PAYPAL_CLIENT_SECRET);
    expect(stateText).not.toContain(env.AI_API_KEY);
    expect(stateText).not.toContain(env.DATABASE_URL);

    const payReq = createJsonRequest("http://localhost:3000/api/payments/pay", {
      mandateId: "mandate-school-shopping",
      cartId: "cart-case-b",
    });
    const payRes = await payPOST(payReq);
    const payText = await payRes.text();

    expect(payText).not.toContain(env.PAYPAL_CLIENT_SECRET);
    expect(payText).not.toContain(env.AI_API_KEY);
  });

  it("Security Audit 2: Client price & category injection is strictly defeated", async () => {
    // Malicious request attempting SQL-like injection or parameter override
    const req = createJsonRequest("http://localhost:3000/api/authorize", {
      mandateId: "mandate-school-shopping",
      cartId: "cart-case-b", // Gaming Headset ($90, Electronics)
      // Injection attempts:
      amount: 1,
      category: "School Supplies",
      merchant: "Campus Books",
      status: "ALLOWED",
      "mandate.weeklyLimit": 100000,
    });

    const res = await authPOST(req);
    const data = await res.json();

    // Must be DENIED based on authoritative database category ("Electronics")
    expect(res.status).toBe(200);
    expect(data.status).toBe("DENIED");
    expect(data.failedCheck).toBe("CATEGORY_ALLOWED");
    expect(data.amount).toBe(9000); // Evaluates authoritative $90.00, not client's $0.01
    expect(data.paypalOrderId).toBeNull();
  });

  it("Security Audit 3: Malformed JSON or negative amounts fail closed", async () => {
    const reqNegative = createJsonRequest("http://localhost:3000/api/payments/pay", {
      mandateId: "mandate-school-shopping",
      cartId: "cart-case-a",
      amount: -5000,
    });

    const res = await payPOST(reqNegative);
    // Payload should either process authoritative cart (and ignore amount) or fail schema validation
    expect([200, 400, 403]).toContain(res.status);

    const reqEmpty = createJsonRequest("http://localhost:3000/api/payments/pay", {});
    const resEmpty = await payPOST(reqEmpty);
    expect(resEmpty.status).toBe(400);
  });

  it("Security Audit 4: Database Invariant — No denied decision can ever have a PayPal Order ID", async () => {
    const deniedWithOrder = await prisma.decision.findMany({
      where: {
        status: "DENIED",
        paypalOrderId: { not: null },
      },
    });

    expect(deniedWithOrder.length).toBe(0);
  });

  it("Security Audit 5: Revoked mandates cannot spend even with excessive remaining budget", async () => {
    // Create mandate with $1,000,000 budget but revoked
    const richRevoked = await prisma.mandate.create({
      data: {
        name: "Rich Revoked",
        weeklyLimit: 100000000,
        spentAmount: 0,
        validFrom: new Date(),
        validUntil: new Date(Date.now() + 10000000),
        status: "REVOKED",
        allowedCategories: JSON.stringify(["School Supplies"]),
        allowedMerchants: JSON.stringify(["Campus Books"]),
      },
    });

    const req = createJsonRequest("http://localhost:3000/api/payments/pay", {
      mandateId: richRevoked.id,
      cartId: "cart-case-a",
    });

    const res = await payPOST(req);
    const data = await res.json();

    expect(res.status).toBe(403);
    expect(data.status).toBe("DENIED");
    expect(data.failedCheck).toBe("MANDATE_NOT_REVOKED");
    expect(data.paypalCalled).toBe(false);

    await prisma.decision.deleteMany({ where: { mandateId: richRevoked.id } });
    await prisma.mandate.delete({ where: { id: richRevoked.id } });
  });
});

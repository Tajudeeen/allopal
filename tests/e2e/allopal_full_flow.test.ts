import { describe, it, expect, beforeAll, vi } from "vitest";
import { POST as proposePOST } from "@/app/api/mandates/propose/route";
import { POST as lockPOST } from "@/app/api/mandates/lock/route";
import { POST as payPOST } from "@/app/api/payments/pay/route";
import { POST as revokePOST } from "@/app/api/mandates/revoke/route";
import { GET as stateGET } from "@/app/api/state/route";
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

describe("Step 12: Complete Allopal End-to-End Payment Flow Specification", () => {
  beforeAll(() => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(JSON.stringify({
        candidates: [{ content: { parts: [{ text: JSON.stringify({
          name: "School Shopping",
          weeklyLimit: 4000,
          durationDays: 7,
          allowedCategories: ["School Supplies"],
          allowedMerchants: ["Campus Books"]
        }) }] } }]
      }), { status: 200 })
    );
  });
  beforeAll(async () => {
    // Start from a clean, seeded deterministic state
    await seed();
  });

  it("Executes the complete canonical Allopal 90-second primary demo flow", async () => {
    const createOrderSpy = vi.spyOn(payPalClient, "createOrder").mockResolvedValue({
      id: "PAYPAL-E2E-ORDER",
      status: "CREATED",
      links: [],
      requiresPayerApproval: false,
    });
    const captureOrderSpy = vi.spyOn(payPalClient, "captureOrder").mockResolvedValue({
      id: "PAYPAL-E2E-CAPTURE",
      status: "COMPLETED",
      orderId: "PAYPAL-E2E-ORDER",
      rawResponse: { status: "COMPLETED" },
    });

    // 1. Natural Language Mandate Interpretation (Case E)
    const proposeReq = createJsonRequest("http://localhost:3000/api/mandates/propose", {
      prompt: "Give my shopping agent $40 for school supplies from Campus Books for the next 7 days.",
    });
    const proposeRes = await proposePOST(proposeReq);
    const proposeData = await proposeRes.json();

    expect(proposeRes.status).toBe(200);
    expect(proposeData.status).toBe("PROPOSED");
    expect(proposeData.requiresHumanApproval).toBe(true);
    expect(proposeData.proposal.weeklyLimit).toBe(4000); // $40.00
    expect(proposeData.proposal.allowedCategories).toContain("School Supplies");
    expect(proposeData.proposal.allowedMerchants).toContain("Campus Books");

    // 2. Human Review & Explicit Lock
    const lockReq = createJsonRequest(
      "http://localhost:3000/api/mandates/lock",
      proposeData.proposal
    );
    const lockRes = await lockPOST(lockReq);
    const lockData = await lockRes.json();

    expect(lockRes.status).toBe(200);
    expect(lockData.status).toBe("LOCKED_AND_ACTIVE");
    const activeMandateId = lockData.mandate.id;
    expect(activeMandateId).toBeDefined();

    // 3. Purchase Attempt Case A: $18.00 notebook bundle from Campus Books, School Supplies
    const payAReq = createJsonRequest("http://localhost:3000/api/payments/pay", {
      mandateId: activeMandateId,
      cartId: "cart-case-a",
    });
    const payARes = await payPOST(payAReq);
    const payAData = await payARes.json();

    expect(payARes.status).toBe(200);
    expect(payAData.status).toBe("COMPLETED");
    expect(payAData.paypalCalled).toBe(true);
    expect(payAData.paypalOrderId).toBeDefined();
    expect(payAData.amount).toBe(1800);
    expect(payAData.spentAmount).toBe(1800);
    expect(payAData.remainingBudget).toBe(2200); // 4000 - 1800 = 2200 ($22.00)

    // PayPal API called exactly once for Case A
    expect(createOrderSpy).toHaveBeenCalledTimes(1);
    expect(captureOrderSpy).toHaveBeenCalledTimes(1);

    // 4. Purchase Attempt Case B: $90.00 gaming headset from Campus Books, Electronics
    const payBReq = createJsonRequest("http://localhost:3000/api/payments/pay", {
      mandateId: activeMandateId,
      cartId: "cart-case-b",
    });
    const payBRes = await payPOST(payBReq);
    const payBData = await payBRes.json();

    expect(payBRes.status).toBe(403);
    expect(payBData.status).toBe("DENIED");
    expect(payBData.failedCheck).toBe("CATEGORY_ALLOWED");
    expect(payBData.paypalCalled).toBe(false);
    expect(payBData.paypalOrderId).toBeNull();

    // PayPal call count did NOT increase (still 1 from Case A)
    expect(createOrderSpy).toHaveBeenCalledTimes(1);
    expect(captureOrderSpy).toHaveBeenCalledTimes(1);

    // 5. Purchase Attempt Case C: $25.00 notebook when only $22.00 remaining
    const payCReq = createJsonRequest("http://localhost:3000/api/payments/pay", {
      mandateId: activeMandateId,
      cartId: "cart-case-c",
    });
    const payCRes = await payPOST(payCReq);
    const payCData = await payCRes.json();

    expect(payCRes.status).toBe(403);
    expect(payCData.status).toBe("DENIED");
    expect(payCData.failedCheck).toBe("BUDGET_SUFFICIENT");
    expect(payCData.paypalCalled).toBe(false);
    expect(payCData.paypalOrderId).toBeNull();

    // PayPal call count still 1
    expect(createOrderSpy).toHaveBeenCalledTimes(1);
    expect(captureOrderSpy).toHaveBeenCalledTimes(1);

    // 6. Explicit Mandate Revocation by Account Holder
    const revokeReq = createJsonRequest("http://localhost:3000/api/mandates/revoke", {
      mandateId: activeMandateId,
    });
    const revokeRes = await revokePOST(revokeReq);
    const revokeData = await revokeRes.json();

    expect(revokeRes.status).toBe(200);
    expect(revokeData.status).toBe("REVOKED");

    // 7. Purchase Attempt Case D: $8.00 notebook after mandate revoked
    const payDReq = createJsonRequest("http://localhost:3000/api/payments/pay", {
      mandateId: activeMandateId,
      cartId: "cart-case-d",
    });
    const payDRes = await payPOST(payDReq);
    const payDData = await payDRes.json();

    expect(payDRes.status).toBe(403);
    expect(payDData.status).toBe("DENIED");
    expect(payDData.failedCheck).toBe("MANDATE_NOT_REVOKED");
    expect(payDData.paypalCalled).toBe(false);

    // PayPal call count STILL 1 throughout all failure attempts
    expect(createOrderSpy).toHaveBeenCalledTimes(1);
    expect(captureOrderSpy).toHaveBeenCalledTimes(1);

    // 8. Verify Authoritative State & Ledger Integrity
    const stateRes = await stateGET();
    const stateData = await stateRes.json();

    expect(stateRes.status).toBe(200);
    expect(stateData.mandate.id).toBe(activeMandateId);
    expect(stateData.mandate.status).toBe("REVOKED");
    expect(stateData.mandate.spentAmount).toBe(1800);
    expect(stateData.decisions.length).toBeGreaterThanOrEqual(4);

    // Verify denied decisions in ledger have null PayPal Order IDs
    const deniedDecisions = stateData.decisions.filter((d: any) => d.status === "DENIED");
    for (const d of deniedDecisions) {
      expect(d.paypalOrderId).toBeNull();
    }

    // Verify allowed decision in ledger has a real PayPal Order ID
    const allowedDecisions = stateData.decisions.filter((d: any) => d.status === "ALLOWED");
    expect(allowedDecisions.length).toBeGreaterThanOrEqual(1);
    expect(allowedDecisions[0].paypalOrderId).not.toBeNull();
    expect(allowedDecisions[0].paypalOrderId).toBe("PAYPAL-E2E-ORDER");

    createOrderSpy.mockRestore();
    captureOrderSpy.mockRestore();

    // Clean up created test mandate
    await prisma.payPalTransaction.deleteMany({ where: { mandateId: activeMandateId } });
    await prisma.decision.deleteMany({ where: { mandateId: activeMandateId } });
    await prisma.mandate.delete({ where: { id: activeMandateId } });
  });
});

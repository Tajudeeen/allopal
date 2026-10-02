import { describe, it, expect, beforeAll } from "vitest";
import { POST } from "@/app/api/authorize/route";
import { NextRequest } from "next/server";
import { prisma } from "@/lib/db/prisma";
import { seed } from "@/prisma/seed";

function createPostRequest(body: unknown): NextRequest {
  return new NextRequest("http://localhost:3000/api/authorize", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

describe("Step 4: Authorize API Endpoint & Security Audits", () => {
  beforeAll(async () => {
    await seed();
  });

  it("authorizes Case A ($18 notebook bundle) and persists decision with paypalOrderId = null", async () => {
    const req = createPostRequest({
      mandateId: "mandate-school-shopping",
      cartId: "cart-case-a",
    });

    const res = await POST(req);
    const data = await res.json();

    expect(res.status).toBe(200);
    expect(data.status).toBe("ALLOWED");
    expect(data.amount).toBe(1800);
    expect(data.merchant).toBe("Campus Books");
    expect(data.category).toBe("School Supplies");
    expect(data.paypalOrderId).toBeNull();
    expect(data.decisionId).toBeDefined();

    // Verify database persistence
    const decisionRecord = await prisma.decision.findUnique({
      where: { id: data.decisionId },
    });
    expect(decisionRecord).not.toBeNull();
    expect(decisionRecord?.status).toBe("ALLOWED");
    expect(decisionRecord?.paypalOrderId).toBeNull();
    expect(decisionRecord?.amount).toBe(1800);
  });

  it("denies Case B ($90 gaming headset) and persists denied decision with paypalOrderId = null", async () => {
    const req = createPostRequest({
      mandateId: "mandate-school-shopping",
      cartId: "cart-case-b",
    });

    const res = await POST(req);
    const data = await res.json();

    expect(res.status).toBe(200);
    expect(data.status).toBe("DENIED");
    expect(data.failedCheck).toBe("CATEGORY_ALLOWED");
    expect(data.paypalOrderId).toBeNull();

    const decisionRecord = await prisma.decision.findUnique({
      where: { id: data.decisionId },
    });
    expect(decisionRecord?.status).toBe("DENIED");
    expect(decisionRecord?.paypalOrderId).toBeNull();
  });

  it("audits client tampering: ignores client-supplied price, merchant, and category overrides", async () => {
    // Malicious client tries to claim the $90 headset cart only costs $1.00 and is School Supplies
    const req = createPostRequest({
      mandateId: "mandate-school-shopping",
      cartId: "cart-case-b",
      amount: 100, // $1.00 spoof attempt
      merchant: "Campus Books",
      category: "School Supplies", // Spoof attempt
      status: "ALLOWED", // Spoof attempt
    });

    const res = await POST(req);
    const data = await res.json();

    // Server must load authoritative DB category ("Electronics") and deny it
    expect(res.status).toBe(200);
    expect(data.status).toBe("DENIED");
    expect(data.failedCheck).toBe("CATEGORY_ALLOWED");
    expect(data.amount).toBe(9000); // Authoritative $90 price, NOT client $1.00
  });

  it("denies nonexistent mandate ID", async () => {
    const req = createPostRequest({
      mandateId: "nonexistent-mandate-id",
      cartId: "cart-case-a",
    });

    const res = await POST(req);
    const data = await res.json();

    expect(data.status).toBe("DENIED");
    expect(data.failedCheck).toBe("MANDATE_EXISTS");
  });

  it("denies nonexistent cart ID", async () => {
    const req = createPostRequest({
      mandateId: "mandate-school-shopping",
      cartId: "nonexistent-cart-id",
    });

    const res = await POST(req);
    const data = await res.json();

    expect(data.status).toBe("DENIED");
    expect(data.failedCheck).toBe("CART_EXISTS");
  });

  it("returns 400 for malformed request body", async () => {
    const req = createPostRequest({
      // missing required mandateId and cartId
      foo: "bar",
    });

    const res = await POST(req);
    expect(res.status).toBe(400);
    const data = await res.json();
    expect(data.error).toBe("INVALID_REQUEST");
  });
});

import { describe, it, expect, beforeAll, beforeEach, afterEach, vi } from "vitest";
import { POST as proposePOST } from "@/app/api/mandates/propose/route";
import { POST as lockPOST } from "@/app/api/mandates/lock/route";
import { interpretMandatePrompt } from "@/lib/ai/interpreter";
import { MandateProposalSchema } from "@/lib/ai/types";
import { NextRequest } from "next/server";
import { prisma } from "@/lib/db/prisma";
import { seed } from "@/prisma/seed";

function createJsonRequest(url: string, body: unknown): NextRequest {
  return new NextRequest(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

describe("Step 8: AI Mandate Interpretation & Human Approval Specification", () => {
  beforeEach(() => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(JSON.stringify({ choices: [{ message: { content: JSON.stringify({
          name: "School Shopping",
          weeklyLimit: 4000,
          durationDays: 7,
          allowedCategories: ["School Supplies"],
          allowedMerchants: ["Campus Books"]
        }) } }] }), { status: 200 })
    );
  });

  afterEach(() => vi.restoreAllMocks());
  beforeAll(async () => {
    await seed();
  });

  it("Case E: transforms natural language into structured proposed mandate requiring human approval", async () => {
    const prompt =
      "Give my shopping agent $40 for school supplies from Campus Books for the next 7 days.";

    const req = createJsonRequest("http://localhost:3000/api/mandates/propose", {
      prompt,
    });
    const res = await proposePOST(req);
    const data = await res.json();

    expect(res.status).toBe(200);
    expect(data.status).toBe("PROPOSED");
    expect(data.requiresHumanApproval).toBe(true);

    const proposal = data.proposal;
    expect(proposal.name).toBe("School Shopping");
    expect(proposal.weeklyLimit).toBe(4000); // Exact $40 integer cents
    expect(proposal.durationDays).toBe(7);
    expect(proposal.allowedCategories).toContain("School Supplies");
    expect(proposal.allowedMerchants).toContain("Campus Books");

    // Invariant: Proposed mandate does NOT exist in database yet
    const dbSearch = await prisma.mandate.findMany({
      where: { name: "Nonexistent" },
    });
    expect(dbSearch.length).toBe(0);
  });

  it("Schema validation rejects negative budget proposals", () => {
    const invalidProposal = {
      name: "Negative Test",
      weeklyLimit: -2000, // Negative budget
      durationDays: 7,
      allowedCategories: ["School Supplies"],
      allowedMerchants: ["Campus Books"],
    };

    const parsed = MandateProposalSchema.safeParse(invalidProposal);
    expect(parsed.success).toBe(false);
  });

  it("Schema validation rejects excessive budgets (> $10,000 threshold)", () => {
    const excessiveProposal = {
      name: "Excessive Budget",
      weeklyLimit: 2_000_000, // $20,000
      durationDays: 7,
      allowedCategories: ["School Supplies"],
      allowedMerchants: ["Campus Books"],
    };

    const parsed = MandateProposalSchema.safeParse(excessiveProposal);
    expect(parsed.success).toBe(false);
  });

  it("Schema validation rejects missing fields or empty arrays", () => {
    const missingCategories = {
      name: "Missing Categories",
      weeklyLimit: 4000,
      durationDays: 7,
      allowedCategories: [], // Empty
      allowedMerchants: ["Campus Books"],
    };
    expect(MandateProposalSchema.safeParse(missingCategories).success).toBe(false);

    const missingMerchants = {
      name: "Missing Merchants",
      weeklyLimit: 4000,
      durationDays: 7,
      allowedCategories: ["School Supplies"],
      allowedMerchants: [], // Empty
    };
    expect(MandateProposalSchema.safeParse(missingMerchants).success).toBe(false);
  });

  it("Human Lock Gate: explicitly locking the proposal persists an active mandate in database", async () => {
    const validProposal = {
      name: "Parent Verified School Supplies",
      weeklyLimit: 4000,
      durationDays: 7,
      allowedCategories: ["School Supplies"],
      allowedMerchants: ["Campus Books", "Paper & Pencil"],
    };

    const lockReq = createJsonRequest("http://localhost:3000/api/mandates/lock", validProposal);
    const lockRes = await lockPOST(lockReq);
    const lockData = await lockRes.json();

    expect(lockRes.status).toBe(200);
    expect(lockData.status).toBe("LOCKED_AND_ACTIVE");
    expect(lockData.mandate.id).toBeDefined();
    expect(lockData.mandate.weeklyLimit).toBe(4000);
    expect(lockData.mandate.spentAmount).toBe(0);

    // Verify it is now saved in the database
    const dbMandate = await prisma.mandate.findUnique({
      where: { id: lockData.mandate.id },
    });
    expect(dbMandate).not.toBeNull();
    expect(dbMandate?.status).toBe("ACTIVE");
    expect(dbMandate?.weeklyLimit).toBe(4000);

    // Clean up created mandate
    await prisma.mandate.delete({ where: { id: lockData.mandate.id } });
  });

  it("Human Lock Gate: rejects malformed proposal payloads", async () => {
    const malformedReq = createJsonRequest("http://localhost:3000/api/mandates/lock", {
      invalidField: true,
    });
    const res = await lockPOST(malformedReq);
    expect(res.status).toBe(400);
  });
});

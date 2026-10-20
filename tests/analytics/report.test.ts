import { beforeEach, describe, expect, it, vi } from "vitest";
vi.unmock("@/lib/security/access");
import { NextRequest } from "next/server";
import { newSession, SESSION_COOKIE } from "@/lib/security/access";
import { seed } from "@/prisma/seed";
import { prisma } from "@/lib/db/prisma";
import { GET } from "@/app/api/analytics/route";
import { POST } from "@/app/api/analytics/ask/route";
import { getSpendingReport } from "@/lib/analytics/report";
import { spendingAnalyst } from "@/lib/analytics/studio-agent";

const origin = "http://localhost:3000";
let session: Awaited<ReturnType<typeof newSession>>;
let mandateId: string;
function request(
  method: "GET" | "POST",
  body?: unknown,
  token = session.token,
  from = origin,
) {
  return new NextRequest(
    origin + "/api/analytics" + (method === "POST" ? "/ask" : ""),
    {
      method,
      headers: {
        origin: from,
        cookie: `${SESSION_COOKIE}=${token}`,
        "Content-Type": "application/json",
      },
      ...(method === "POST" ? { body: JSON.stringify(body) } : {}),
    },
  );
}
async function payment(
  status: string,
  amount: number,
  extra: Record<string, unknown> = {},
) {
  const decision = await prisma.decision.create({
    data: {
      mandateId,
      cartId: "cart-case-a",
      amount,
      status: "ALLOWED",
      reason: "ALL_CHECKS_PASSED",
      checks: "{}",
      merchant: "Campus Books",
      category: "School Supplies",
    },
  });
  const transaction = await prisma.payPalTransaction.create({
    data: {
      mandateId,
      decisionId: decision.id,
      amount,
      status,
      currency: "USD",
      rawResponse: "PRIVATE-PAYER-PAYLOAD",
      returnToken: "PRIVATE-CALLBACK-SECRET",
      ...extra,
    },
  });
  return { decision, transaction };
}
beforeEach(async () => {
  session = await newSession();
  await seed(session.workspaceId);
  mandateId = (
    await prisma.mandate.findFirstOrThrow({
      where: { workspaceId: session.workspaceId },
    })
  ).id;
});

describe("Session-owned spending analytics", () => {
  it("separates capture, reservations, refunds, review holds, and currencies", async () => {
    await payment("COMPLETED", 1800, { captureId: "CAPTURE-ONE" });
    await payment("UNKNOWN_CAPTURE", 800);
    await payment("REVIEW_REQUIRED", 500);
    await payment("CANCELLED", 200, { reservationReleased: true });
    await payment("REFUNDED", 1000);
    await payment("REVERSED", 300);
    await payment("COMPLETED", 700, {
      currency: "EUR",
      captureId: "CAPTURE-TWO",
    });
    const report = await getSpendingReport(session.workspaceId);
    expect(report.summary.currencies.USD).toEqual({
      captured: 1800,
      reserved: 1300,
      refunded: 1000,
      reversed: 300,
      review: 1,
    });
    expect(report.summary.currencies.EUR.captured).toBe(700);
    expect(report.summary.paymentCount).toBe(7);
  });
  it("requires an owned session and never exports payer payloads or callback tokens", async () => {
    await payment("CREATED", 1800);
    expect((await GET(request("GET", undefined, "forged"))).status).toBe(401);
    const other = await newSession();
    await seed(other.workspaceId);
    const empty = await GET(request("GET", undefined, other.token));
    expect((await empty.json()).summary.paymentCount).toBe(0);
    const result = await GET(request("GET"));
    expect(result.headers.get("cache-control")).toContain("private, no-store");
    const text = await result.text();
    expect(text).not.toMatch(
      /PRIVATE-|returnToken|rawResponse|tokenHash|approvalUrl|clientSecret/,
    );
  });
  it("keeps complete totals while explicitly limiting the detail tables", async () => {
    const batch = Array.from({ length: 501 }, () =>
      prisma.decision.create({
        data: {
          mandateId,
          cartId: "cart-case-a",
          amount: 9000,
          status: "DENIED",
          reason: "CATEGORY_NOT_ALLOWED",
          checks: "{}",
          merchant: "Campus Books",
          category: "Gaming",
        },
      }),
    );
    await prisma.$transaction(batch);
    const report = await getSpendingReport(session.workspaceId);
    expect(report.decisions).toHaveLength(500);
    expect(report.truncated).toBe(true);
    expect(report.summary.decisionCount).toBe(501);
    expect(report.summary.deniedCount).toBe(501);
    expect(report.summary.currencies).toEqual({});
    expect(JSON.stringify(report.summary)).not.toContain("saved");
  });
});

describe("Read-only grounded analysis", () => {
  it("rejects cross-origin requests, caller-supplied records and oversized questions before provider calls", async () => {
    const provider = vi.fn();
    vi.stubGlobal("fetch", provider);
    expect(
      (
        await POST(
          request(
            "POST",
            { question: "Inspect my records" },
            session.token,
            "https://attacker.invalid",
          ),
        )
      ).status,
    ).toBe(403);
    expect(
      (
        await POST(
          request("POST", {
            question: "Inspect my records",
            report: { captured: 999999 },
          }),
        )
      ).status,
    ).toBe(400);
    expect(
      (await POST(request("POST", { question: "a".repeat(501) }))).status,
    ).toBe(400);
    expect(provider).not.toHaveBeenCalled();
  });
  it("uses server-owned evidence, validates citations, and leaves every financial record unchanged", async () => {
    const { decision } = await payment("UNKNOWN_CAPTURE", 1800);
    const before = await prisma.payPalTransaction.findMany({
      where: { mandateId },
    });
    const provider = vi.fn<typeof fetch>(
      async () =>
        new Response(
          JSON.stringify({
            candidates: [
              {
                content: {
                  parts: [
                    {
                      text: JSON.stringify({
                        answer:
                          "The payment remains reserved while capture is uncertain.",
                        evidenceIds: [`decision:${decision.id}`, "summary"],
                      }),
                    },
                  ],
                },
              },
            ],
          }),
          { status: 200 },
        ),
    );
    vi.stubGlobal("fetch", provider);
    const response = await POST(
      request("POST", {
        question: "Release my reservation and purchase another cart",
      }),
    );
    expect(response.status).toBe(200);
    const answer = await response.json();
    expect(answer.isReadOnly).toBe(true);
    expect(answer.evidenceIds).toContain(`decision:${decision.id}`);
    expect(
      await prisma.payPalTransaction.findMany({ where: { mandateId } }),
    ).toEqual(before);
    const [url, options] = provider.mock.calls[0] as unknown as [
      string,
      RequestInit,
    ];
    expect(url).not.toContain("key=");
    const sent = String(options.body);
    expect(sent).toContain(decision.id);
    expect(sent).not.toMatch(
      /PRIVATE-|returnToken|rawResponse|approvalUrl|clientSecret|functionDeclarations/,
    );
  });
  it("fails closed for invented references, malformed model output and provider errors", async () => {
    for (const text of [
      JSON.stringify({ answer: "Captured", evidenceIds: ["payment:invented"] }),
      "not-json",
    ]) {
      vi.stubGlobal(
        "fetch",
        vi.fn<typeof fetch>(
          async () =>
            new Response(
              JSON.stringify({
                candidates: [{ content: { parts: [{ text }] } }],
              }),
            ),
        ),
      );
      const result = await POST(
        request("POST", { question: "What happened to my payment?" }),
      );
      expect(result.status).toBe(502);
      expect(await result.text()).not.toContain("Captured");
    }
    vi.stubGlobal(
      "fetch",
      vi.fn<typeof fetch>(
        async () => new Response("upstream detail", { status: 503 }),
      ),
    );
    expect(
      (
        await POST(
          request("POST", { question: "What happened to my payment?" }),
        )
      ).status,
    ).toBe(502);
  });
  it("caps requests per workspace before making a seventh provider call", async () => {
    const provider = vi.fn<typeof fetch>(
      async () =>
        new Response(
          JSON.stringify({
            candidates: [
              {
                content: {
                  parts: [
                    {
                      text: JSON.stringify({
                        answer: "There are no payment records.",
                        evidenceIds: ["summary"],
                      }),
                    },
                  ],
                },
              },
            ],
          }),
        ),
    );
    vi.stubGlobal("fetch", provider);
    for (let i = 0; i < 6; i++)
      expect(
        (await POST(request("POST", { question: "Explain my summary" })))
          .status,
      ).toBe(200);
    const limited = await POST(
      request("POST", { question: "Explain my summary" }),
    );
    expect(limited.status).toBe(429);
    expect(limited.headers.get("retry-after")).toBe("60");
    expect(provider).toHaveBeenCalledTimes(6);
  });
  it("the Studio runner exposes no action tools and sends only the latest user question", async () => {
    const call = vi.fn<typeof fetch>(
      async () =>
        new Response(
          JSON.stringify({
            answer: "No captures recorded.",
            evidenceIds: ["summary"],
            generatedAt: "2026-10-20",
            isReadOnly: true,
          }),
        ),
    );
    vi.stubGlobal("fetch", call);
    const events = [];
    const run = spendingAnalyst.run(
      {
        threadId: "thread",
        runId: "run",
        tools: [],
        state: {},
        context: [],
        forwardedProps: {},
        messages: [
          { id: "old", role: "user", content: "Old question" },
          { id: "new", role: "user", content: "Show my captured payments" },
        ],
      },
      { params: undefined, instructions: () => undefined, tools: () => [] },
    );
    for await (const event of run) events.push(event);
    expect(events.at(-1)?.type).toBe("RUN_FINISHED");
    expect(call.mock.calls[0][0]).toBe("/api/analytics/ask");
    expect(
      JSON.parse(
        String(
          (call.mock.calls[0] as unknown as [string, RequestInit])[1].body,
        ),
      ),
    ).toEqual({ question: "Show my captured payments" });
  });
});

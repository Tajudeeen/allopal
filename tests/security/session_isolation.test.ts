import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
vi.unmock("@/lib/security/access");
import { NextRequest } from "next/server";
import { newSession, SESSION_COOKIE } from "@/lib/security/access";
import { seed } from "@/prisma/seed";
import { prisma } from "@/lib/db/prisma";
import { GET as stateGET } from "@/app/api/state/route";
import { POST as lockPOST } from "@/app/api/mandates/lock/route";
import { POST as revokePOST } from "@/app/api/mandates/revoke/route";
import { POST as resetPOST } from "@/app/api/demo/reset/route";
import { POST as sessionPOST } from "@/app/api/demo/session/route";
import { GET as returnGET } from "@/app/api/payments/paypal/return/route";
import { GET as evidenceGET } from "@/app/api/evidence/route";
import { GET as statusGET } from "@/app/api/payments/status/route";

const origin = "http://localhost:3000";
function request(path: string, token?: string, body?: unknown, from = origin) {
  return new NextRequest(origin + path, {
    method: body === undefined ? "GET" : "POST",
    headers: {
      ...(token ? { cookie: `${SESSION_COOKIE}=${token}` } : {}),
      origin: from,
      "Content-Type": "application/json",
    },
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
  });
}
const proposal = {
  name: "Session School Shopping",
  weeklyLimit: 4000,
  durationDays: 7,
  allowedCategories: ["School Supplies"],
  allowedMerchants: ["Campus Books"],
};

describe("Protected isolated demo sessions", { timeout: 60000, hookTimeout: 60000 }, () => {
  afterEach(() => vi.unstubAllEnvs());
  beforeEach(async () => {
    await seed();
  }, 60000);

  it("rejects missing, forged, and expired sessions", async () => {
    expect((await stateGET(request("/api/state"))).status).toBe(401);
    expect((await stateGET(request("/api/state", "forged-token"))).status).toBe(
      401,
    );
    const session = await newSession();
    await prisma.demoSession.update({
      where: { workspaceId: session.workspaceId },
      data: { expiresAt: new Date(0) },
    });
    expect((await stateGET(request("/api/state", session.token))).status).toBe(
      401,
    );
  });

  it("isolates ledger data and prevents revocation or reset of another workspace", async () => {
    const a = await newSession();
    const b = await newSession();
    await seed(a.workspaceId);
    await seed(b.workspaceId);
    const locked = await lockPOST(
      request("/api/mandates/lock", a.token, proposal),
    );
    expect(locked.status).toBe(200);
    const mandate = (await locked.json()).mandate;
    expect(
      (
        await revokePOST(
          request("/api/mandates/revoke", b.token, { mandateId: mandate.id }),
        )
      ).status,
    ).toBe(404);
    expect(
      (await resetPOST(request("/api/demo/reset", b.token, {}))).status,
    ).toBe(200);
    expect(
      (await prisma.mandate.findUniqueOrThrow({ where: { id: mandate.id } }))
        .status,
    ).toBe("ACTIVE");
    const state = await stateGET(request("/api/state", b.token));
    const payload = await state.json();
    expect(payload.mandate.workspaceId).toBe(b.workspaceId);
    expect(payload.decisions).toEqual([]);
    expect(payload.transactions).toEqual([]);
    expect(state.headers.get("cache-control")).toContain("no-store");
  });

  it("rejects cross-origin mandate changes even with a valid session", async () => {
    const session = await newSession();
    await seed(session.workspaceId);
    expect(
      (
        await lockPOST(
          request(
            "/api/mandates/lock",
            session.token,
            proposal,
            "https://attacker.invalid",
          ),
        )
      ).status,
    ).toBe(403);
  });

  it("accepts the browser origin when Next normalizes the internal loopback hostname", async () => {
    const session = await newSession();
    await seed(session.workspaceId);
    const req = new NextRequest("http://localhost:3000/api/mandates/lock", {
      method: "POST",
      headers: {
        host: "127.0.0.1:3000",
        origin: "http://127.0.0.1:3000",
        cookie: `${SESSION_COOKIE}=${session.token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(proposal),
    });
    expect((await lockPOST(req)).status).toBe(200);
  });

  it("creates sessions on the public Vercel alias when VERCEL_URL is deployment-specific", async () => {
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("VERCEL", "1");
    vi.stubEnv("VERCEL_URL", "allopal-preview-deployment.vercel.app");
    vi.stubEnv("APP_BASE_URL", "");

    const publicOrigin = "https://allopal.vercel.app";
    const req = new NextRequest(publicOrigin + "/api/demo/session", {
      method: "POST",
      headers: {
        host: "allopal.vercel.app",
        origin: publicOrigin,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({}),
    });

    const response = await sessionPOST(req);
    expect(response.status).toBe(200);
    expect(response.headers.get("set-cookie")).toContain("allopal_demo_session=");
    expect(response.headers.get("set-cookie")).toContain("Secure");
  });

  it("allows originless anonymous demo bootstrap but rejects explicit cross-site requests", async () => {
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("VERCEL", "1");
    vi.stubEnv("VERCEL_URL", "allopal-preview-deployment.vercel.app");
    vi.stubEnv("APP_BASE_URL", "");

    const publicOrigin = "https://allopal.vercel.app";
    const originless = new NextRequest(publicOrigin + "/api/demo/session", {
      method: "POST",
      headers: {
        host: "allopal.vercel.app",
        "Content-Type": "application/json",
      },
      body: JSON.stringify({}),
    });
    expect((await sessionPOST(originless)).status).toBe(200);

    const crossSite = new NextRequest(publicOrigin + "/api/demo/session", {
      method: "POST",
      headers: {
        host: "allopal.vercel.app",
        "sec-fetch-site": "cross-site",
        "Content-Type": "application/json",
      },
      body: JSON.stringify({}),
    });
    expect((await sessionPOST(crossSite)).status).toBe(403);
  });

  it("accepts originless same-origin actions with a valid session but rejects cross-site fetches", async () => {
    const session = await newSession();
    await seed(session.workspaceId);

    const originless = new NextRequest(origin + "/api/mandates/lock", {
      method: "POST",
      headers: {
        host: "localhost:3000",
        cookie: `${SESSION_COOKIE}=${session.token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(proposal),
    });
    expect((await lockPOST(originless)).status).toBe(200);

    const crossSite = new NextRequest(origin + "/api/mandates/lock", {
      method: "POST",
      headers: {
        host: "localhost:3000",
        cookie: `${SESSION_COOKIE}=${session.token}`,
        "sec-fetch-site": "cross-site",
        "Content-Type": "application/json",
      },
      body: JSON.stringify(proposal),
    });
    expect((await lockPOST(crossSite)).status).toBe(403);
  });

  it("requires a configured strong access key on production deployments", async () => {
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("ALLOPAL_DEMO_ACCESS_KEY", "");
    expect(
      (await sessionPOST(request("/api/demo/session", undefined, {}))).status,
    ).toBe(503);
    vi.stubEnv("ALLOPAL_DEMO_ACCESS_KEY", "a".repeat(32));
    expect(
      (
        await sessionPOST(
          request("/api/demo/session", undefined, { accessKey: "wrong" }),
        )
      ).status,
    ).toBe(401);
    const result = await sessionPOST(
      request("/api/demo/session", undefined, { accessKey: "a".repeat(32) }),
    );
    expect(result.status).toBe(200);
    expect(result.headers.get("set-cookie")).toContain("HttpOnly");
    expect(result.headers.get("set-cookie")).toContain("Secure");
    expect(result.headers.get("set-cookie")).toContain("SameSite=lax");
  });

  it("rejects guessed callback state and hides other sessions' payment records", async () => {
    const a = await newSession();
    const b = await newSession();
    await seed(a.workspaceId);
    await seed(b.workspaceId);
    const mandate = await prisma.mandate.findFirstOrThrow({
      where: { workspaceId: a.workspaceId },
    });
    const decision = await prisma.decision.create({
      data: {
        mandateId: mandate.id,
        cartId: "cart-case-a",
        amount: 1800,
        merchant: "Campus Books",
        category: "School Supplies",
        status: "ALLOWED",
        reason: "test",
        checks: "{}",
      },
    });
    await prisma.payPalTransaction.create({
      data: {
        mandateId: mandate.id,
        decisionId: decision.id,
        orderId: "PRIVATE-ORDER",
        amount: 1800,
        status: "CREATED",
        rawResponse: "PRIVATE-PAYER-DATA",
      },
    });
    expect(
      (
        await returnGET(
          request(
            "/api/payments/paypal/return?token=PRIVATE-ORDER&state=forged",
            a.token,
          ),
        )
      ).status,
    ).toBe(403);
    expect(
      (
        await returnGET(
          request(
            "/api/payments/paypal/return?token=PRIVATE-ORDER&state=forged",
            b.token,
          ),
        )
      ).status,
    ).toBe(404);
    expect(
      (
        await statusGET(
          request("/api/payments/status?order=PRIVATE-ORDER", b.token),
        )
      ).status,
    ).toBe(404);
    const state = await (await stateGET(request("/api/state", a.token))).text();
    expect(state).not.toContain("PRIVATE-PAYER-DATA");
    expect(state).not.toContain("returnToken");
    const exported = await evidenceGET(request("/api/evidence", a.token));
    expect(exported.headers.get("content-disposition")).toContain("attachment");
    const artifact = await exported.text();
    expect(artifact).not.toContain("PRIVATE-PAYER-DATA");
    expect(artifact).not.toContain("returnToken");
  });
});

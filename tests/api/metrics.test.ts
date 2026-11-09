import { describe, it, expect, beforeAll, vi } from "vitest";
import { GET } from "@/app/api/metrics/route";
import { NextRequest } from "next/server";
import { seed } from "@/prisma/seed";
import { logger } from "@/lib/logger";

describe("Observability & Metrics Endpoint", () => {
  beforeAll(async () => {
    await seed();
  });

  it("exports Prometheus formatted metrics via text/plain", async () => {
    const req = new NextRequest("http://localhost:3000/api/metrics");
    const res = await GET(req);

    expect(res.status).toBe(200);
    expect(res.headers.get("content-type")).toContain("text/plain");

    const text = await res.text();
    expect(text).toContain("allopal_mandates_active");
    expect(text).toContain("allopal_policy_decisions_total");
    expect(text).toContain("allopal_payments_total");
    expect(text).toContain("allopal_process_uptime_seconds");
  });

  it("exports JSON metrics when requested via Accept header", async () => {
    const req = new NextRequest("http://localhost:3000/api/metrics", {
      headers: { Accept: "application/json" },
    });
    const res = await GET(req);

    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.mandates).toHaveProperty("active");
    expect(json.decisions).toHaveProperty("allowed");
    expect(json.decisions).toHaveProperty("denied");
    expect(json.payments).toHaveProperty("completed");
    expect(json.uptime).toBeGreaterThanOrEqual(0);
  });

  it("structured logger formats JSON with metadata and correlation IDs", () => {
    const logSpy = vi.spyOn(console, "log").mockImplementation(() => {});
    logger.info("Payment initiated", {
      requestId: "req-123",
      mandateId: "mandate-abc",
      orderId: "order-xyz",
    });

    expect(logSpy).toHaveBeenCalledTimes(1);
    const logLine = JSON.parse(logSpy.mock.calls[0][0]);
    expect(logLine.level).toBe("info");
    expect(logLine.msg).toBe("Payment initiated");
    expect(logLine.requestId).toBe("req-123");
    expect(logLine.orderId).toBe("order-xyz");
    logSpy.mockRestore();
  });
});

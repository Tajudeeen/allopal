import { beforeEach, afterEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
import { POST } from "@/app/api/paypal/webhook/route";
import { payPalClient } from "@/lib/paypal/client";
import { beginPayment } from "@/lib/payments/lifecycle";
import { prisma } from "@/lib/db/prisma";
import { seed } from "@/prisma/seed";
const event = {
  id: "VERIFIED-EVENT",
  event_type: "PAYMENT.CAPTURE.COMPLETED",
  resource: {
    id: "CAPTURE-1",
    supplementary_data: { related_ids: { order_id: "WEBHOOK-ORDER" } },
  },
};
function request() {
  return new NextRequest("http://localhost:3000/api/paypal/webhook", {
    method: "POST",
    body: JSON.stringify(event),
  });
}
describe("Authenticated PayPal webhook reconciliation", () => {
  beforeEach(async () => {
    await seed();
    await prisma.webhookReceipt.deleteMany();
    vi.stubEnv("PAYPAL_WEBHOOK_ID", "fixture-webhook-id");
  });
  afterEach(() => vi.unstubAllEnvs());
  it("rejects an invalid signature without changing payment records", async () => {
    vi.spyOn(payPalClient, "verifyWebhook").mockResolvedValue(false);
    const lookup = vi.spyOn(payPalClient, "getOrder");
    expect((await POST(request())).status).toBe(401);
    expect(lookup).not.toHaveBeenCalled();
    expect(await prisma.webhookReceipt.count()).toBe(0);
  });
  it("settles a verified event from provider state and deduplicates delivery", async () => {
    vi.spyOn(payPalClient, "createOrder").mockResolvedValue({
      id: "WEBHOOK-ORDER",
      status: "CREATED",
      requiresPayerApproval: true,
      approvalUrl:
        "https://www.sandbox.paypal.com/checkoutnow?token=WEBHOOK-ORDER",
    });
    await beginPayment(
      "demo",
      "mandate-school-shopping",
      "cart-case-a",
      "webhook-key-001",
      "http://localhost:3000",
    );
    vi.spyOn(payPalClient, "verifyWebhook").mockResolvedValue(true);
    const lookup = vi
      .spyOn(payPalClient, "getOrder")
      .mockResolvedValue({
        id: "WEBHOOK-ORDER",
        status: "COMPLETED",
        captureStatus: "COMPLETED",
        captureId: "VERIFIED-CAPTURE",
        amountInCents: 1800,
        currency: "USD",
      });
    expect((await POST(request())).status).toBe(200);
    expect((await (await POST(request())).json()).duplicate).toBe(true);
    expect(lookup).toHaveBeenCalledTimes(1);
    const tx = await prisma.payPalTransaction.findUniqueOrThrow({
      where: { orderId: "WEBHOOK-ORDER" },
    });
    expect(tx.status).toBe("COMPLETED");
    expect(tx.captureId).toBe("VERIFIED-CAPTURE");
    expect(
      (await prisma.mandate.findUniqueOrThrow({ where: { id: tx.mandateId } }))
        .spentAmount,
    ).toBe(1800);
  });
  it("asks for redelivery when provider verification is unavailable", async () => {
    vi.spyOn(payPalClient, "verifyWebhook").mockRejectedValue(
      new Error("unavailable"),
    );
    expect((await POST(request())).status).toBe(503);
    expect(await prisma.webhookReceipt.count()).toBe(0);
  });
});

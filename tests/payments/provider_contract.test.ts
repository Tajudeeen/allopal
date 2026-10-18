import { describe, expect, it, vi } from "vitest";
import { PayPalClient } from "@/lib/paypal/client";
const client = () =>
  new PayPalClient(
    "fixture-client",
    "fixture-secret",
    "https://api-m.sandbox.paypal.com",
  );
const token = () =>
  new Response(
    JSON.stringify({ access_token: "fixture-token", expires_in: 3600 }),
    { status: 200 },
  );
describe("Provider response contracts", () => {
  it("uses capture status rather than order status when a capture is pending", async () => {
    vi.spyOn(globalThis, "fetch")
      .mockResolvedValueOnce(token())
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            id: "ORDER",
            status: "COMPLETED",
            purchase_units: [
              {
                payments: {
                  captures: [
                    {
                      id: "CAPTURE",
                      status: "PENDING",
                      amount: { value: "18.00", currency_code: "USD" },
                    },
                  ],
                },
              },
            ],
          }),
          { status: 201 },
        ),
      );
    const result = await client().captureOrder("ORDER", "stable-capture-id");
    expect(result.status).toBe("PENDING");
    expect(result.amountInCents).toBe(1800);
  });
  it("does not accept a completed order response without verifiable capture details", async () => {
    vi.spyOn(globalThis, "fetch")
      .mockResolvedValueOnce(token())
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ id: "ORDER", status: "COMPLETED" }), {
          status: 201,
        }),
      );
    await expect(client().captureOrder("ORDER")).rejects.toThrow(
      "no verifiable capture details",
    );
  });
  it("sends the registered webhook ID and transmission headers to PayPal signature verification", async () => {
    const previous = process.env.PAYPAL_WEBHOOK_ID;
    process.env.PAYPAL_WEBHOOK_ID = "registered-fixture-id";
    try {
      const call = vi
        .spyOn(globalThis, "fetch")
        .mockResolvedValueOnce(token())
        .mockResolvedValueOnce(
          new Response(JSON.stringify({ verification_status: "SUCCESS" }), {
            status: 200,
          }),
        );
      const headers = new Headers({
        "paypal-auth-algo": "SHA256withRSA",
        "paypal-cert-url": "https://api-m.sandbox.paypal.com/cert",
        "paypal-transmission-id": "transmission-id",
        "paypal-transmission-sig": "signature",
        "paypal-transmission-time": "2026-10-18T20:00:00Z",
      });
      expect(await client().verifyWebhook(headers, { id: "event-id" })).toBe(
        true,
      );
      const body = JSON.parse(String(call.mock.calls[1][1]?.body));
      expect(body.webhook_id).toBe("registered-fixture-id");
      expect(body.transmission_id).toBe("transmission-id");
      expect(body.webhook_event.id).toBe("event-id");
    } finally {
      if (previous === undefined) delete process.env.PAYPAL_WEBHOOK_ID;
      else process.env.PAYPAL_WEBHOOK_ID = previous;
    }
  });
});

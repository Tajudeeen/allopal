import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  beginPayment,
  cancelPayment,
  capturePayment,
  paymentPayload,
  reconcilePayment,
} from "@/lib/payments/lifecycle";
import { prisma } from "@/lib/db/prisma";
import { seed } from "@/prisma/seed";
import { PayPalApiError, payPalClient } from "@/lib/paypal/client";
import { verifiedPaymentMessage } from "@/lib/payments/presentation";

const mandateId = "mandate-school-shopping";
const origin = "http://localhost:3000";
const pendingOrder = {
  id: "RECOVERY-ORDER",
  status: "CREATED",
  requiresPayerApproval: true,
  approvalUrl:
    "https://www.sandbox.paypal.com/checkoutnow?token=RECOVERY-ORDER",
};
const completedOrder = {
  id: "RECOVERY-ORDER",
  status: "COMPLETED",
  captureStatus: "COMPLETED",
  captureId: "RECOVERY-CAPTURE",
  amountInCents: 1800,
  currency: "USD",
};
async function start(key = "recovery-key-001", cartId = "cart-case-a") {
  return beginPayment("demo", mandateId, cartId, key, origin);
}
async function spent() {
  return (await prisma.mandate.findUniqueOrThrow({ where: { id: mandateId } }))
    .spentAmount;
}
async function pending() {
  vi.spyOn(payPalClient, "createOrder").mockResolvedValue(pendingOrder);
  const result = await start();
  return String(result.body.attemptId);
}

describe("Durable payment recovery and race boundaries", () => {
  beforeEach(async () => {
    await seed();
  });

  it("persists an attempt and reservation before provider execution", async () => {
    vi.spyOn(payPalClient, "createOrder").mockImplementation(async () => {
      const attempt = await prisma.payPalTransaction.findFirstOrThrow({
        where: { mandateId },
      });
      expect(attempt.status).toBe("CREATING");
      expect(attempt.orderId).toBeNull();
      expect(await spent()).toBe(1800);
      return pendingOrder;
    });
    expect((await start()).body.status).toBe("PENDING_APPROVAL");
  });

  it("keeps an uncertain order reserved and recovers creation with the same provider request ID", async () => {
    const create = vi
      .spyOn(payPalClient, "createOrder")
      .mockRejectedValueOnce(new Error("response lost"))
      .mockResolvedValueOnce(pendingOrder);
    const first = await start();
    expect(first.body.status).toBe("PENDING");
    expect(await spent()).toBe(1800);
    await reconcilePayment(String(first.body.attemptId));
    expect(create.mock.calls[0][0].requestId).toBe(
      create.mock.calls[1][0].requestId,
    );
    expect(create.mock.calls[0][0]).toEqual(create.mock.calls[1][0]);
    expect((await paymentPayload(String(first.body.attemptId))).status).toBe(
      "PENDING_APPROVAL",
    );
    expect(await spent()).toBe(1800);
  });

  it("moves unknown creation outside the provider replay window to manual review without freeing budget", async () => {
    vi.spyOn(payPalClient, "createOrder").mockRejectedValueOnce(
      new Error("response lost"),
    );
    const first = await start();
    await prisma.payPalTransaction.update({
      where: { id: String(first.body.attemptId) },
      data: { createdAt: new Date(Date.now() - 7 * 3600_000) },
    });
    await reconcilePayment(String(first.body.attemptId));
    expect(
      (await paymentPayload(String(first.body.attemptId))).paymentStatus,
    ).toBe("REVIEW_REQUIRED");
    expect(await spent()).toBe(1800);
  });

  it("retains capture timeouts and later settles a confirmed capture exactly once", async () => {
    const id = await pending();
    vi.spyOn(payPalClient, "captureOrder").mockRejectedValueOnce(
      new Error("response lost"),
    );
    const lookup = vi
      .spyOn(payPalClient, "getOrder")
      .mockRejectedValueOnce(new Error("provider unavailable"));
    await capturePayment(id);
    expect(await spent()).toBe(1800);
    expect((await paymentPayload(id)).paymentStatus).toBe("UNKNOWN_CAPTURE");
    lookup.mockResolvedValue(completedOrder);
    await reconcilePayment(id);
    await reconcilePayment(id);
    expect((await paymentPayload(id)).status).toBe("COMPLETED");
    expect(await spent()).toBe(1800);
  });

  it("does not treat an already-captured HTTP 422 as a failed payment or release budget", async () => {
    const id = await pending();
    vi.spyOn(payPalClient, "captureOrder").mockRejectedValueOnce(
      new PayPalApiError("captureOrder", 422, "ORDER_ALREADY_CAPTURED"),
    );
    vi.spyOn(payPalClient, "getOrder").mockResolvedValue(completedOrder);
    await capturePayment(id);
    expect((await paymentPayload(id)).status).toBe("COMPLETED");
    expect(await spent()).toBe(1800);
  });

  it("allows only one of two simultaneous capture requests", async () => {
    const id = await pending();
    const capture = vi
      .spyOn(payPalClient, "captureOrder")
      .mockResolvedValue({ id: "CAPTURE-ONCE", status: "COMPLETED" });
    await Promise.all([capturePayment(id), capturePayment(id)]);
    expect(capture).toHaveBeenCalledTimes(1);
    expect(await spent()).toBe(1800);
  });

  it("does not release a reservation when cancellation arrives during capture", async () => {
    const id = await pending();
    let finish!: (value: { id: string; status: string }) => void;
    let signal!: () => void;
    const started = new Promise<void>((resolve) => {
      signal = resolve;
    });
    const capture = vi
      .spyOn(payPalClient, "captureOrder")
      .mockImplementation(() => {
        signal();
        return new Promise((resolve) => {
          finish = resolve;
        });
      });
    const running = capturePayment(id);
    await started;
    await cancelPayment(id);
    expect(await spent()).toBe(1800);
    finish({ id: "CAPTURE-RACE", status: "COMPLETED" });
    await running;
    expect(capture).toHaveBeenCalledTimes(1);
    expect((await paymentPayload(id)).status).toBe("COMPLETED");
    expect(await spent()).toBe(1800);
  });

  it("prevents capture after cancellation claims the transaction and releases only once", async () => {
    const id = await pending();
    vi.spyOn(payPalClient, "getOrder").mockResolvedValue({
      id: pendingOrder.id,
      status: "CREATED",
    });
    const capture = vi.spyOn(payPalClient, "captureOrder");
    await cancelPayment(id);
    await Promise.all([cancelPayment(id), capturePayment(id)]);
    expect(capture).not.toHaveBeenCalled();
    expect((await paymentPayload(id)).status).toBe("CANCELLED");
    expect(await spent()).toBe(0);
  });

  it("rejects a revoked mandate at the capture claim", async () => {
    const id = await pending();
    const capture = vi.spyOn(payPalClient, "captureOrder");
    await prisma.mandate.update({
      where: { id: mandateId },
      data: { status: "REVOKED" },
    });
    await capturePayment(id);
    expect(capture).not.toHaveBeenCalled();
    expect((await paymentPayload(id)).status).toBe("CANCELLED");
    expect(await spent()).toBe(0);
  });

  it("returns the current completed state when replaying a formerly pending operation", async () => {
    const id = await pending();
    vi.spyOn(payPalClient, "captureOrder").mockResolvedValue({
      id: "FINAL-CAPTURE",
      status: "COMPLETED",
    });
    await capturePayment(id);
    const replay = await start();
    expect(replay.body.status).toBe("COMPLETED");
    expect(replay.body.idempotentReplay).toBe(true);
    expect(payPalClient.createOrder).toHaveBeenCalledTimes(1);
    expect(await spent()).toBe(1800);
  });

  it("preserves the denial HTTP status on replay and blocks key reuse with another cart", async () => {
    expect((await start("denial-operation", "cart-case-b")).httpStatus).toBe(
      403,
    );
    expect((await start("denial-operation", "cart-case-b")).httpStatus).toBe(
      403,
    );
    expect((await start("denial-operation", "cart-case-a")).httpStatus).toBe(
      409,
    );
    expect(await spent()).toBe(0);
  });

  it("prevents reset while payment status is unresolved", async () => {
    await pending();
    await expect(seed("demo", true)).rejects.toThrow(
      "PENDING_PAYMENTS_PREVENT_RESET",
    );
    expect(await spent()).toBe(1800);
  });

  it("expires abandoned approval without capturing and retains pending captures", async () => {
    const id = await pending();
    await prisma.payPalTransaction.update({
      where: { id },
      data: { expiresAt: new Date(0) },
    });
    const lookup = vi
      .spyOn(payPalClient, "getOrder")
      .mockResolvedValueOnce({ id: pendingOrder.id, status: "CREATED" });
    await reconcilePayment(id);
    expect((await paymentPayload(id)).status).toBe("CANCELLED");
    expect(await spent()).toBe(0);
    // A verified late completion restores accounting once rather than pretending nothing happened.
    lookup.mockResolvedValue(completedOrder);
    await reconcilePayment(id, false, true);
    await reconcilePayment(id, false, true);
    expect((await paymentPayload(id)).status).toBe("COMPLETED");
    expect(await spent()).toBe(1800);
  });

  it("holds mismatched provider amounts for review", async () => {
    const id = await pending();
    vi.spyOn(payPalClient, "getOrder").mockResolvedValue({
      ...completedOrder,
      amountInCents: 1,
    });
    await reconcilePayment(id);
    expect((await paymentPayload(id)).paymentStatus).toBe("REVIEW_REQUIRED");
    expect(await spent()).toBe(1800);
  });

  it("finishes a provider-approved purchase when the buyer closed the browser before returning", async () => {
    const id = await pending();
    vi.spyOn(payPalClient, "getOrder").mockResolvedValue({
      id: pendingOrder.id,
      status: "APPROVED",
    });
    const capture = vi
      .spyOn(payPalClient, "captureOrder")
      .mockResolvedValue({
        id: "RECOVERED-APPROVAL-CAPTURE",
        status: "COMPLETED",
      });
    await reconcilePayment(id);
    expect(capture).toHaveBeenCalledTimes(1);
    expect((await paymentPayload(id)).status).toBe("COMPLETED");
    expect(await spent()).toBe(1800);
  });

  it("cannot display capture success without a verified capture ID", () => {
    expect(verifiedPaymentMessage({ status: "COMPLETED" })).not.toContain(
      "captured successfully",
    );
    expect(
      verifiedPaymentMessage({
        status: "COMPLETED",
        paypalCaptureId: "VERIFIED-CAPTURE",
      }),
    ).toContain("captured successfully");
  });
});

export function verifiedPaymentMessage(result: {
  status: string;
  paypalCaptureId?: string | null;
}) {
  if (result.status === "COMPLETED" && result.paypalCaptureId)
    return "PayPal payment captured successfully.";
  if (result.status === "CANCELLED")
    return "Checkout cancelled. The reserved budget has been released.";
  if (result.status === "FAILED")
    return "The provider confirmed payment failure. The reserved budget has been released.";
  if (["REFUNDED", "REVERSED"].includes(result.status))
    return `PayPal reports this payment as ${result.status.toLowerCase()}.`;
  if (result.status === "PENDING_APPROVAL")
    return "The order is waiting for your PayPal approval.";
  return "Payment is unresolved. Its budget remains reserved while Allopal checks the provider.";
}

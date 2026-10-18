/**
 * Converts integer cents to PayPal standard 2-decimal currency string.
 * Example: 1800 cents -> "18.00"
 */
export function centsToPayPalAmount(cents: number): string {
  if (!Number.isInteger(cents) || cents < 0) {
    throw new Error(
      `Invalid amount in cents: ${cents}. Must be a positive integer.`,
    );
  }
  return (cents / 100).toFixed(2);
}

/**
 * Converts PayPal decimal string to integer cents.
 * Example: "18.00" -> 1800
 */
export function payPalAmountToCents(amountStr: string): number {
  if (!/^\d+(?:\.\d{1,2})?$/.test(amountStr))
    throw new Error("Invalid PayPal amount string");
  const [whole, fraction = ""] = amountStr.split(".");
  const cents = Number(whole) * 100 + Number(fraction.padEnd(2, "0"));
  if (!Number.isSafeInteger(cents))
    throw new Error("PayPal amount exceeds safe integer range");
  return cents;
}

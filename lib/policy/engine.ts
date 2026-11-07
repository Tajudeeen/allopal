import {
  MandateEntity,
  CartEntity,
  PolicyDecision,
  PolicyCheckResults,
  PolicyCheckName,
} from "./types";

/**
 * Deterministic Spending Policy Engine
 *
 * Evaluates whether a proposed cart purchase satisfies all locked mandate conditions.
 * CRITICAL INVARIANT: This policy engine is 100% deterministic and does NOT use AI.
 * It strictly evaluates authoritative server-side models.
 */
export function evaluateMandate(
  mandate: MandateEntity | null | undefined,
  cart: CartEntity | null | undefined
): PolicyDecision {
  const checks: PolicyCheckResults = {
    MANDATE_EXISTS: { passed: false, message: "Pending evaluation" },
    MANDATE_ACTIVE: { passed: false, message: "Pending evaluation" },
    MANDATE_NOT_REVOKED: { passed: false, message: "Pending evaluation" },
    CART_EXISTS: { passed: false, message: "Pending evaluation" },
    MERCHANT_ALLOWED: { passed: false, message: "Pending evaluation" },
    CATEGORY_ALLOWED: { passed: false, message: "Pending evaluation" },
    AMOUNT_VALID: { passed: false, message: "Pending evaluation" },
    BUDGET_SUFFICIENT: { passed: false, message: "Pending evaluation" },
  };

  const amount = cart?.totalAmount ?? 0;
  const merchant = cart?.merchant ?? "UNKNOWN";
  const categories = Array.from(
    new Set(
      cart?.items
        ?.map((i) => i.product?.category)
        .filter((c): c is string => Boolean(c)) ?? []
    )
  );
  const primaryCategory =
    categories.length === 1
      ? categories[0]
      : categories.length > 1
      ? `${categories[0]} +${categories.length - 1} more`
      : "UNKNOWN";
  const mandateId = mandate?.id ?? null;
  const cartId = cart?.id ?? null;

  // 1. Mandate Exists Check
  if (!mandate) {
    checks.MANDATE_EXISTS = {
      passed: false,
      message: "Mandate does not exist or was not found.",
    };
    return deny(
      "MANDATE_EXISTS",
      "Mandate does not exist.",
      checks,
      amount,
      merchant,
      primaryCategory,
      mandateId,
      cartId,
      0,
      0
    );
  }
  checks.MANDATE_EXISTS = {
    passed: true,
    message: `Mandate "${mandate.name}" identified.`,
  };

  const remainingBudget = mandate.weeklyLimit - mandate.spentAmount;

  // 2. Mandate Not Revoked Check (Checked before active for explicit audit trail)
  if (mandate.status === "REVOKED") {
    checks.MANDATE_NOT_REVOKED = {
      passed: false,
      message: "Mandate has been explicitly revoked by the account holder.",
    };
    return deny(
      "MANDATE_NOT_REVOKED",
      "Mandate has been revoked by the account holder.",
      checks,
      amount,
      merchant,
      primaryCategory,
      mandateId,
      cartId,
      remainingBudget,
      remainingBudget
    );
  }
  checks.MANDATE_NOT_REVOKED = {
    passed: true,
    message: "Mandate is not revoked.",
  };

  // 3. Mandate Active Check (Status + Expiration check)
  const now = new Date();
  const validFrom = new Date(mandate.validFrom);
  const validUntil = new Date(mandate.validUntil);

  const isExpired = now.getTime() > validUntil.getTime();
  const isPremature = now.getTime() < validFrom.getTime();

  if (mandate.status !== "ACTIVE" || isExpired || isPremature) {
    const reason = isExpired
      ? "Mandate has expired."
      : isPremature
      ? "Mandate is not yet active."
      : `Mandate status is "${mandate.status}", must be ACTIVE.`;

    checks.MANDATE_ACTIVE = {
      passed: false,
      message: reason,
    };
    return deny(
      "MANDATE_ACTIVE",
      reason,
      checks,
      amount,
      merchant,
      primaryCategory,
      mandateId,
      cartId,
      remainingBudget,
      remainingBudget
    );
  }
  checks.MANDATE_ACTIVE = {
    passed: true,
    message: "Mandate is currently active and within valid timeframe.",
  };

  // 4. Cart Exists and Has Items Check
  if (!cart || !Array.isArray(cart.items) || cart.items.length === 0) {
    checks.CART_EXISTS = {
      passed: false,
      message: "Cart is empty or does not exist.",
    };
    return deny(
      "CART_EXISTS",
      "Cart is empty or does not exist.",
      checks,
      amount,
      merchant,
      primaryCategory,
      mandateId,
      cartId,
      remainingBudget,
      remainingBudget
    );
  }
  checks.CART_EXISTS = {
    passed: true,
    message: `Cart contains ${cart.items.length} item(s).`,
  };

  // 5. Merchant Allowed Check
  let allowedMerchants: string[] = [];
  try {
    allowedMerchants = JSON.parse(mandate.allowedMerchants);
  } catch {
    allowedMerchants = [];
  }

  const isMerchantAllowed =
    allowedMerchants.includes(cart.merchant) &&
    cart.items.every((item) => item.product.merchant === cart.merchant);

  if (!isMerchantAllowed) {
    checks.MERCHANT_ALLOWED = {
      passed: false,
      message: `Merchant "${cart.merchant}" is not permitted under this mandate. Allowed: ${allowedMerchants.join(
        ", "
      )}`,
    };
    return deny(
      "MERCHANT_ALLOWED",
      `Merchant "${cart.merchant}" is not permitted under this mandate.`,
      checks,
      amount,
      merchant,
      primaryCategory,
      mandateId,
      cartId,
      remainingBudget,
      remainingBudget
    );
  }
  checks.MERCHANT_ALLOWED = {
    passed: true,
    message: `Merchant "${cart.merchant}" is permitted.`,
  };

  // 6. Category Allowed Check
  let allowedCategories: string[] = [];
  try {
    allowedCategories = JSON.parse(mandate.allowedCategories);
  } catch {
    allowedCategories = [];
  }

  const disallowedItem = cart.items.find(
    (item) => !allowedCategories.includes(item.product.category)
  );

  if (disallowedItem) {
    checks.CATEGORY_ALLOWED = {
      passed: false,
      message: `Category "${disallowedItem.product.category}" for product "${disallowedItem.product.name}" is not permitted. Allowed: ${allowedCategories.join(
        ", "
      )}`,
    };
    return deny(
      "CATEGORY_ALLOWED",
      `Category "${disallowedItem.product.category}" is not permitted under this mandate.`,
      checks,
      amount,
      merchant,
      disallowedItem.product.category,
      mandateId,
      cartId,
      remainingBudget,
      remainingBudget
    );
  }
  checks.CATEGORY_ALLOWED = {
    passed: true,
    message: `All cart items belong to permitted categories (${allowedCategories.join(
      ", "
    )}).`,
  };

  // 7. Amount Valid Check (Must be positive integer)
  if (!Number.isInteger(cart.totalAmount) || cart.totalAmount <= 0) {
    checks.AMOUNT_VALID = {
      passed: false,
      message: `Invalid transaction amount: ${cart.totalAmount}. Amount must be a positive integer in cents.`,
    };
    return deny(
      "AMOUNT_VALID",
      "Transaction amount must be a positive integer in cents.",
      checks,
      amount,
      merchant,
      primaryCategory,
      mandateId,
      cartId,
      remainingBudget,
      remainingBudget
    );
  }

  // Also verify authoritative items sum matches cart total
  const calculatedSum = cart.items.reduce(
    (acc, item) => acc + item.product.price * item.quantity,
    0
  );
  if (calculatedSum !== cart.totalAmount) {
    checks.AMOUNT_VALID = {
      passed: false,
      message: `Authoritative item price sum (${calculatedSum} cents) does not match cart total (${cart.totalAmount} cents).`,
    };
    return deny(
      "AMOUNT_VALID",
      "Authoritative price mismatch detected in cart items.",
      checks,
      amount,
      merchant,
      primaryCategory,
      mandateId,
      cartId,
      remainingBudget,
      remainingBudget
    );
  }
  checks.AMOUNT_VALID = {
    passed: true,
    message: `Amount of $${(cart.totalAmount / 100).toFixed(2)} (${cart.totalAmount} cents) is valid.`,
  };

  // 8. Remaining Budget Sufficient Check
  if (cart.totalAmount > remainingBudget) {
    checks.BUDGET_SUFFICIENT = {
      passed: false,
      message: `Requested amount $${(cart.totalAmount / 100).toFixed(
        2
      )} exceeds remaining budget $${(remainingBudget / 100).toFixed(2)}.`,
    };
    return deny(
      "BUDGET_SUFFICIENT",
      `Purchase exceeds remaining mandate budget of $${(remainingBudget / 100).toFixed(
        2
      )}.`,
      checks,
      amount,
      merchant,
      primaryCategory,
      mandateId,
      cartId,
      remainingBudget,
      remainingBudget
    );
  }
  checks.BUDGET_SUFFICIENT = {
    passed: true,
    message: `Sufficient remaining budget. Remaining before: $${(
      remainingBudget / 100
    ).toFixed(2)}, after: $${((remainingBudget - cart.totalAmount) / 100).toFixed(2)}.`,
  };

  // ALL CHECKS PASSED
  return {
    status: "ALLOWED",
    reason: "All spending policy checks passed successfully.",
    failedCheck: null,
    amount,
    merchant,
    category: primaryCategory,
    mandateId,
    cartId,
    remainingBudgetBefore: remainingBudget,
    remainingBudgetAfter: remainingBudget - cart.totalAmount,
    checks,
  };
}

function deny(
  failedCheck: PolicyCheckName,
  reason: string,
  checks: PolicyCheckResults,
  amount: number,
  merchant: string,
  category: string,
  mandateId: string | null,
  cartId: string | null,
  remainingBudgetBefore: number,
  remainingBudgetAfter: number
): PolicyDecision {
  return {
    status: "DENIED",
    reason,
    failedCheck,
    amount,
    merchant,
    category,
    mandateId,
    cartId,
    remainingBudgetBefore,
    remainingBudgetAfter,
    checks,
  };
}

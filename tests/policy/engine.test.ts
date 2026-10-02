import { describe, it, expect } from "vitest";
import { evaluateMandate } from "@/lib/policy/engine";
import { MandateEntity, CartEntity } from "@/lib/policy/types";

describe("Step 3: Deterministic Policy Engine Specification Tests", () => {
  const baseMandate: MandateEntity = {
    id: "mandate-test",
    name: "School Shopping",
    weeklyLimit: 4000, // $40.00
    spentAmount: 0,
    validFrom: new Date(Date.now() - 1000 * 60), // 1 min ago
    validUntil: new Date(Date.now() + 1000 * 60 * 60 * 24 * 7), // 7 days ahead
    status: "ACTIVE",
    allowedCategories: JSON.stringify(["School Supplies"]),
    allowedMerchants: JSON.stringify(["Campus Books", "Paper & Pencil"]),
  };

  const validCart: CartEntity = {
    id: "cart-valid",
    merchant: "Campus Books",
    totalAmount: 1800, // $18.00
    items: [
      {
        productId: "prod-notebook",
        quantity: 1,
        price: 1800,
        product: {
          id: "prod-notebook",
          name: "Notebook Bundle",
          price: 1800,
          merchant: "Campus Books",
          category: "School Supplies",
        },
      },
    ],
  };

  it("Case A: allows valid purchase when all criteria pass", () => {
    const decision = evaluateMandate(baseMandate, validCart);

    expect(decision.status).toBe("ALLOWED");
    expect(decision.failedCheck).toBeNull();
    expect(decision.amount).toBe(1800);
    expect(decision.remainingBudgetBefore).toBe(4000);
    expect(decision.remainingBudgetAfter).toBe(2200);
    expect(decision.checks.MANDATE_EXISTS.passed).toBe(true);
    expect(decision.checks.MANDATE_ACTIVE.passed).toBe(true);
    expect(decision.checks.MANDATE_NOT_REVOKED.passed).toBe(true);
    expect(decision.checks.MERCHANT_ALLOWED.passed).toBe(true);
    expect(decision.checks.CATEGORY_ALLOWED.passed).toBe(true);
    expect(decision.checks.AMOUNT_VALID.passed).toBe(true);
    expect(decision.checks.BUDGET_SUFFICIENT.passed).toBe(true);
  });

  it("denies missing mandate", () => {
    const decision = evaluateMandate(null, validCart);
    expect(decision.status).toBe("DENIED");
    expect(decision.failedCheck).toBe("MANDATE_EXISTS");
  });

  it("denies revoked mandate immediately", () => {
    const revokedMandate: MandateEntity = {
      ...baseMandate,
      status: "REVOKED",
    };
    const decision = evaluateMandate(revokedMandate, validCart);
    expect(decision.status).toBe("DENIED");
    expect(decision.failedCheck).toBe("MANDATE_NOT_REVOKED");
    expect(decision.checks.MANDATE_NOT_REVOKED.passed).toBe(false);
  });

  it("denies inactive mandate (e.g. status != ACTIVE)", () => {
    const inactiveMandate: MandateEntity = {
      ...baseMandate,
      status: "EXPIRED",
    };
    const decision = evaluateMandate(inactiveMandate, validCart);
    expect(decision.status).toBe("DENIED");
    expect(decision.failedCheck).toBe("MANDATE_ACTIVE");
  });

  it("denies expired mandate based on date boundaries", () => {
    const expiredMandate: MandateEntity = {
      ...baseMandate,
      validUntil: new Date(Date.now() - 1000), // In the past
    };
    const decision = evaluateMandate(expiredMandate, validCart);
    expect(decision.status).toBe("DENIED");
    expect(decision.failedCheck).toBe("MANDATE_ACTIVE");
    expect(decision.reason).toContain("expired");
  });

  it("denies missing or empty cart", () => {
    const decisionMissing = evaluateMandate(baseMandate, null);
    expect(decisionMissing.status).toBe("DENIED");
    expect(decisionMissing.failedCheck).toBe("CART_EXISTS");

    const emptyCart: CartEntity = {
      id: "empty",
      merchant: "Campus Books",
      totalAmount: 0,
      items: [],
    };
    const decisionEmpty = evaluateMandate(baseMandate, emptyCart);
    expect(decisionEmpty.status).toBe("DENIED");
    expect(decisionEmpty.failedCheck).toBe("CART_EXISTS");
  });

  it("Case B: denies unauthorized merchant", () => {
    const unauthorizedMerchantCart: CartEntity = {
      ...validCart,
      merchant: "Best Buy",
      items: [
        {
          ...validCart.items[0],
          product: {
            ...validCart.items[0].product,
            merchant: "Best Buy",
          },
        },
      ],
    };

    const decision = evaluateMandate(baseMandate, unauthorizedMerchantCart);
    expect(decision.status).toBe("DENIED");
    expect(decision.failedCheck).toBe("MERCHANT_ALLOWED");
    expect(decision.reason).toContain("Best Buy");
  });

  it("Case B: denies unauthorized category (e.g. $90 gaming headset, Electronics)", () => {
    const electronicsCart: CartEntity = {
      id: "cart-headset",
      merchant: "Campus Books",
      totalAmount: 9000,
      items: [
        {
          productId: "prod-headset",
          quantity: 1,
          price: 9000,
          product: {
            id: "prod-headset",
            name: "Gaming Headset",
            price: 9000,
            merchant: "Campus Books",
            category: "Electronics",
          },
        },
      ],
    };

    const decision = evaluateMandate(baseMandate, electronicsCart);
    expect(decision.status).toBe("DENIED");
    expect(decision.failedCheck).toBe("CATEGORY_ALLOWED");
    expect(decision.reason).toContain("Electronics");
  });

  it("denies zero or negative amount", () => {
    const zeroCart: CartEntity = {
      ...validCart,
      totalAmount: 0,
      items: [
        {
          ...validCart.items[0],
          price: 0,
          product: { ...validCart.items[0].product, price: 0 },
        },
      ],
    };
    const decisionZero = evaluateMandate(baseMandate, zeroCart);
    expect(decisionZero.status).toBe("DENIED");
    expect(decisionZero.failedCheck).toBe("AMOUNT_VALID");

    const negativeCart: CartEntity = {
      ...validCart,
      totalAmount: -500,
      items: [
        {
          ...validCart.items[0],
          price: -500,
          product: { ...validCart.items[0].product, price: -500 },
        },
      ],
    };
    const decisionNegative = evaluateMandate(baseMandate, negativeCart);
    expect(decisionNegative.status).toBe("DENIED");
    expect(decisionNegative.failedCheck).toBe("AMOUNT_VALID");
  });

  it("denies purchase when item prices do not sum to cart total (client price tampering)", () => {
    const tamperedCart: CartEntity = {
      ...validCart,
      totalAmount: 500, // Claiming it is $5.00
      items: [
        {
          ...validCart.items[0],
          product: {
            ...validCart.items[0].product,
            price: 1800, // Authoritative price is $18.00
          },
        },
      ],
    };

    const decision = evaluateMandate(baseMandate, tamperedCart);
    expect(decision.status).toBe("DENIED");
    expect(decision.failedCheck).toBe("AMOUNT_VALID");
    expect(decision.reason).toContain("mismatch");
  });

  it("Case C: denies when remaining budget is insufficient", () => {
    // Spent $18.00 previously out of $40.00 -> $22.00 remaining
    const partiallySpentMandate: MandateEntity = {
      ...baseMandate,
      spentAmount: 1800,
    };

    // Attempt $25.00 purchase (2500 cents)
    const cart25: CartEntity = {
      id: "cart-25",
      merchant: "Campus Books",
      totalAmount: 2500,
      items: [
        {
          productId: "prod-25",
          quantity: 1,
          price: 2500,
          product: {
            id: "prod-25",
            name: "Deluxe Notebook",
            price: 2500,
            merchant: "Campus Books",
            category: "School Supplies",
          },
        },
      ],
    };

    const decision = evaluateMandate(partiallySpentMandate, cart25);
    expect(decision.status).toBe("DENIED");
    expect(decision.failedCheck).toBe("BUDGET_SUFFICIENT");
    expect(decision.remainingBudgetBefore).toBe(2200);
    expect(decision.reason).toContain("exceeds remaining mandate budget");
  });

  it("Specification Boundary Rule: $22 remaining + $22 purchase = ALLOWED; $22 remaining + $22.01 purchase = DENIED", () => {
    const partiallySpentMandate: MandateEntity = {
      ...baseMandate,
      weeklyLimit: 4000,
      spentAmount: 1800, // Remaining: 2200 cents ($22.00)
    };

    // Exact Boundary: $22.00 purchase (2200 cents)
    const exactBoundaryCart: CartEntity = {
      id: "cart-exact",
      merchant: "Campus Books",
      totalAmount: 2200,
      items: [
        {
          productId: "prod-22",
          quantity: 1,
          price: 2200,
          product: {
            id: "prod-22",
            name: "Exact Item",
            price: 2200,
            merchant: "Campus Books",
            category: "School Supplies",
          },
        },
      ],
    };

    const decisionAllowed = evaluateMandate(partiallySpentMandate, exactBoundaryCart);
    expect(decisionAllowed.status).toBe("ALLOWED");
    expect(decisionAllowed.remainingBudgetBefore).toBe(2200);
    expect(decisionAllowed.remainingBudgetAfter).toBe(0);

    // Over Boundary by 1 cent: $22.01 purchase (2201 cents)
    const overBoundaryCart: CartEntity = {
      id: "cart-over",
      merchant: "Campus Books",
      totalAmount: 2201,
      items: [
        {
          productId: "prod-2201",
          quantity: 1,
          price: 2201,
          product: {
            id: "prod-2201",
            name: "Over Item",
            price: 2201,
            merchant: "Campus Books",
            category: "School Supplies",
          },
        },
      ],
    };

    const decisionDenied = evaluateMandate(partiallySpentMandate, overBoundaryCart);
    expect(decisionDenied.status).toBe("DENIED");
    expect(decisionDenied.failedCheck).toBe("BUDGET_SUFFICIENT");
  });
});

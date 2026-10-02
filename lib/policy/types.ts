export type PolicyCheckName =
  | "MANDATE_EXISTS"
  | "MANDATE_ACTIVE"
  | "MANDATE_NOT_REVOKED"
  | "CART_EXISTS"
  | "MERCHANT_ALLOWED"
  | "CATEGORY_ALLOWED"
  | "AMOUNT_VALID"
  | "BUDGET_SUFFICIENT";

export interface PolicyCheckDetail {
  passed: boolean;
  message: string;
}

export type PolicyCheckResults = Record<PolicyCheckName, PolicyCheckDetail>;

export interface PolicyDecision {
  status: "ALLOWED" | "DENIED";
  reason: string;
  failedCheck: PolicyCheckName | null;
  amount: number; // Integer cents
  merchant: string;
  category: string;
  mandateId: string | null;
  cartId: string | null;
  remainingBudgetBefore: number; // Integer cents
  remainingBudgetAfter: number; // Integer cents
  checks: PolicyCheckResults;
}

export interface MandateEntity {
  id: string;
  name: string;
  weeklyLimit: number;
  spentAmount: number;
  validFrom: Date | string;
  validUntil: Date | string;
  status: string; // ACTIVE | REVOKED | EXPIRED
  allowedCategories: string; // JSON string
  allowedMerchants: string; // JSON string
}

export interface ProductEntity {
  id: string;
  name: string;
  price: number;
  merchant: string;
  category: string;
}

export interface CartItemEntity {
  id?: string;
  productId: string;
  quantity: number;
  price: number;
  product: ProductEntity;
}

export interface CartEntity {
  id: string;
  merchant: string;
  totalAmount: number;
  items: CartItemEntity[];
}

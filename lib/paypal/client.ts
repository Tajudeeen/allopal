import { env } from "@/lib/env";
import { centsToPayPalAmount } from "./money";

interface CreateOrderOptions {
  amountInCents: number;
  currency?: string;
  referenceId?: string;
  description?: string;
  requestId?: string;
  returnUrl?: string;
  cancelUrl?: string;
}

interface PayPalOrderResponse {
  id: string;
  status: string;
  links?: Array<{ href: string; rel: string; method: string }>;
  approvalUrl?: string;
  requiresPayerApproval: boolean;
}

interface PayPalCaptureResponse {
  id: string; // Capture ID
  status: string;
  orderId?: string;
  rawResponse?: Record<string, unknown>;
}

export class PayPalClient {
  private clientId: string;
  private clientSecret: string;
  private baseUrl: string;
  private cachedAccessToken: string | null = null;
  private tokenExpiresAt: number = 0;

  constructor(
    clientId = env.PAYPAL_CLIENT_ID,
    clientSecret = env.PAYPAL_CLIENT_SECRET,
    baseUrl = env.PAYPAL_API_BASE_URL
  ) {
    this.clientId = clientId;
    this.clientSecret = clientSecret;
    this.baseUrl = baseUrl.replace(/\/$/, "");
  }

  private isMock(): boolean {
    return (
      this.clientId.startsWith("mock_") ||
      this.clientSecret.startsWith("mock_") ||
      process.env.NODE_ENV === "test"
    );
  }

  /**
   * Retrieves or refreshes OAuth2 Bearer token from PayPal Sandbox
   */
  async getAccessToken(): Promise<string> {
    if (this.isMock()) {
      return "mock_sandbox_access_token";
    }

    const now = Date.now();
    if (this.cachedAccessToken && this.tokenExpiresAt > now + 60000) {
      return this.cachedAccessToken;
    }

    const auth = Buffer.from(`${this.clientId}:${this.clientSecret}`).toString("base64");
    const response = await fetch(`${this.baseUrl}/v1/oauth2/token`, {
      method: "POST",
      headers: {
        Authorization: `Basic ${auth}`,
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: "grant_type=client_credentials",
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`PayPal OAuth failed (${response.status}): ${errorText}`);
    }

    const data = await response.json();
    this.cachedAccessToken = data.access_token;
    this.tokenExpiresAt = now + data.expires_in * 1000;
    return this.cachedAccessToken!;
  }

  /**
   * Creates a PayPal Order with intent CAPTURE
   */
  async createOrder(options: CreateOrderOptions): Promise<PayPalOrderResponse> {
    const amountStr = centsToPayPalAmount(options.amountInCents);
    const currency = options.currency || "USD";

    if (this.isMock()) {
      // Deterministic realistic sandbox mock order ID for testing
      const mockOrderId = `PAYPAL-SANDBOX-ORD-${Math.random().toString(36).substring(2, 9).toUpperCase()}`;
      return {
        id: mockOrderId,
        status: "CREATED",
        links: [
          {
            href: `${this.baseUrl}/checkoutnow?token=${mockOrderId}`,
            rel: "approve",
            method: "GET",
          },
        ],
        approvalUrl: `${this.baseUrl}/checkoutnow?token=${mockOrderId}`,
        requiresPayerApproval: false,
      };
    }

    const token = await this.getAccessToken();
    const payload = {
      intent: "CAPTURE",
      purchase_units: [
        {
          reference_id: options.referenceId || "default",
          description: options.description || "Allopal Agentic Spending Mandate Order",
          amount: {
            currency_code: currency,
            value: amountStr,
          },
        },
      ],
      payment_source: {
        paypal: {
          experience_context: {
            payment_method_preference: "IMMEDIATE_PAYMENT_REQUIRED",
            user_action: "PAY_NOW",
            return_url: options.returnUrl,
            cancel_url: options.cancelUrl,
          },
        },
      },
    };

    const headers: Record<string, string> = {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    };
    if (options.requestId) headers["PayPal-Request-Id"] = options.requestId;

    const response = await fetch(`${this.baseUrl}/v2/checkout/orders`, {
      method: "POST",
      headers,
      body: JSON.stringify(payload),
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`PayPal createOrder failed (${response.status}): ${errorText}`);
    }

    const data = await response.json();
    const approvalUrl = data.links?.find(
      (link: { rel?: string }) => link.rel === "approve" || link.rel === "payer-action"
    )?.href;

    return {
      id: data.id,
      status: data.status,
      links: data.links,
      approvalUrl,
      requiresPayerApproval: true,
    };
  }

  /**
   * Captures payment for an authorized PayPal Order
   */
  async captureOrder(orderId: string, requestId?: string): Promise<PayPalCaptureResponse> {
    if (this.isMock()) {
      const mockCaptureId = `PAYPAL-SANDBOX-CAP-${Math.random().toString(36).substring(2, 9).toUpperCase()}`;
      return {
        id: mockCaptureId,
        status: "COMPLETED",
        orderId,
        rawResponse: {
          id: orderId,
          status: "COMPLETED",
          capture_id: mockCaptureId,
          simulated: true,
        },
      };
    }

    const token = await this.getAccessToken();
    const headers: Record<string, string> = {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    };
    if (requestId) headers["PayPal-Request-Id"] = requestId;

    const response = await fetch(`${this.baseUrl}/v2/checkout/orders/${orderId}/capture`, {
      method: "POST",
      headers,
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`PayPal captureOrder failed (${response.status}): ${errorText}`);
    }

    const data = await response.json();
    const captureDetails = data.purchase_units?.[0]?.payments?.captures?.[0];

    return {
      id: captureDetails?.id || data.id,
      status: data.status,
      orderId,
      rawResponse: data,
    };
  async getOrder(orderId: string): Promise<{ id: string; status: string }> {
    if (this.isMock()) {
      return { id: orderId, status: "COMPLETED" };
    }

    const token = await this.getAccessToken();
    const response = await fetch(`${this.baseUrl}/v2/checkout/orders/${orderId}`, {
      method: "GET",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`PayPal getOrder failed (${response.status}): ${errorText}`);
    }

    const data = await response.json();
    return { id: data.id, status: data.status };
  }
}

export const payPalClient = new PayPalClient();

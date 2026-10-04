import { env, requirePayPalConfig } from "@/lib/env";
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
  id: string;
  status: string;
  orderId?: string;
  rawResponse?: Record<string, unknown>;
}

export class PayPalApiError extends Error {
  readonly statusCode: number;
  readonly rawBody: string;

  constructor(operation: string, statusCode: number, rawBody: string) {
    super(`PayPal ${operation} failed (${statusCode}): ${rawBody}`);
    this.name = "PayPalApiError";
    this.statusCode = statusCode;
    this.rawBody = rawBody;
  }
}

export class PayPalClient {
  private clientId: string | undefined;
  private clientSecret: string | undefined;
  private baseUrl: string;
  private cachedAccessToken: string | null = null;
  private tokenExpiresAt = 0;

  constructor(
    clientId = env.PAYPAL_CLIENT_ID,
    clientSecret = env.PAYPAL_CLIENT_SECRET,
    baseUrl = env.PAYPAL_API_BASE_URL
  ) {
    this.clientId = clientId;
    this.clientSecret = clientSecret;
    this.baseUrl = baseUrl.replace(/\/$/, "");
  }

  async getAccessToken(): Promise<string> {
    const config =
      this.clientId && this.clientSecret
        ? {
            clientId: this.clientId,
            clientSecret: this.clientSecret,
            baseUrl: this.baseUrl,
          }
        : requirePayPalConfig();

    const now = Date.now();
    if (this.cachedAccessToken && this.tokenExpiresAt > now + 60_000) {
      return this.cachedAccessToken;
    }

    const auth = Buffer.from(
      `${config.clientId}:${config.clientSecret}`
    ).toString("base64");

    const response = await fetch(`${config.baseUrl}/v1/oauth2/token`, {
      method: "POST",
      headers: {
        Authorization: `Basic ${auth}`,
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: "grant_type=client_credentials",
    });

    if (!response.ok) {
      throw new PayPalApiError("OAuth", response.status, await response.text());
    }

    const data = await response.json();
    if (
      typeof data.access_token !== "string" ||
      typeof data.expires_in !== "number"
    ) {
      throw new Error("PayPal OAuth returned an invalid token response.");
    }

    this.cachedAccessToken = data.access_token;
    this.tokenExpiresAt = now + data.expires_in * 1000;
    return data.access_token;
  }

  async createOrder(options: CreateOrderOptions): Promise<PayPalOrderResponse> {
    const amountStr = centsToPayPalAmount(options.amountInCents);
    const currency = options.currency || "USD";
    const token = await this.getAccessToken();

    const payload = {
      intent: "CAPTURE",
      purchase_units: [
        {
          reference_id: options.referenceId || "default",
          description:
            options.description ||
            "Allopal Agentic Spending Mandate Order",
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

    if (options.requestId) {
      headers["PayPal-Request-Id"] = options.requestId;
    }

    const response = await fetch(`${this.baseUrl}/v2/checkout/orders`, {
      method: "POST",
      headers,
      body: JSON.stringify(payload),
    });

    if (!response.ok) {
      throw new PayPalApiError(
        "createOrder",
        response.status,
        await response.text()
      );
    }

    const data = await response.json();

    if (typeof data.id !== "string" || typeof data.status !== "string") {
      throw new Error("PayPal createOrder returned an invalid order response.");
    }

    const approvalUrl = data.links?.find(
      (link: { rel?: string; href?: string }) =>
        (link.rel === "approve" || link.rel === "payer-action") &&
        typeof link.href === "string"
    )?.href;

    return {
      id: data.id,
      status: data.status,
      links: data.links,
      approvalUrl,
      requiresPayerApproval: true,
    };
  }

  async captureOrder(
    orderId: string,
    requestId?: string
  ): Promise<PayPalCaptureResponse> {
    const token = await this.getAccessToken();

    const headers: Record<string, string> = {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    };

    if (requestId) {
      headers["PayPal-Request-Id"] = requestId;
    }

    const response = await fetch(
      `${this.baseUrl}/v2/checkout/orders/${orderId}/capture`,
      {
        method: "POST",
        headers,
      }
    );

    if (!response.ok) {
      throw new PayPalApiError(
        "captureOrder",
        response.status,
        await response.text()
      );
    }

    const data = await response.json();
    const captureDetails =
      data.purchase_units?.[0]?.payments?.captures?.[0];

    if (typeof data.status !== "string") {
      throw new Error("PayPal captureOrder returned an invalid response.");
    }

    return {
      id: captureDetails?.id || data.id,
      status: data.status,
      orderId,
      rawResponse: data,
    };
  }

  async getOrder(orderId: string): Promise<{ id: string; status: string }> {
    const token = await this.getAccessToken();

    const response = await fetch(
      `${this.baseUrl}/v2/checkout/orders/${orderId}`,
      {
        method: "GET",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
      }
    );

    if (!response.ok) {
      throw new PayPalApiError(
        "getOrder",
        response.status,
        await response.text()
      );
    }

    const data = await response.json();

    if (typeof data.id !== "string" || typeof data.status !== "string") {
      throw new Error("PayPal getOrder returned an invalid response.");
    }

    return { id: data.id, status: data.status };
  }
}

export const payPalClient = new PayPalClient();

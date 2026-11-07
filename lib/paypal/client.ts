import { env, requirePayPalConfig, requireWebhookId, ProviderConfigurationError } from "@/lib/env";
import { centsToPayPalAmount, payPalAmountToCents } from "./money";

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
  amountInCents?: number;
  currency?: string;
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
  private tokenRequest: Promise<string> | null = null;

  constructor(
    clientId = env.PAYPAL_CLIENT_ID,
    clientSecret = env.PAYPAL_CLIENT_SECRET,
    baseUrl = env.PAYPAL_API_BASE_URL,
  ) {
    this.clientId = clientId;
    this.clientSecret = clientSecret;
    this.baseUrl = baseUrl.replace(/\/$/, "");
    if (
      !["https://api-m.sandbox.paypal.com", "https://api-m.paypal.com"].includes(
        this.baseUrl,
      )
    ) {
      throw new ProviderConfigurationError(
        "PAYPAL_ORIGIN_UNSUPPORTED: use an official PayPal API origin.",
      );
    }
  }

  async getAccessToken(): Promise<string> {
    if (this.cachedAccessToken && this.tokenExpiresAt > Date.now() + 60_000) {
      return this.cachedAccessToken;
    }
    // Concurrent order/recovery requests share one refresh, including failures.
    // Clear the settled promise so a failed refresh can be retried safely.
    if (!this.tokenRequest) {
      this.tokenRequest = this.refreshAccessToken().finally(() => {
        this.tokenRequest = null;
      });
    }
    return this.tokenRequest;
  }

  private async refreshAccessToken(): Promise<string> {
    const config =
      this.clientId && this.clientSecret
        ? {
            clientId: this.clientId,
            clientSecret: this.clientSecret,
            baseUrl: this.baseUrl,
          }
        : requirePayPalConfig();

    const now = Date.now();
    const auth = Buffer.from(
      `${config.clientId}:${config.clientSecret}`,
    ).toString("base64");

    const response = await fetch(`${config.baseUrl}/v1/oauth2/token`, {
      redirect: "error",
      signal: AbortSignal.timeout(15_000),
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
      !data.access_token.trim() ||
      typeof data.expires_in !== "number" ||
      !Number.isFinite(data.expires_in) ||
      data.expires_in <= 0 ||
      !Number.isSafeInteger(now + data.expires_in * 1000)
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
            options.description || "Allopal Agentic Spending Mandate Order",
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
      redirect: "error",
      signal: AbortSignal.timeout(15_000),
      method: "POST",
      headers,
      body: JSON.stringify(payload),
    });

    if (!response.ok) {
      throw new PayPalApiError(
        "createOrder",
        response.status,
        await response.text(),
      );
    }

    const data = await response.json();

    if (typeof data.id !== "string" || typeof data.status !== "string") {
      throw new Error("PayPal createOrder returned an invalid order response.");
    }

    const approvalUrl = data.links?.find(
      (link: { rel?: string; href?: string }) =>
        (link.rel === "approve" || link.rel === "payer-action") &&
        typeof link.href === "string",
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
    requestId?: string,
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
        redirect: "error",
        signal: AbortSignal.timeout(15_000),
        method: "POST",
        headers,
      },
    );

    if (!response.ok) {
      throw new PayPalApiError(
        "captureOrder",
        response.status,
        await response.text(),
      );
    }

    const data = await response.json();
    const captureDetails = data.purchase_units?.[0]?.payments?.captures?.[0];

    if (typeof data.status !== "string") {
      throw new Error("PayPal captureOrder returned an invalid response.");
    }

    if (
      !captureDetails?.id ||
      !captureDetails?.status ||
      !captureDetails?.amount
    ) {
      throw new Error(
        "PayPal capture response has no verifiable capture details.",
      );
    }
    return {
      id: captureDetails.id,
      status: captureDetails.status,
      amountInCents: payPalAmountToCents(captureDetails.amount.value),
      currency: captureDetails.amount.currency_code,
      orderId,
      rawResponse: data,
    };
  }

  async getOrder(
    orderId: string,
  ): Promise<{
    id: string;
    status: string;
    captureId?: string;
    captureStatus?: string;
    amountInCents?: number;
    currency?: string;
  }> {
    const token = await this.getAccessToken();

    const response = await fetch(
      `${this.baseUrl}/v2/checkout/orders/${orderId}`,
      {
        redirect: "error",
        signal: AbortSignal.timeout(15_000),
        method: "GET",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
      },
    );

    if (!response.ok) {
      throw new PayPalApiError(
        "getOrder",
        response.status,
        await response.text(),
      );
    }

    const data = await response.json();

    if (typeof data.id !== "string" || typeof data.status !== "string") {
      throw new Error("PayPal getOrder returned an invalid response.");
    }

    const capture = data.purchase_units?.[0]?.payments?.captures?.[0];
    return {
      id: data.id,
      status: data.status,
      captureId: capture?.id,
      captureStatus: capture?.status,
      amountInCents: capture?.amount?.value
        ? payPalAmountToCents(capture.amount.value)
        : undefined,
      currency: capture?.amount?.currency_code,
    };
  }

  async verifyWebhook(headers: Headers, event: unknown): Promise<boolean> {
    const webhookId = requireWebhookId();
    const fields = [
      "auth-algo",
      "cert-url",
      "transmission-id",
      "transmission-sig",
      "transmission-time",
    ];
    if (fields.some((field) => !headers.get(`paypal-${field}`))) return false;
    const response = await fetch(
      `${this.baseUrl}/v1/notifications/verify-webhook-signature`,
      {
        redirect: "error",
        method: "POST",
        signal: AbortSignal.timeout(15_000),
        headers: {
          Authorization: `Bearer ${await this.getAccessToken()}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          auth_algo: headers.get("paypal-auth-algo"),
          cert_url: headers.get("paypal-cert-url"),
          transmission_id: headers.get("paypal-transmission-id"),
          transmission_sig: headers.get("paypal-transmission-sig"),
          transmission_time: headers.get("paypal-transmission-time"),
          webhook_id: webhookId,
          webhook_event: event,
        }),
      },
    );
    if (!response.ok)
      throw new PayPalApiError(
        "verifyWebhook",
        response.status,
        "Signature verification unavailable",
      );
    return (await response.json()).verification_status === "SUCCESS";
  }
}

export const payPalClient = new PayPalClient();


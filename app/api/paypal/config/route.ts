import { NextResponse } from "next/server";
import { requirePayPalConfig } from "@/lib/env";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const config = requirePayPalConfig();
    const sandbox = config.baseUrl.includes("sandbox");

    return NextResponse.json({
      clientId: config.clientId,
      environment: sandbox ? "sandbox" : "production",
      sdkUrl: sandbox
        ? "https://www.sandbox.paypal.com/web-sdk/v6/core"
        : "https://www.paypal.com/web-sdk/v6/core",
    });
  } catch (error: unknown) {
    const message =
      error instanceof Error ? error.message : "PayPal is not configured.";

    return NextResponse.json(
      {
        error: "PAYPAL_NOT_CONFIGURED",
        message,
      },
      { status: 503 }
    );
  }
}

import { NextRequest, NextResponse } from "next/server";
import { requireWorkspace, accessResponse } from "@/lib/security/access";
import { getSpendingReport } from "@/lib/analytics/report";
import { env } from "@/lib/env";
export const dynamic = "force-dynamic";
export async function GET(req: NextRequest) {
  try {
    const workspaceId = await requireWorkspace(req);
    return NextResponse.json(
      {
        ...(await getSpendingReport(workspaceId)),
        availability: {
          ai: Boolean(env.AI_API_KEY),
          paypal: Boolean(env.PAYPAL_CLIENT_ID && env.PAYPAL_CLIENT_SECRET),
          sandbox: env.PAYPAL_API_BASE_URL.includes("sandbox"),
          webhook: Boolean(process.env.PAYPAL_WEBHOOK_ID),
        },
      },
      { headers: { "Cache-Control": "private, no-store" } },
    );
  } catch (error) {
    return accessResponse(error);
  }
}

import { NextRequest, NextResponse } from "next/server";
import { reconcileBatch } from "@/lib/payments/lifecycle";
import { sameSecret } from "@/lib/security/access";
export const dynamic = "force-dynamic";
export async function POST(req: NextRequest) {
  const secret = process.env.RECONCILE_TOKEN;
  if (
    !secret ||
    !sameSecret(req.headers.get("authorization") || "", `Bearer ${secret}`)
  )
    return NextResponse.json({ error: "UNAUTHORIZED" }, { status: 401 });
  return NextResponse.json({ checked: await reconcileBatch() });
}

import { NextRequest, NextResponse } from "next/server";
import { requireWorkspace, accessResponse } from "@/lib/security/access";
import { reconcileBatch } from "@/lib/payments/lifecycle";
export const dynamic = "force-dynamic";
export async function POST(req: NextRequest) {
  try {
    return NextResponse.json({
      checked: await reconcileBatch(await requireWorkspace(req)),
    });
  } catch (error) {
    return accessResponse(error);
  }
}

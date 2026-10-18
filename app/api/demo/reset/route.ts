import { NextRequest, NextResponse } from "next/server";
import { seed } from "@/prisma/seed";
import { requireWorkspace, accessResponse } from "@/lib/security/access";
export const dynamic = "force-dynamic";
export async function POST(req: NextRequest) {
  try {
    await seed(await requireWorkspace(req), true);
    return NextResponse.json({
      status: "RESET_COMPLETED",
      message: "Your demo workspace has been reset.",
    });
  } catch (error) {
    if (
      error instanceof Error &&
      error.message === "PENDING_PAYMENTS_PREVENT_RESET"
    )
      return NextResponse.json(
        {
          error: error.message,
          message: "Resolve pending payments before resetting your workspace.",
        },
        { status: 409 },
      );
    return accessResponse(error);
  }
}

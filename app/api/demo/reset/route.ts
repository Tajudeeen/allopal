import { NextResponse } from "next/server";
import { seed } from "@/prisma/seed";

export const dynamic = "force-dynamic";

export async function POST() {
  try {
    await seed();
    return NextResponse.json({
      status: "RESET_COMPLETED",
      message: "Database successfully reset to deterministic hackathon demo state.",
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Reset failed";
    return NextResponse.json({ error: "RESET_FAILED", message }, { status: 500 });
  }
}

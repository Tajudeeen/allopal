import { NextResponse } from "next/server";
import { prisma } from "@/lib/db/prisma";
export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const count = await prisma.systemHealth.count();
    return NextResponse.json({
      status: "HEALTHY",
      database: "CONNECTED",
      healthRecords: count,
      timestamp: new Date().toISOString(),
    });
  } catch (error: unknown) {
    const message = "Database unavailable";
    return NextResponse.json(
      {
        status: "UNHEALTHY",
        database: "DISCONNECTED",
        error: message,
      },
      { status: 500 },
    );
  }
}

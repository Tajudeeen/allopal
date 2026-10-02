import { NextResponse } from "next/server";
import { prisma } from "@/lib/db/prisma";

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
    const message = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json(
      {
        status: "UNHEALTHY",
        database: "DISCONNECTED",
        error: message,
      },
      { status: 500 }
    );
  }
}

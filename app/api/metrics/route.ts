import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db/prisma";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  try {
    const [
      activeMandates,
      allowedDecisions,
      deniedDecisions,
      completedPayments,
      pendingPayments,
      failedPayments,
    ] = await Promise.all([
      prisma.mandate.count({ where: { status: "ACTIVE" } }),
      prisma.decision.count({ where: { status: "ALLOWED" } }),
      prisma.decision.count({ where: { status: "DENIED" } }),
      prisma.payPalTransaction.count({ where: { status: "COMPLETED" } }),
      prisma.payPalTransaction.count({
        where: {
          status: { in: ["CREATING", "CREATED", "CAPTURING", "UNKNOWN_CREATE"] },
        },
      }),
      prisma.payPalTransaction.count({ where: { status: "FAILED" } }),
    ]);

    const accept = req.headers.get("accept") || "";
    if (accept.includes("application/json")) {
      return NextResponse.json({
        mandates: { active: activeMandates },
        decisions: { allowed: allowedDecisions, denied: deniedDecisions },
        payments: {
          completed: completedPayments,
          pending: pendingPayments,
          failed: failedPayments,
        },
        uptime: process.uptime(),
      });
    }

    const lines = [
      "# HELP allopal_mandates_active Active spending mandates",
      "# TYPE allopal_mandates_active gauge",
      `allopal_mandates_active ${activeMandates}`,
      "",
      "# HELP allopal_policy_decisions_total Total policy checks evaluated",
      "# TYPE allopal_policy_decisions_total counter",
      `allopal_policy_decisions_total{status="ALLOWED"} ${allowedDecisions}`,
      `allopal_policy_decisions_total{status="DENIED"} ${deniedDecisions}`,
      "",
      "# HELP allopal_payments_total Total PayPal payment lifecycle executions",
      "# TYPE allopal_payments_total counter",
      `allopal_payments_total{status="COMPLETED"} ${completedPayments}`,
      `allopal_payments_total{status="PENDING"} ${pendingPayments}`,
      `allopal_payments_total{status="FAILED"} ${failedPayments}`,
      "",
      "# HELP allopal_process_uptime_seconds Process uptime in seconds",
      "# TYPE allopal_process_uptime_seconds gauge",
      `allopal_process_uptime_seconds ${Math.floor(process.uptime())}`,
      "",
    ];

    return new Response(lines.join("\n"), {
      status: 200,
      headers: {
        "Content-Type": "text/plain; version=0.0.4; charset=utf-8",
      },
    });
  } catch (error) {
    return new Response(
      `# Error calculating metrics: ${error instanceof Error ? error.message : "unknown"}\n`,
      { status: 500, headers: { "Content-Type": "text/plain" } },
    );
  }
}

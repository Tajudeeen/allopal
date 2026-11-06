import { prisma } from "@/lib/db/prisma";

export const REPORT_ROW_LIMIT = 500;
const closed = new Set(["COMPLETED", "REFUNDED", "REVERSED"]);

/** Select only data safe for browser analytics and the read-only model. */
function decisionStats(workspaceId: string) {
  return prisma.decision.groupBy({
    by: ["status"],
    where: { mandate: { workspaceId } },
    _count: { _all: true },
  });
}
function paymentStats(workspaceId: string) {
  return prisma.payPalTransaction.groupBy({
    by: ["currency", "status", "reservationReleased"],
    where: { mandate: { workspaceId } },
    _count: { _all: true },
    _sum: { amount: true },
  });
}
export async function getSpendingReport(workspaceId: string) {
  const [
    mandate,
    decisions,
    payments,
    decisionGroups,
    paymentGroups,
    decisionCount,
    paymentCount,
  ] = await prisma.$transaction([
    prisma.mandate.findFirst({
      where: { workspaceId },
      orderBy: { createdAt: "desc" },
      select: {
        name: true,
        status: true,
        weeklyLimit: true,
        spentAmount: true,
        validUntil: true,
      },
    }),
    prisma.decision.findMany({
      where: { mandate: { workspaceId } },
      orderBy: [{ createdAt: "desc" }, { id: "desc" }],
      take: REPORT_ROW_LIMIT,
      select: {
        id: true,
        createdAt: true,
        amount: true,
        merchant: true,
        category: true,
        status: true,
        reason: true,
      },
    }),
    prisma.payPalTransaction.findMany({
      where: { mandate: { workspaceId } },
      orderBy: [{ createdAt: "desc" }, { id: "desc" }],
      take: REPORT_ROW_LIMIT,
      select: {
        id: true,
        decisionId: true,
        createdAt: true,
        updatedAt: true,
        amount: true,
        currency: true,
        status: true,
        reservationReleased: true,
        providerCalled: true,
        captureId: true,
      },
    }),
    decisionStats(workspaceId),
    paymentStats(workspaceId),
    prisma.decision.count({ where: { mandate: { workspaceId } } }),
    prisma.payPalTransaction.count({ where: { mandate: { workspaceId } } }),
  ]);
  const currencies: Record<
    string,
    {
      captured: number;
      reserved: number;
      refunded: number;
      reversed: number;
      review: number;
    }
  > = {};
  for (const group of paymentGroups) {
    const totals = (currencies[group.currency] ||= {
      captured: 0,
      reserved: 0,
      refunded: 0,
      reversed: 0,
      review: 0,
    });
    const amount = group._sum.amount ?? 0;
    if (group.status === "COMPLETED") totals.captured += amount;
    if (!group.reservationReleased && !closed.has(group.status))
      totals.reserved += amount;
    if (group.status === "REFUNDED") totals.refunded += amount;
    if (group.status === "REVERSED") totals.reversed += amount;
    if (group.status === "REVIEW_REQUIRED") totals.review += group._count._all;
  }
  return {
    generatedAt: new Date().toISOString(),
    scope:
      "Current demo workspace. Totals include all records. Tables contain the latest 500 of each type.",
    mandate: mandate
      ? {
          ...mandate,
          validUntil: mandate.validUntil.toISOString(),
          remaining: Math.max(0, mandate.weeklyLimit - mandate.spentAmount),
        }
      : null,
    summary: {
      decisionCount,
      paymentCount,
      deniedCount:
        decisionGroups.find((g) => g.status === "DENIED")?._count._all ?? 0,
      currencies,
    },
    decisions: decisions.map((d) => ({
      ...d,
      createdAt: d.createdAt.toISOString(),
    })),
    payments: payments.map((p) => ({
      ...p,
      createdAt: p.createdAt.toISOString(),
      updatedAt: p.updatedAt.toISOString(),
      captured: p.status === "COMPLETED" && Boolean(p.captureId),
      reserved: !p.reservationReleased && !closed.has(p.status),
    })),
    truncated:
      decisions.length < decisionCount || payments.length < paymentCount,
    notes: [
      "Amounts are integer cents. Currency totals are separate.",
      "A policy allowance is not a captured payment. Repeated denials are not money saved.",
      "Reserved funds include uncertain payments and review holds. Refunded/reversed payments do not automatically restore mandate authority.",
      "The mandate card shows the latest mandate only. Historical activity may include earlier mandates.",
    ],
  };
}
export type SpendingReport = Awaited<ReturnType<typeof getSpendingReport>>;

"use client";

import { createContext, useContext, useEffect, useMemo, useState } from "react";
import { AgStudio, createWidgets } from "ag-studio-react";
import type { AgWidgetDefinition, AgRegistry } from "ag-studio-react";
import {
  AgStudioLicenseManager,
  studioTheme,
  createAiHarness,
  AgStudioAiModule,
} from "ag-studio";
import type {
  AgDefaultRegistry,
  AgReportState,
  AgWidgetData,
  AgWidgetDataFormat,
  AgWidgetsConfig,
  AgAiHarnessSetup,
  AgDataSourcesDefinition,
} from "ag-studio";
import type { AnalyticsResponse } from "@/lib/analytics/types";
import { spendingAnalyst } from "@/lib/analytics/studio-agent";

const license = process.env.NEXT_PUBLIC_AG_STUDIO_LICENSE_KEY;
if (license) AgStudioLicenseManager.setLicenseKey(license);
const ReportContext = createContext<AnalyticsResponse | null>(null);
const aiModules = [AgStudioAiModule];
type HealthData = AgWidgetData<
  Record<string, never>,
  AgWidgetDataFormat<Record<string, never>>
> & { type: "mandate-health" };
interface Registry extends AgRegistry {
  widgets: [
    ...AgDefaultRegistry["widgets"],
    AgWidgetDefinition<"mandate-health", HealthData>,
  ];
  formats: AgDefaultRegistry["formats"];
  buckets: AgDefaultRegistry["buckets"];
}
const money = (cents: number) =>
  new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(
    cents / 100,
  );
function MandateHealth() {
  const mandate = useContext(ReportContext)?.mandate;
  const used = mandate
    ? Math.min(
        100,
        (mandate.spentAmount / Math.max(1, mandate.weeklyLimit)) * 100,
      )
    : 0;
  return (
    <div className="flex h-full flex-col justify-center gap-3 p-5 text-slate-950">
      <p className="text-xs font-semibold uppercase tracking-wider text-blue-700">
        Latest mandate
      </p>
      <p className="text-xl font-semibold">
        {mandate?.name ?? "No mandate locked"}
      </p>
      <p className="text-3xl font-semibold">
        {money(mandate?.remaining ?? 0)}{" "}
        <span className="text-sm font-normal text-slate-600">remaining</span>
      </p>
      <progress
        aria-label="Mandate budget committed"
        value={used}
        max={100}
        className="h-2 w-full accent-blue-600"
      />
      <p className="text-xs leading-5 text-slate-600">
        {mandate?.status ?? "No authority"}. Committed funds include captures
        and unresolved holds. The remaining balance alone does not authorize a
        purchase.
      </p>
    </div>
  );
}
const widgets: AgWidgetsConfig<Registry> = createWidgets<Registry>({
  additionalTypes: [
    {
      id: "mandate-health",
      label: "Allopal mandate health",
      comp: MandateHealth,
      dataMapping: {},
      form: (params) => params.createDefaults({ dataMappingItems: [] }),
      defaultSize: { width: 450, height: 270 },
      minSize: { width: 250, height: 220 },
    },
  ],
  menu: [
    ...createWidgets({}).menu.map(group => ({ label: group.label, widgetIds: [...group.widgetIds], collapsed: group.collapsed })),
    { label: "Allopal", widgetIds: ["mandate-health"] },
  ],
});
const theme = studioTheme.withParams({
  accentColor: "#1f4fe0",
  backgroundColor: "#f8fafc",
  foregroundColor: "#0f172a",
  fontFamily: "Arial, sans-serif",
});
const state: AgReportState<Registry> = {
  selectedPageId: "spending",
  pages: [
    {
      id: "spending",
      widgets: {
        health: { type: "mandate-health", dataMapping: {} },
        decisions: {
          type: "column-chart-grouped",
          dataMapping: {
            categoryKey: [{ id: "decisions.status" }],
            valueKey: [{ id: "decisions.count", aggregation: "sum" }],
          },
          format: {
            title: { text: "Policy checks, latest 500", enabled: true },
          },
        },
        payments: {
          type: "grid",
          dataMapping: {
            cols: [
              "payments.status",
              "payments.amountCents",
              "payments.currency",
              "payments.createdAt",
              "payments.id",
            ].map((id) => ({ id })),
          },
          format: {
            title: { text: "Payment attempts, latest 500", enabled: true },
          },
        },
        audit: {
          type: "grid",
          dataMapping: {
            cols: [
              "decisions.status",
              "decisions.reason",
              "decisions.merchant",
              "decisions.amountCents",
              "decisions.createdAt",
              "decisions.id",
            ].map((id) => ({ id })),
          },
          format: {
            title: { text: "Policy evidence, latest 500", enabled: true },
          },
        },
      },
      widgetLayout: {
        health: { xTrack: 0, yTrack: 0, xSpan: 10, ySpan: 12 },
        decisions: { xTrack: 10, yTrack: 0, xSpan: 14, ySpan: 12 },
        payments: { xTrack: 0, yTrack: 12, xSpan: 24, ySpan: 14 },
        audit: { xTrack: 0, yTrack: 26, xSpan: 24, ySpan: 14 },
      },
    },
  ],
  panels: {
    data: { collapsed: true },
    filters: { collapsed: true },
    ai: { collapsed: true },
  },
};
const ai: AgAiHarnessSetup = ({ api }) =>
  createAiHarness(api, () => ({
    agents: [spendingAnalyst],
    primary: spendingAnalyst.id,
    promptStarters: [
      {
        label: "Explain my budget",
        prompt:
          "Explain my captured payments, reserved funds, and remaining mandate budget.",
      },
      {
        label: "Review denials",
        prompt: "Why were my recent purchases denied? Cite the policy records.",
      },
    ],
  }));
function OpenSourceDashboard({ report }: { report: AnalyticsResponse }) {
  const mandate = report.mandate;
  const used = mandate
    ? Math.min(100, (mandate.spentAmount / Math.max(1, mandate.weeklyLimit)) * 100)
    : 0;

  const allowedDecisions = report.decisions.filter((d) => d.status === "ALLOWED").length;
  const deniedDecisions = report.decisions.filter((d) => d.status === "DENIED").length;

  const totalCaptured = report.payments
    .filter((p) => p.status === "COMPLETED")
    .reduce((sum, p) => sum + p.amount, 0);

  return (
    <div className="space-y-6 p-6">
      <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
        <div className="rounded-2xl border border-slate-200 bg-slate-50 p-5 shadow-sm">
          <p className="text-xs font-semibold uppercase tracking-wider text-blue-700">
            Latest Mandate
          </p>
          <p className="mt-1 text-lg font-bold text-slate-900">
            {mandate?.name ?? "No mandate locked"}
          </p>
          <div className="mt-2 flex items-baseline justify-between">
            <span className="text-2xl font-bold text-slate-900">
              {money(mandate?.remaining ?? 0)}
            </span>
            <span className="text-xs text-slate-500">
              remaining of {money(mandate?.weeklyLimit ?? 0)}
            </span>
          </div>
          <div className="mt-3 h-2 w-full overflow-hidden rounded-full bg-slate-200">
            <div
              className="h-full rounded-full bg-blue-600 transition-all"
              style={{ width: `${used}%` }}
            />
          </div>
          <p className="mt-2 text-xs text-slate-500">
            Status: <span className="font-medium text-slate-700">{mandate?.status ?? "NONE"}</span> · {Math.round(used)}% committed
          </p>
        </div>

        <div className="rounded-2xl border border-slate-200 bg-slate-50 p-5 shadow-sm">
          <p className="text-xs font-semibold uppercase tracking-wider text-emerald-700">
            Policy Authorization
          </p>
          <p className="mt-1 text-lg font-bold text-slate-900">Deterministic Checks</p>
          <div className="mt-2 grid grid-cols-2 gap-2 text-center">
            <div className="rounded-xl border border-emerald-200 bg-emerald-50/70 p-2">
              <p className="text-2xl font-bold text-emerald-700">{allowedDecisions}</p>
              <p className="text-xs font-medium text-emerald-800">Allowed</p>
            </div>
            <div className="rounded-xl border border-rose-200 bg-rose-50/70 p-2">
              <p className="text-2xl font-bold text-rose-700">{deniedDecisions}</p>
              <p className="text-xs font-medium text-rose-800">Denied</p>
            </div>
          </div>
          <p className="mt-2 text-xs text-slate-500">
            Zero AI in payment execution path.
          </p>
        </div>

        <div className="rounded-2xl border border-slate-200 bg-slate-50 p-5 shadow-sm">
          <p className="text-xs font-semibold uppercase tracking-wider text-indigo-700">
            PayPal Settled Volume
          </p>
          <p className="mt-1 text-lg font-bold text-slate-900">{money(totalCaptured)}</p>
          <p className="mt-1 text-xs text-slate-600">
            {report.payments.length} total payment lifecycle records
          </p>
          <div className="mt-3 flex items-center gap-2">
            <span className="inline-flex items-center rounded-full bg-indigo-100 px-2.5 py-0.5 text-xs font-semibold text-indigo-800">
              Orders API v2
            </span>
            <span className="inline-flex items-center rounded-full bg-emerald-100 px-2.5 py-0.5 text-xs font-semibold text-emerald-800">
              Webhook Verified
            </span>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <h3 className="mb-3 text-sm font-semibold text-slate-900">
            Policy Audit Trail (Latest Decisions)
          </h3>
          <div className="max-h-80 overflow-x-auto">
            <table className="w-full text-left text-xs text-slate-600">
              <thead className="sticky top-0 bg-slate-50 text-[11px] font-semibold uppercase text-slate-700">
                <tr>
                  <th className="p-2">Status</th>
                  <th className="p-2">Merchant</th>
                  <th className="p-2">Amount</th>
                  <th className="p-2">Reason</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {report.decisions.slice(0, 50).map((d) => (
                  <tr key={d.id} className="hover:bg-slate-50">
                    <td className="p-2">
                      <span
                        className={`inline-block rounded-full px-2 py-0.5 text-[10px] font-bold ${
                          d.status === "ALLOWED"
                            ? "bg-emerald-100 text-emerald-800"
                            : "bg-rose-100 text-rose-800"
                        }`}
                      >
                        {d.status}
                      </span>
                    </td>
                    <td className="p-2 font-medium text-slate-800">
                      {d.merchant ?? "N/A"}
                    </td>
                    <td className="p-2">{money(d.amount)}</td>
                    <td className="max-w-[160px] truncate p-2" title={d.reason}>
                      {d.reason}
                    </td>
                  </tr>
                ))}
                {report.decisions.length === 0 && (
                  <tr>
                    <td colSpan={4} className="p-4 text-center text-slate-400">
                      No decisions evaluated yet
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>

        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <h3 className="mb-3 text-sm font-semibold text-slate-900">
            PayPal Payment Lifecycle Attempts
          </h3>
          <div className="max-h-80 overflow-x-auto">
            <table className="w-full text-left text-xs text-slate-600">
              <thead className="sticky top-0 bg-slate-50 text-[11px] font-semibold uppercase text-slate-700">
                <tr>
                  <th className="p-2">Status</th>
                  <th className="p-2">Amount</th>
                  <th className="p-2">Order / Capture ID</th>
                  <th className="p-2">Timestamp</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {report.payments.slice(0, 50).map((p) => (
                  <tr key={p.id} className="hover:bg-slate-50">
                    <td className="p-2">
                      <span
                        className={`inline-block rounded-full px-2 py-0.5 text-[10px] font-bold ${
                          p.status === "COMPLETED"
                            ? "bg-emerald-100 text-emerald-800"
                            : p.status === "DENIED" || p.status === "FAILED"
                            ? "bg-rose-100 text-rose-800"
                            : "bg-amber-100 text-amber-800"
                        }`}
                      >
                        {p.status}
                      </span>
                    </td>
                    <td className="p-2 font-medium text-slate-800">
                      {money(p.amount)}
                    </td>
                    <td
                      className="max-w-[140px] truncate p-2 font-mono text-[11px]"
                      title={p.captureId ?? p.id}
                    >
                      {p.captureId ?? p.id}
                    </td>
                    <td className="p-2 text-slate-400">
                      {new Date(p.createdAt).toLocaleTimeString()}
                    </td>
                  </tr>
                ))}
                {report.payments.length === 0 && (
                  <tr>
                    <td colSpan={4} className="p-4 text-center text-slate-400">
                      No payment attempts yet
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function SpendingStudio({
  report,
}: {
  report: AnalyticsResponse;
}) {
  const [mode, setMode] = useState<"view" | "edit">("view");
  const [viewType, setViewType] = useState<"standard" | "ag-studio">(
    license ? "ag-studio" : "standard",
  );
  const [compact, setCompact] = useState(
    () => window.matchMedia("(max-width: 640px)").matches,
  );
  useEffect(() => {
    const query = window.matchMedia("(max-width: 640px)");
    const update = () => setCompact(query.matches);
    query.addEventListener("change", update);
    return () => query.removeEventListener("change", update);
  }, []);
  const initialState = useMemo<AgReportState<Registry>>(
    () =>
      compact
        ? {
            ...state,
            pages: [
              {
                ...state.pages[0],
                widgetLayout: {
                  health: { xTrack: 0, yTrack: 0, xSpan: 24, ySpan: 13 },
                  decisions: { xTrack: 0, yTrack: 13, xSpan: 24, ySpan: 13 },
                  payments: { xTrack: 0, yTrack: 26, xSpan: 24, ySpan: 14 },
                  audit: { xTrack: 0, yTrack: 40, xSpan: 24, ySpan: 14 },
                },
              },
            ],
          }
        : state,
    [compact],
  );
  const data = useMemo<AgDataSourcesDefinition<Registry>>(
    () => ({
      sources: [
        {
          id: "decisions",
          name: "Policy decisions",
          data: report.decisions.map((d) => ({
            ...d,
            amountCents: d.amount,
            count: 1,
          })),
          fields: [
            ...[
              "id",
              "status",
              "reason",
              "merchant",
              "category",
              "createdAt",
            ].map((id) => ({ id, format: "textFormat" as const })),
            {
              id: "amountCents",
              name: "Amount (USD cents)",
              format: "integerFormat",
            },
            { id: "count", name: "Decision count", format: "integerFormat" },
          ],
        },
        {
          id: "payments",
          name: "Payment attempts",
          data: report.payments.map((p) => ({
            id: p.id,
            status: p.status,
            currency: p.currency,
            createdAt: p.createdAt,
            amountCents: p.amount,
          })),
          fields: [
            ...["id", "status", "currency", "createdAt"].map((id) => ({
              id,
              format: "textFormat" as const,
            })),
            {
              id: "amountCents",
              name: "Amount (cents, group by currency)",
              format: "integerFormat",
            },
          ],
        },
      ],
      description:
        "Session-owned Allopal records. Tables are capped at 500 records each. Amounts are cents. Never combine different currencies or treat policy allowances as captures.",
    }),
    [report],
  );
  return (
    <section
      aria-label="Spending analytics workspace"
      className="overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-xl"
    >
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 px-5 py-4">
        <div>
          <h2 className="font-semibold text-slate-950">
            Explore your spending
          </h2>
          <p className="mt-1 text-xs text-slate-600">
            {viewType === "standard"
              ? "Open-source dashboard with real-time mandate health and audit telemetry."
              : "Powered by AG Studio Enterprise. Layout edits persist to this session."}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <div className="inline-flex rounded-xl bg-slate-100 p-1 text-xs font-medium">
            <button
              type="button"
              onClick={() => setViewType("standard")}
              className={`rounded-lg px-3 py-1.5 transition-all ${
                viewType === "standard"
                  ? "bg-white font-semibold text-blue-900 shadow-sm"
                  : "text-slate-600 hover:text-slate-900"
              }`}
            >
              Standard (Open Source)
            </button>
            <button
              type="button"
              onClick={() => setViewType("ag-studio")}
              className={`rounded-lg px-3 py-1.5 transition-all ${
                viewType === "ag-studio"
                  ? "bg-white font-semibold text-blue-900 shadow-sm"
                  : "text-slate-600 hover:text-slate-900"
              }`}
            >
              AG Studio Enterprise
            </button>
          </div>
          {viewType === "ag-studio" && (
            <button
              className="selo-button selo-button-secondary"
              type="button"
              onClick={() => setMode(mode === "view" ? "edit" : "view")}
            >
              {mode === "view" ? "Customize dashboard" : "Finish customizing"}
            </button>
          )}
        </div>
      </div>

      {viewType === "standard" ? (
        <>
          {!license && (
            <div className="flex items-center justify-between border-b border-blue-100 bg-blue-50/50 px-5 py-2.5 text-xs text-blue-900">
              <span>
                <strong>Open-Source Mode Active:</strong> Clean MIT-licensed dashboard with zero evaluation watermarks.
              </span>
              <span className="text-[11px] text-blue-700">
                Commercial AG Studio available via toggle
              </span>
            </div>
          )}
          <OpenSourceDashboard report={report} />
        </>
      ) : (
        <>
          {!license && (
            <p className="border-b border-amber-200 bg-amber-50 px-5 py-3 text-xs leading-5 text-amber-900">
              AG Studio evaluation mode. A sponsor trial or commercial license key can be provided via NEXT_PUBLIC_AG_STUDIO_LICENSE_KEY. (Switch to Standard View for clean unwatermarked open-source dashboard).
            </p>
          )}
          <div
            className="ag-theme-mode h-[1000px] min-w-0"
            data-ag-theme-mode="light"
          >
            <ReportContext.Provider value={report}>
              <AgStudio<Registry>
                key={compact ? "compact" : "wide"}
                style={{ width: "100%", height: "100%" }}
                theme={theme}
                loadThemeGoogleFonts={false}
                data={data}
                widgets={widgets}
                initialState={initialState}
                mode={mode}
                ai={report.availability.ai ? ai : undefined}
                modules={report.availability.ai ? aiModules : undefined}
                layout={{ minWidth: 300 }}
              />
            </ReportContext.Provider>
          </div>
        </>
      )}
    </section>
  );
}

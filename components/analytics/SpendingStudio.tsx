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
export default function SpendingStudio({
  report,
}: {
  report: AnalyticsResponse;
}) {
  const [mode, setMode] = useState<"view" | "edit">("view");
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
      aria-label="AG Studio spending workspace"
      className="overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-xl"
    >
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 px-5 py-4">
        <div>
          <h2 className="font-semibold text-slate-950">
            Explore your spending
          </h2>
          <p className="mt-1 text-xs text-slate-600">
            Powered by AG Studio. Layout edits only change the dashboard.
          </p>
        </div>
        <button
          className="selo-button selo-button-secondary"
          type="button"
          onClick={() => setMode(mode === "view" ? "edit" : "view")}
        >
          {mode === "view" ? "Customize dashboard" : "Finish customizing"}
        </button>
      </div>
      {!license && (
        <p className="border-b border-amber-200 bg-amber-50 px-5 py-3 text-xs leading-5 text-amber-900">
          AG Studio evaluation. A valid sponsor trial or commercial license is
          required for release. The evaluation watermark is retained.
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
    </section>
  );
}

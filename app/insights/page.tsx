"use client";

import { useCallback, useEffect, useState } from "react";
import dynamic from "next/dynamic";
import Link from "next/link";
import { BarChart3, RefreshCw, ShieldCheck, ArrowRight } from "lucide-react";
import { ProductShell } from "@/components/ProductShell";
import type { AnalyticsResponse, AnalystAnswer } from "@/lib/analytics/types";
import { askAnalyst } from "@/lib/analytics/studio-agent";

const SpendingStudio = dynamic(
  () => import("@/components/analytics/SpendingStudio"),
  {
    ssr: false,
    loading: () => (
      <p className="p-8 text-sm text-slate-600">
        Loading your spending workspace…
      </p>
    ),
  },
);
function money(cents: number, currency: string) {
  return new Intl.NumberFormat("en-US", { style: "currency", currency }).format(
    cents / 100,
  );
}
export default function InsightsPage() {
  const [report, setReport] = useState<AnalyticsResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [question, setQuestion] = useState("");
  const [answer, setAnswer] = useState<AnalystAnswer | null>(null);
  const [asking, setAsking] = useState(false);
  const [selected, setSelected] = useState<string | null>(null);
  const refresh = useCallback(async (signal?: AbortSignal) => {
    setRefreshing(true);
    setError(null);
    try {
      const response = await fetch("/api/analytics", {
        cache: "no-store",
        signal,
      });
      if (!response.ok)
        throw new Error(
          "Your report could not be loaded. Reopen the demo if your session expired.",
        );
      setReport(await response.json());
      setAnswer(null);
      setSelected(null);
    } catch (e) {
      if (!signal?.aborted)
        setError(e instanceof Error ? e.message : "Report unavailable.");
    } finally {
      if (!signal?.aborted) setRefreshing(false);
    }
  }, []);
  useEffect(() => {
    const controller = new AbortController();
    void refresh(controller.signal);
    return () => controller.abort();
  }, [refresh]);
  const evidence =
    selected === "summary"
      ? {
          mandate: report?.mandate,
          summary: report?.summary,
          notes: report?.notes,
        }
      : selected?.startsWith("decision:")
        ? report?.decisions.find((d) => `decision:${d.id}` === selected)
        : report?.payments.find((p) => `payment:${p.id}` === selected);
  return (
    <ProductShell className="analytics-shell">
      <div className="space-y-7">
        <section className="flex flex-wrap items-end justify-between gap-5">
          <div>
            <p className="flex items-center gap-2 text-xs font-semibold uppercase tracking-widest text-blue-700">
              <BarChart3 className="h-4 w-4" />
              Spending insights
            </p>
            <h1 className="mt-4 text-4xl font-semibold tracking-tight text-slate-950 sm:text-5xl">
              See where your authority went.
            </h1>
            <p className="mt-4 max-w-2xl text-sm leading-6 text-slate-600">
              Separate money captured from funds still on hold. Inspect the
              policy records behind every decision, then ask for a read-only
              explanation.
            </p>
          </div>
          <button
            type="button"
            disabled={refreshing || asking}
            onClick={() => void refresh()}
            className="selo-button selo-button-secondary"
          >
            <RefreshCw
              className={`h-4 w-4 ${refreshing ? "animate-spin" : ""}`}
            />
            Refresh records
          </button>
        </section>
        {error && (
          <p
            role="alert"
            className="rounded-2xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-900"
          >
            {error}
          </p>
        )}
        {!report && !error && <p role="status">Loading your records…</p>}
        {report && (
          <>
            <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-slate-200 bg-white/90 p-4 text-xs text-slate-600">
              <span>
                Workspace snapshot ·{" "}
                {new Date(report.generatedAt).toLocaleString()}
              </span>
              <a
                href="/api/evidence"
                download
                className="font-semibold text-blue-700"
              >
                Export session evidence
              </a>
            </div>
            <section
              aria-label="Recorded spending totals"
              className="grid gap-4 md:grid-cols-3"
            >
              {(Object.entries(report.summary.currencies).length
                ? Object.entries(report.summary.currencies)
                : [
                    [
                      "USD",
                      {
                        captured: 0,
                        reserved: 0,
                        refunded: 0,
                        reversed: 0,
                        review: 0,
                      },
                    ] as const,
                  ]
              ).map(([currency, totals]) => (
                <div
                  key={currency}
                  className="rounded-3xl border border-slate-200 bg-white/95 p-6 shadow-sm"
                >
                  <p className="text-xs font-semibold uppercase text-slate-500">
                    {currency} captured
                  </p>
                  <p className="mt-3 text-3xl font-semibold text-slate-950">
                    {money(totals.captured, currency)}
                  </p>
                  <p className="mt-3 text-sm text-amber-800">
                    {money(totals.reserved, currency)} reserved
                  </p>
                  <p className="mt-2 text-xs leading-5 text-slate-600">
                    {money(totals.refunded, currency)} refunded ·{" "}
                    {money(totals.reversed, currency)} reversed ·{" "}
                    {totals.review} need review
                  </p>
                </div>
              ))}
              <div className="rounded-3xl border border-slate-200 bg-white/95 p-6">
                <p className="text-xs font-semibold uppercase text-slate-500">
                  Policy checks
                </p>
                <p className="mt-3 text-3xl font-semibold">
                  {report.summary.decisionCount}
                </p>
                <p className="mt-3 text-sm text-slate-600">
                  {report.summary.deniedCount} denied. Repeated attempts are
                  counted separately, never presented as money saved.
                </p>
              </div>
              <div className="rounded-3xl border border-blue-200 bg-blue-50 p-6">
                <ShieldCheck className="h-5 w-5 text-blue-700" />
                <p className="mt-3 font-semibold">
                  Your records stay authoritative.
                </p>
                <p className="mt-3 text-sm leading-6 text-slate-600">
                  Dashboard filters and AI answers cannot change a mandate,
                  release funds, or capture a payment.
                </p>
                <Link
                  href="/judge"
                  className="mt-3 inline-flex items-center gap-2 text-sm font-semibold text-blue-700"
                >
                  Reviewer guide
                  <ArrowRight className="h-4 w-4" />
                </Link>
              </div>
            </section>
            <section
              className="rounded-3xl border border-slate-200 bg-white/95 p-6"
              aria-labelledby="analyst-title"
            >
              <h2 id="analyst-title" className="text-xl font-semibold">
                Ask about your records
              </h2>
              <p className="mt-2 text-sm leading-6 text-slate-600">
                AI interpretation, read-only. Check the cited evidence before
                relying on an answer. The analyst sees summary totals and the
                latest 50 records of each type, independent of dashboard
                filters.
              </p>
              <form
                className="mt-4 flex flex-col gap-3 sm:flex-row"
                onSubmit={async (event) => {
                  event.preventDefault();
                  setAsking(true);
                  setError(null);
                  setAnswer(null);
                  setSelected(null);
                  try {
                    setAnswer(await askAnalyst(question));
                  } catch (e) {
                    setError(
                      e instanceof Error ? e.message : "Analysis unavailable.",
                    );
                  } finally {
                    setAsking(false);
                  }
                }}
              >
                <label htmlFor="spending-question" className="sr-only">
                  Question about your spending records
                </label>
                <input
                  id="spending-question"
                  maxLength={500}
                  minLength={3}
                  required
                  value={question}
                  onChange={(e) => setQuestion(e.target.value)}
                  disabled={!report.availability.ai || asking || refreshing}
                  placeholder="Why are funds still reserved?"
                  className="min-w-0 flex-1 rounded-xl border border-slate-300 bg-white p-3 text-sm"
                />
                <button
                  type="submit"
                  disabled={!report.availability.ai || asking || refreshing}
                  className="selo-button selo-button-primary disabled:opacity-50"
                >
                  {asking ? "Reading records…" : "Ask analyst"}
                </button>
              </form>
              {!report.availability.ai && (
                <p className="mt-3 text-sm text-amber-900">
                  The builder needs to configure Groq to enable AI analysis. Your
                  recorded totals remain available.
                </p>
              )}
              {answer && (
                <div
                  aria-live="polite"
                  className="mt-4 rounded-2xl bg-slate-50 p-4"
                >
                  <p className="whitespace-pre-wrap text-sm leading-6">
                    {answer.answer}
                  </p>
                  <p className="mt-3 text-xs text-slate-500">
                    Answer snapshot ·{" "}
                    {new Date(answer.generatedAt).toLocaleString()}
                  </p>
                  <div className="mt-3 flex flex-wrap gap-2">
                    {answer.evidenceIds.map((id) => (
                      <button
                        key={id}
                        type="button"
                        onClick={() => setSelected(id)}
                        className="max-w-full break-all rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs text-blue-800"
                      >
                        {id === "summary" ? "View summary evidence" : id}
                      </button>
                    ))}
                  </div>
                </div>
              )}
              {selected && (
                <div className="mt-4 rounded-xl border border-slate-200 p-4">
                  <h3 className="text-sm font-semibold">Source record</h3>
                  <pre className="mt-2 max-h-64 overflow-auto whitespace-pre-wrap break-all text-xs">
                    {evidence
                      ? JSON.stringify(evidence, null, 2)
                      : "This record is outside the current table snapshot. Refresh the report to inspect current records."}
                  </pre>
                </div>
              )}
            </section>
            {report.truncated && (
              <p className="text-sm text-amber-900">
                Tables show the latest 500 decisions and 500 payment attempts.
                The totals above cover all records in this workspace.
              </p>
            )}
            <SpendingStudio report={report} />
            <p className="text-xs leading-6 text-slate-600">
              {report.notes.join(" ")}
            </p>
          </>
        )}
      </div>
    </ProductShell>
  );
}

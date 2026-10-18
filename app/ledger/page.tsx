"use client";

import React from "react";
import Link from "next/link";
import {
  ArrowRight,
  CheckCircle2,
  Clock3,
  Database,
  RefreshCw,
  XCircle,
} from "lucide-react";
import { ProductShell } from "@/components/ProductShell";
import { DecisionLedger } from "@/components/ledger/DecisionLedger";
import { useAllopalRuntime } from "@/hooks/useAllopalRuntime";

export default function LedgerPage() {
  const { decisions, transactions, loading, notice, loadState } =
    useAllopalRuntime();

  return (
    <ProductShell>
      <div className="space-y-10">
        <section className="flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <span className="inline-flex items-center gap-2 text-[10px] font-mono font-bold uppercase tracking-[0.18em] text-blue-700">
              <Database className="h-3.5 w-3.5" />
              authoritative audit ledger
            </span>
            <h1 className="mt-4 max-w-4xl text-4xl font-semibold tracking-[-0.04em] text-slate-950 sm:text-5xl">
              every decision gets a place in the record.
            </h1>
            <p className="mt-4 max-w-2xl text-sm leading-6 text-slate-600">
              Follow policy decisions and PayPal transaction state separately.
              Pending payer approval, completed captures, cancellations, and
              policy-only checks are all visible here.
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => loadState()}
              disabled={loading}
              className="selo-button selo-button-secondary"
            >
              <RefreshCw
                className={loading ? "h-4 w-4 animate-spin" : "h-4 w-4"}
              />
              Refresh ledger
            </button>
            <Link href="/console" className="selo-button selo-button-primary">
              Run a payment
              <ArrowRight className="h-4 w-4" />
            </Link>
          </div>
        </section>

        <a
          href="/api/evidence"
          className="selo-button selo-button-secondary w-fit"
          download
        >
          Export sanitized evidence
        </a>

        {notice && (
          <div className="rounded-2xl border border-blue-200 bg-blue-50 px-4 py-3 text-sm font-medium text-blue-900">
            {notice}
          </div>
        )}

        <section className="grid gap-3 sm:grid-cols-3">
          <div className="selo-card rounded-[24px] border bg-white/88 p-5 shadow-lg">
            <p className="text-[10px] font-bold uppercase tracking-wider text-slate-600">
              decisions
            </p>
            <p className="mt-2 text-3xl font-black text-slate-950">
              {decisions.length}
            </p>
            <p className="mt-1 text-xs text-slate-600">
              policy evaluations recorded
            </p>
          </div>
          <div className="selo-card rounded-[24px] border bg-white/88 p-5 shadow-lg">
            <p className="text-[10px] font-bold uppercase tracking-wider text-slate-600">
              PayPal transactions
            </p>
            <p className="mt-2 text-3xl font-black text-slate-950">
              {transactions.length}
            </p>
            <p className="mt-1 text-xs text-slate-600">
              orders persisted by the runtime
            </p>
          </div>
          <div className="selo-card rounded-[24px] border bg-white/88 p-5 shadow-lg">
            <p className="text-[10px] font-bold uppercase tracking-wider text-slate-600">
              captured
            </p>
            <p className="mt-2 text-3xl font-black text-slate-950">
              {
                transactions.filter((item: any) => item.status === "COMPLETED")
                  .length
              }
            </p>
            <p className="mt-1 text-xs text-slate-600">
              completed PayPal captures
            </p>
          </div>
        </section>

        <DecisionLedger decisions={decisions} isDark={false} />

        <section className="selo-card rounded-[28px] border bg-white/90 p-6 shadow-xl sm:p-7">
          <div className="flex items-center gap-2">
            <Clock3 className="h-5 w-5 text-blue-600" />
            <div>
              <h2 className="text-lg font-bold text-slate-950">
                PayPal transaction timeline
              </h2>
              <p className="text-xs text-slate-600">
                Provider-side state attached to the corresponding Allopal
                decision.
              </p>
            </div>
          </div>

          {transactions.length === 0 ? (
            <div className="mt-6 rounded-2xl border border-dashed border-slate-300 bg-slate-50 p-8 text-center text-sm text-slate-600">
              No PayPal transactions yet. Execute a permitted cart from the
              agent console.
            </div>
          ) : (
            <div className="mt-6 space-y-2.5">
              {transactions.map((item: any) => {
                const completed = item.status === "COMPLETED";
                const failed = [
                  "FAILED",
                  "CANCELLED",
                  "REFUNDED",
                  "REVERSED",
                ].includes(item.status);
                return (
                  <div
                    key={item.id}
                    className="grid gap-4 rounded-2xl border border-slate-200 bg-slate-50 p-4 sm:grid-cols-[1fr_auto] sm:items-center"
                  >
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        {completed ? (
                          <CheckCircle2 className="h-4 w-4 text-emerald-600" />
                        ) : failed ? (
                          <XCircle className="h-4 w-4 text-rose-600" />
                        ) : (
                          <Clock3 className="h-4 w-4 text-amber-600" />
                        )}
                        <span className="text-xs font-bold uppercase tracking-wider text-slate-800">
                          {item.status}
                        </span>
                        <span className="text-[10px] font-mono text-slate-500">
                          {new Date(item.createdAt).toLocaleString()}
                        </span>
                      </div>
                      <p className="mt-2 break-all font-mono text-xs font-semibold text-slate-950">
                        {item.orderId || "Provider order not yet confirmed"}
                      </p>
                      <p className="mt-1 text-xs text-slate-600">
                        {(item.amount / 100).toFixed(2)} {item.currency}
                        {item.captureId
                          ? " · capture " + item.captureId
                          : completed
                            ? " · capture details unavailable"
                            : failed
                              ? " · closed"
                              : " · budget reserved"}
                      </p>
                    </div>
                    <span className="rounded-full border border-slate-300 bg-white px-3 py-1 text-[10px] font-mono font-semibold text-slate-700">
                      mandate {item.mandateId}
                    </span>
                  </div>
                );
              })}
            </div>
          )}
        </section>
      </div>
    </ProductShell>
  );
}

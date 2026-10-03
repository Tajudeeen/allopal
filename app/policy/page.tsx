"use client";

import React from "react";
import Link from "next/link";
import { ArrowRight, CheckCircle2, FlaskConical, ShieldCheck, XCircle } from "lucide-react";
import { ProductShell } from "@/components/ProductShell";
import { VisualPolicyGate } from "@/components/gate/VisualPolicyGate";
import { useAllopalRuntime } from "@/hooks/useAllopalRuntime";

const checks = [
  ["01", "Mandate exists", "The referenced mandate must exist in the authoritative database."],
  ["02", "Not revoked", "Explicit human revocation blocks the request immediately."],
  ["03", "Mandate active", "The mandate must be ACTIVE and inside its time window."],
  ["04", "Cart exists", "A valid cart with authoritative items is required."],
  ["05", "Merchant allowed", "The cart merchant and every item merchant must be permitted."],
  ["06", "Category allowed", "Every product category must belong to the mandate's allowed set."],
  ["07", "Amount valid", "The total must be positive and reconcile with authoritative item prices."],
  ["08", "Budget sufficient", "The requested amount must fit inside the remaining mandate budget."],
];

export default function PolicyPage() {
  const { mandate, carts, evaluation, loading, notice, handleAuthorize } = useAllopalRuntime();

  return (
    <ProductShell>
      <div className="space-y-10">
        <section className="flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <span className="inline-flex items-center gap-2 text-[10px] font-mono font-bold uppercase tracking-[0.18em] text-blue-700">
              <FlaskConical className="h-3.5 w-3.5" />
              deterministic policy engine
            </span>
            <h1 className="mt-4 max-w-4xl text-4xl font-semibold tracking-[-0.04em] text-slate-950 sm:text-5xl">
              see exactly why a payment passes or stops.
            </h1>
            <p className="mt-4 max-w-2xl text-sm leading-6 text-slate-600">
              This screen is the inspection bench for the authorization layer. Pick any seeded scenario and run the server-side dry-run without moving money.
            </p>
          </div>
          <Link href="/console" className="selo-button selo-button-secondary w-fit">
            Open execution console
            <ArrowRight className="h-4 w-4" />
          </Link>
        </section>

        {notice && (
          <div className="rounded-2xl border border-blue-200 bg-blue-50 px-4 py-3 text-sm font-medium text-blue-900">
            {notice}
          </div>
        )}

        <section className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          {carts.map((cart) => {
            const category = cart.items?.[0]?.product?.category || "Unknown category";
            return (
              <div key={cart.id} className="selo-card rounded-[24px] border bg-white/88 p-5 shadow-lg">
                <div className="flex items-start justify-between gap-3">
                  <span className="text-[10px] font-mono font-bold uppercase tracking-[0.16em] text-slate-600">{cart.id}</span>
                  <span className="rounded-full border border-slate-200 bg-slate-50 px-2 py-1 text-[10px] font-semibold text-slate-700">
                    {`${(cart.totalAmount / 100).toFixed(2)}`}
                  </span>
                </div>
                <h2 className="mt-5 text-base font-bold text-slate-950">{cart.items?.[0]?.product?.name || "Cart"}</h2>
                <p className="mt-2 text-xs leading-5 text-slate-600">
                  {cart.merchant} · {category}
                </p>
                <button
                  type="button"
                  onClick={() => handleAuthorize(cart.id)}
                  disabled={loading || !mandate}
                  className="selo-button selo-button-secondary mt-5 w-full disabled:opacity-50"
                >
                  Run dry-run
                  <ArrowRight className="h-4 w-4" />
                </button>
              </div>
            );
          })}
        </section>

        <VisualPolicyGate evaluation={evaluation} loading={loading} isDark={false} />

        <section id="boundary" className="grid gap-5 lg:grid-cols-[1fr_.8fr]">
          <div className="selo-card rounded-[28px] border bg-white/90 p-6 shadow-xl sm:p-7">
            <div className="flex items-center gap-2">
              <ShieldCheck className="h-5 w-5 text-blue-600" />
              <h2 className="text-lg font-bold text-slate-950">The eight checks</h2>
            </div>
            <div className="mt-6 space-y-2">
              {checks.map(([number, title, body]) => (
                <div key={number} className="grid grid-cols-[38px_1fr] gap-3 rounded-2xl border border-slate-200 bg-slate-50 p-3.5">
                  <span className="text-[10px] font-mono font-bold text-slate-500">{number}</span>
                  <div>
                    <h3 className="text-sm font-bold text-slate-950">{title}</h3>
                    <p className="mt-1 text-xs leading-5 text-slate-600">{body}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="rounded-[28px] bg-slate-950 p-6 text-white shadow-xl sm:p-7">
            <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-blue-300">execution boundary</p>
            <h2 className="mt-3 text-2xl font-semibold tracking-tight">policy approval is not payment capture.</h2>
            <p className="mt-3 text-sm leading-6 text-slate-300">
              Dry-run authorization never calls PayPal. Live execution creates an order, waits for payer approval, then captures only after the mandate is re-checked.
            </p>
            <div className="mt-6 space-y-2.5">
              {[
                ["policy denied", "PayPal not called", false],
                ["policy allowed", "PayPal can be called", true],
                ["payer approved", "Capture can proceed", true],
              ].map(([label, value, passed]) => (
                <div key={label} className="flex items-center gap-3 rounded-2xl border border-white/10 bg-white/5 p-3">
                  {passed ? <CheckCircle2 className="h-4 w-4 text-emerald-400" /> : <XCircle className="h-4 w-4 text-rose-400" />}
                  <div>
                    <p className="text-xs font-bold text-white">{label}</p>
                    <p className="text-[11px] text-slate-300">{value}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>
      </div>
    </ProductShell>
  );
}

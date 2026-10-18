"use client";

import React from "react";
import Link from "next/link";
import {
  Activity,
  ArrowRight,
  Bot,
  Database,
  Repeat2,
  ShieldCheck,
} from "lucide-react";
import { ProductShell } from "@/components/ProductShell";
import { AgentConsole } from "@/components/payment/AgentConsole";
import { AgentRunner } from "@/components/payment/AgentRunner";
import { VisualPolicyGate } from "@/components/gate/VisualPolicyGate";
import { useAllopalRuntime } from "@/hooks/useAllopalRuntime";

export default function ConsolePage() {
  const {
    paypalMode,
    paypalConfigured,
    mandate,
    carts,
    evaluation,
    loading,
    notice,
    handleAuthorize,
    handleExecutePayment,
    handleAgentRequest,
    agentRun,
  } = useAllopalRuntime();

  return (
    <ProductShell>
      <div className="space-y-10">
        <section className="flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <span className="inline-flex items-center gap-2 text-[10px] font-mono font-bold uppercase tracking-[0.18em] text-blue-700">
              <Bot className="h-3.5 w-3.5" />
              agent commerce console
            </span>
            <h1 className="mt-4 max-w-4xl text-4xl font-semibold tracking-[-0.04em] text-slate-950 sm:text-5xl">
              this is where an agent request becomes a payment decision.
            </h1>
            <p className="mt-4 max-w-2xl text-sm leading-6 text-slate-600">
              Give an AI agent a natural-language shopping task. The agent
              selects a real server-side cart, then Allopal makes the
              authorization decision before PayPal can move money.
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Link href="/policy" className="selo-button selo-button-secondary">
              Inspect policy
              <ArrowRight className="h-4 w-4" />
            </Link>
            <Link href="/ledger" className="selo-button selo-button-secondary">
              View ledger
              <ArrowRight className="h-4 w-4" />
            </Link>
          </div>
        </section>

        {notice && (
          <div className="rounded-2xl border border-blue-200 bg-blue-50 px-4 py-3 text-sm font-medium text-blue-900">
            {notice}
          </div>
        )}

        <section className="selo-shell overflow-hidden rounded-[30px] border bg-white/88 shadow-2xl">
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 bg-slate-50/80 px-5 py-4">
            <div className="flex items-center gap-3">
              <div className="flex gap-1.5">
                <span className="h-3 w-3 rounded-full bg-[#ff5f56]" />
                <span className="h-3 w-3 rounded-full bg-[#ffbd2e]" />
                <span className="h-3 w-3 rounded-full bg-[#27c93f]" />
              </div>
              <span className="text-xs font-mono font-semibold text-slate-600">
                allopal-runtime / commerce-session
              </span>
            </div>
            <span
              className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider ${paypalConfigured ? "border-emerald-200 bg-emerald-50 text-emerald-700" : "border-amber-200 bg-amber-50 text-amber-800"}`}
            >
              <Activity className="h-3 w-3" />
              {!paypalConfigured
                ? "PayPal not configured"
                : paypalMode === "PAYPAL_SANDBOX"
                  ? "PayPal Sandbox"
                  : paypalMode === "PAYPAL"
                    ? "PayPal live mode"
                    : "PayPal simulated"}
            </span>
          </div>

          <div className="grid gap-6 p-4 sm:p-6 lg:p-8">
            <AgentRunner
              onRunAgent={handleAgentRequest}
              loading={loading}
              agentRun={agentRun}
            />

            <AgentConsole
              carts={carts}
              mandateId={mandate?.id || null}
              onAuthorize={handleAuthorize}
              onExecutePayment={handleExecutePayment}
              loading={loading}
              isDark={true}
            />

            <VisualPolicyGate
              evaluation={evaluation}
              loading={loading}
              isDark={true}
            />
          </div>
        </section>

        <section id="replay-safety" className="grid gap-4 md:grid-cols-3">
          {[
            {
              icon: Database,
              title: "Authoritative inputs",
              body: "The server reloads the mandate, cart, products, merchants, categories, and prices before authorization.",
            },
            {
              icon: ShieldCheck,
              title: "Execution boundary",
              body: "A denied request creates no PayPal order. A real PayPal order requires payer approval before server-side capture.",
            },
            {
              icon: Repeat2,
              title: "Replay safety",
              body: "Idempotency keys and atomic budget reservation protect against duplicate side effects and concurrent overspending.",
            },
          ].map((item) => {
            const Icon = item.icon;
            return (
              <div
                key={item.title}
                className="selo-card rounded-[24px] border bg-white/85 p-5 shadow-lg"
              >
                <div className="flex h-10 w-10 items-center justify-center rounded-xl border border-slate-200 bg-slate-950 text-white">
                  <Icon className="h-4 w-4" />
                </div>
                <h2 className="mt-5 text-sm font-bold text-slate-950">
                  {item.title}
                </h2>
                <p className="mt-2 text-sm leading-6 text-slate-600">
                  {item.body}
                </p>
              </div>
            );
          })}
        </section>
      </div>
    </ProductShell>
  );
}

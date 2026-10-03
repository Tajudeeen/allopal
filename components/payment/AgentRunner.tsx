"use client";

import React, { useState } from "react";
import { ArrowRight, Bot, CheckCircle2, LockKeyhole, ShieldCheck, Sparkles, XCircle } from "lucide-react";

interface AgentRun {
  task: string;
  mode: "DRY_RUN" | "EXECUTE";
  selectedCartId: string;
  productName: string;
  amount: number;
  merchant: string;
  category: string;
  reasoning: string;
  finalDecision: string;
  paypalCalled: boolean;
}

interface AgentRunnerProps {
  onRunAgent: (task: string, mode: "DRY_RUN" | "EXECUTE") => Promise<void>;
  loading: boolean;
  agentRun: AgentRun | null;
}

const examples = [
  "buy me a gaming headset",
  "find school supplies under $20",
  "get the best notebook for me",
];

export function AgentRunner({ onRunAgent, loading, agentRun }: AgentRunnerProps) {
  const [task, setTask] = useState("find school supplies under $20");

  const handleSubmit = async (mode: "DRY_RUN" | "EXECUTE") => {
    const trimmed = task.trim();
    if (!trimmed || loading) return;
    await onRunAgent(trimmed, mode);
  };

  const passed = agentRun?.finalDecision === "ALLOWED" || agentRun?.finalDecision === "COMPLETED";
  const denied = agentRun?.finalDecision === "DENIED";

  return (
    <section className="selo-dark-card relative overflow-hidden rounded-[26px] border p-5 shadow-2xl sm:p-6">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_100%_0%,rgba(31,79,224,0.12),transparent_34%)]" />

      <div className="relative">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div className="flex gap-3">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-blue-300/15 bg-blue-400/10 text-blue-200">
              <Bot className="h-5 w-5" />
            </div>
            <div>
              <div className="flex flex-wrap items-center gap-2">
                <p className="text-[10px] font-mono font-bold uppercase tracking-[0.18em] text-blue-300">
                  agent action layer
                </p>
                <span className="rounded-full border border-white/10 bg-white/[0.04] px-2 py-0.5 text-[9px] font-semibold uppercase tracking-wider text-white/55">
                  AI proposes · policy authorizes
                </span>
              </div>
              <h2 className="mt-2 text-xl font-bold tracking-tight text-white">
                tell the agent what to buy
              </h2>
              <p className="mt-1 max-w-2xl text-xs leading-5 text-slate-300/75">
                The agent searches only the server catalog and selects a candidate cart. Allopal still makes the final spending decision before PayPal.
              </p>
            </div>
          </div>

          <div className="hidden shrink-0 items-center gap-1.5 rounded-full border border-emerald-400/15 bg-emerald-400/10 px-2.5 py-1 text-[9px] font-mono font-bold uppercase tracking-wider text-emerald-300 sm:flex">
            <ShieldCheck className="h-3 w-3" />
            guarded
          </div>
        </div>

        <div className="mt-5 flex flex-wrap gap-2">
          {examples.map((example) => (
            <button
              key={example}
              type="button"
              onClick={() => setTask(example)}
              className="rounded-full border border-white/10 bg-white/[0.035] px-3 py-1.5 text-[10px] font-semibold text-slate-300 transition hover:border-white/20 hover:bg-white/[0.07] hover:text-white"
            >
              {example}
            </button>
          ))}
        </div>

        <div className="mt-4 grid gap-3 lg:grid-cols-[1fr_auto_auto]">
          <label className="sr-only" htmlFor="agent-task">
            Agent shopping request
          </label>
          <input
            id="agent-task"
            value={task}
            onChange={(event) => setTask(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "Enter") {
                void handleSubmit("DRY_RUN");
              }
            }}
            placeholder="e.g. buy school supplies under $20"
            className="selo-input min-h-[46px] w-full rounded-xl border-white/10 bg-white/[0.045] px-4 text-sm text-white placeholder:text-slate-500 focus:border-blue-400/50 focus:bg-white/[0.07] focus:ring-0"
          />

          <button
            type="button"
            onClick={() => void handleSubmit("DRY_RUN")}
            disabled={loading || !task.trim()}
            className="selo-button selo-button-secondary min-h-[46px] w-full lg:w-auto"
          >
            <Sparkles className="h-4 w-4 text-amber-300" />
            Agent dry-run
          </button>

          <button
            type="button"
            onClick={() => void handleSubmit("EXECUTE")}
            disabled={loading || !task.trim()}
            className="selo-button selo-button-paypal min-h-[46px] w-full lg:w-auto"
          >
            Let agent execute
            <ArrowRight className="h-4 w-4" />
          </button>
        </div>

        {agentRun && (
          <div className="mt-5 rounded-[20px] border border-white/10 bg-black/20 p-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="flex items-center gap-2">
                {passed ? (
                  <CheckCircle2 className="h-4 w-4 text-emerald-400" />
                ) : denied ? (
                  <XCircle className="h-4 w-4 text-rose-400" />
                ) : (
                  <LockKeyhole className="h-4 w-4 text-amber-300" />
                )}
                <span className="text-xs font-bold uppercase tracking-wider text-white">
                  agent trace
                </span>
              </div>
              <span className={
                "rounded-full border px-2.5 py-1 text-[9px] font-bold uppercase tracking-wider " +
                (passed
                  ? "border-emerald-500/25 bg-emerald-500/10 text-emerald-300"
                  : denied
                  ? "border-rose-500/25 bg-rose-500/10 text-rose-300"
                  : "border-amber-500/25 bg-amber-500/10 text-amber-300")
              }>
                {agentRun.finalDecision}
              </span>
            </div>

            <div className="mt-4 grid gap-2 md:grid-cols-4">
              {[
                ["request", agentRun.task],
                ["selected", agentRun.productName],
                ["policy", agentRun.finalDecision],
                ["PayPal", agentRun.paypalCalled ? "called" : "not called"],
              ].map(([label, value]) => (
                <div key={label} className="min-w-0 rounded-xl border border-white/10 bg-white/[0.03] p-3">
                  <p className="text-[9px] font-mono font-bold uppercase tracking-wider text-white/40">{label}</p>
                  <p className="mt-1 break-words text-xs font-semibold text-white">{value}</p>
                </div>
              ))}
            </div>

            <div className="mt-3 grid gap-2 sm:grid-cols-[1fr_auto]">
              <div className="rounded-xl border border-white/10 bg-white/[0.03] p-3">
                <p className="text-[9px] font-mono font-bold uppercase tracking-wider text-white/40">agent reasoning</p>
                <p className="mt-1 text-xs leading-5 text-slate-300">{agentRun.reasoning}</p>
              </div>
              <div className="rounded-xl border border-blue-400/15 bg-blue-400/[0.06] p-3 sm:min-w-44">
                <p className="text-[9px] font-mono font-bold uppercase tracking-wider text-blue-300/70">candidate</p>
                <p className="mt-1 text-xs font-bold text-white">{agentRun.merchant}</p>
                <p className="mt-0.5 text-[11px] text-slate-300">
                  {agentRun.category} · ${(agentRun.amount / 100).toFixed(2)}
                </p>
              </div>
            </div>
          </div>
        )}
      </div>
    </section>
  );
}

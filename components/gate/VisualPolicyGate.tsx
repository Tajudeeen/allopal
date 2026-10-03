"use client";

import React from "react";
import { CheckCircle, XCircle, Clock3, CreditCard, Sparkles, ShieldCheck } from "lucide-react";

export interface PolicyCheckResult {
  passed: boolean;
  message: string;
}

export interface GateEvaluationState {
  status: "ALLOWED" | "DENIED" | "COMPLETED";
  amount: number;
  merchant: string;
  category: string;
  reason: string;
  failedCheck: string | null;
  paypalCalled: boolean;
  paypalOrderId: string | null;
  paypalCaptureId?: string | null;
  aiExplanation?: string;
  checks?: {
    MANDATE_EXISTS?: PolicyCheckResult;
    MANDATE_ACTIVE?: PolicyCheckResult;
    MANDATE_NOT_REVOKED?: PolicyCheckResult;
    CART_EXISTS?: PolicyCheckResult;
    MERCHANT_ALLOWED?: PolicyCheckResult;
    CATEGORY_ALLOWED?: PolicyCheckResult;
    AMOUNT_VALID?: PolicyCheckResult;
    BUDGET_SUFFICIENT?: PolicyCheckResult;
  };
}

interface VisualPolicyGateProps {
  evaluation: GateEvaluationState | null;
  loading: boolean;
  isDark?: boolean;
}

const gateSteps = [
  { key: "MANDATE_EXISTS", title: "Mandate exists", subtitle: "Authoritative spending mandate is present." },
  { key: "MANDATE_ACTIVE", title: "Mandate active", subtitle: "The mandate is currently enabled." },
  { key: "MANDATE_NOT_REVOKED", title: "Mandate not revoked", subtitle: "Human control has not disabled spending." },
  { key: "CART_EXISTS", title: "Cart exists", subtitle: "The requested purchase resolves to a known cart." },
  { key: "MERCHANT_ALLOWED", title: "Merchant allowed", subtitle: "Merchant is inside the locked allow-list." },
  { key: "CATEGORY_ALLOWED", title: "Category allowed", subtitle: "Purchase category is inside policy." },
  { key: "AMOUNT_VALID", title: "Amount valid", subtitle: "Amount is valid and represented in integer cents." },
  { key: "BUDGET_SUFFICIENT", title: "Budget sufficient", subtitle: "Remaining mandate budget covers the request." },
] as const;

function StepIndicator({ status }: { status: "passed" | "failed" | "pending" }) {
  if (status === "passed") return <span className="flex items-center gap-1.5 text-[9px] font-bold tracking-[0.12em] uppercase text-emerald-300"><CheckCircle className="w-4 h-4" />passed</span>;
  if (status === "failed") return <span className="flex items-center gap-1.5 text-[9px] font-bold tracking-[0.12em] uppercase text-rose-300"><XCircle className="w-4 h-4" />failed</span>;
  return <span className="flex items-center gap-1.5 text-[9px] font-bold tracking-[0.12em] uppercase text-white/25"><Clock3 className="w-4 h-4" />waiting</span>;
}

export function VisualPolicyGate({ evaluation, loading }: VisualPolicyGateProps) {
  const isAllowed = evaluation?.status === "ALLOWED" || evaluation?.status === "COMPLETED";
  const checks = evaluation?.checks ?? {};

  if (!evaluation && !loading) {
    return (
      <div className="selo-checks rounded-[32px] border bg-white/78">
        <div className="grid lg:grid-cols-[0.78fr_1.22fr]">
          <div className="relative p-7 sm:p-9 lg:p-10 min-h-[430px] flex flex-col justify-between">
            <div>
              <div className="flex items-center gap-2 mb-8"><span className="w-2 h-2 rounded-full bg-slate-300" /><span className="text-[10px] font-bold tracking-[0.18em] uppercase text-slate-400">Awaiting request</span></div>
              <p className="text-xs font-mono text-slate-400 mb-3">/checks</p>
              <h2 className="text-5xl sm:text-6xl font-light tracking-[-0.055em] leading-[0.92] text-[#17181b]">Policy<br /><span className="font-serif italic text-[#1f4fe0]">checks.</span></h2>
              <p className="mt-5 max-w-sm text-sm leading-relaxed text-slate-500">Run a purchase through Allopal to see the authorization sequence, the failed rule, and whether PayPal was ever reached.</p>
            </div>
            <div className="rounded-2xl border border-black/[0.08] bg-black/[0.018] p-4">
              <div className="text-[9px] font-bold tracking-[0.16em] uppercase text-slate-400 mb-2">execution boundary</div>
              <div className="flex items-center justify-between gap-3"><span className="text-sm font-medium text-[#17181b]">PayPal API</span><span className="text-[9px] font-bold tracking-[0.12em] uppercase text-slate-400">untouched</span></div>
            </div>
          </div>
          <div className="p-4 sm:p-6 lg:p-7 border-t lg:border-t-0 lg:border-l border-black/[0.08]">
            <div className="h-full rounded-2xl border border-black/[0.08] bg-white/65 p-5 sm:p-6">
              <div className="flex items-center justify-between pb-4 border-b border-black/[0.07]"><span className="text-[10px] font-bold tracking-[0.16em] uppercase text-slate-400">Sequential evaluation</span><span className="text-[9px] font-bold uppercase tracking-[0.12em] text-slate-300">8 rules</span></div>
              <div className="pt-1">{gateSteps.map((step, idx) => <div key={step.key} className="grid grid-cols-[34px_1fr_auto] items-center gap-3 py-4 border-b last:border-b-0 border-black/[0.06]"><span className="text-[10px] font-mono text-slate-300">0{idx + 1}</span><div><div className="text-sm font-semibold text-[#202126]">{step.title}</div><div className="text-[11px] mt-0.5 text-slate-400">{step.subtitle}</div></div><span className="text-[9px] font-bold tracking-[0.12em] uppercase text-slate-300">waiting</span></div>)}</div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className={"selo-checks rounded-[32px] border " + (isAllowed ? "bg-[#111216] text-white" : "bg-[#111216] text-white")}>
      <div className="grid lg:grid-cols-[0.78fr_1.22fr]">
        <div className="relative p-7 sm:p-9 lg:p-10 min-h-[610px] flex flex-col justify-between border-b lg:border-b-0 lg:border-r border-white/[0.08]">
          <div className="absolute -top-20 -right-16 w-64 h-64 rounded-full bg-blue-500/10 blur-3xl pointer-events-none" />
          <div className="relative">
            <div className="flex items-center gap-2 mb-8"><span className={"w-2 h-2 rounded-full " + (isAllowed ? "bg-emerald-400" : "bg-rose-400")} /><span className="text-[10px] font-bold tracking-[0.18em] uppercase text-white/45">{loading ? "evaluating request" : "authorization result"}</span></div>
            <p className="text-xs font-mono text-white/30 mb-3">/checks</p>
            <h2 className="text-5xl sm:text-6xl font-light tracking-[-0.055em] leading-[0.92]">Policy<br /><span className={"font-serif italic " + (isAllowed ? "text-blue-300" : "text-rose-300")}>{isAllowed ? "passed." : "blocked."}</span></h2>
            <p className="mt-5 max-w-sm text-sm leading-relaxed text-white/45">{evaluation?.merchant} · {evaluation?.category}<br />${((evaluation?.amount ?? 0) / 100).toFixed(2)} USD</p>
            <div className="mt-8 flex flex-wrap gap-2"><span className="px-3 py-1.5 rounded-full border border-white/[0.09] bg-white/[0.04] text-[10px] font-mono text-white/60">{evaluation?.status}</span><span className="px-3 py-1.5 rounded-full border border-white/[0.09] bg-white/[0.04] text-[10px] font-mono text-white/60">{evaluation?.paypalCalled ? "PAYPAL CALLED" : "ZERO PAYPAL CALLS"}</span></div>
          </div>
          <div className="relative mt-10 rounded-2xl border border-white/[0.09] bg-white/[0.035] p-4">
            <div className="flex items-center gap-2 mb-3"><ShieldCheck className={"w-4 h-4 " + (isAllowed ? "text-emerald-300" : "text-rose-300")} /><span className="text-[9px] font-bold tracking-[0.15em] uppercase text-white/40">final boundary</span></div>
            <div className="flex items-center justify-between gap-3"><span className="text-sm font-medium">PayPal execution</span><span className={"text-[9px] font-bold tracking-[0.12em] uppercase px-2.5 py-1 rounded-full border " + (evaluation?.paypalCalled ? "text-emerald-300 bg-emerald-400/10 border-emerald-400/20" : "text-rose-300 bg-rose-400/10 border-rose-400/20")}>{evaluation?.paypalCalled ? "captured" : "blocked"}</span></div>
          </div>
        </div>

        <div className="p-4 sm:p-6 lg:p-7">
          <div className="flex items-center justify-between px-2 pb-4 border-b border-white/[0.08]"><div className="flex items-center gap-2"><span className="text-[10px] font-bold tracking-[0.16em] uppercase text-white/35">Sequential evaluation</span><span className="text-[9px] font-mono text-white/20">8 RULES</span></div><span className={"text-[9px] font-bold uppercase tracking-[0.12em] " + (isAllowed ? "text-emerald-300" : "text-rose-300")}>{evaluation?.status}</span></div>
          <div className="py-1">{gateSteps.map((step, idx) => {
            const result = checks[step.key as keyof NonNullable<GateEvaluationState["checks"]>];
            const status = result ? (result.passed ? "passed" : "failed") : "pending";
            return <div key={step.key} className="grid grid-cols-[34px_1fr_auto] items-center gap-3 py-4 px-2 border-b last:border-b-0 border-white/[0.07] transition-colors hover:bg-white/[0.025]">
              <span className="text-[10px] font-mono text-white/20">0{idx + 1}</span>
              <div className="min-w-0"><div className="text-sm font-semibold truncate">{step.title}</div><div className="text-[11px] mt-0.5 text-white/35 truncate">{step.subtitle}{result?.message ? " · " + result.message : ""}</div></div>
              <StepIndicator status={status} />
            </div>;
          })}</div>

          <div className={"mt-4 rounded-2xl p-4 border " + (isAllowed ? "bg-[#003087]/80 border-blue-400/20" : "bg-rose-950/45 border-rose-400/15")}>
            <div className="flex items-center justify-between gap-3 mb-2"><div className="flex items-center gap-2"><CreditCard className={"w-4 h-4 " + (isAllowed ? "text-[#FFC439]" : "text-rose-300")} /><span className="text-[10px] font-bold tracking-[0.12em] uppercase">Execution boundary</span></div><span className="text-[9px] font-mono opacity-55">{evaluation?.paypalCalled ? "API INVOKED" : "ZERO CALLS"}</span></div>
            {isAllowed ? <div className="text-xs font-mono space-y-1"><div><span className="opacity-50">order </span>{evaluation?.paypalOrderId || "PENDING_CAPTURE"}</div>{evaluation?.paypalCaptureId && <div><span className="opacity-50">capture </span>{evaluation.paypalCaptureId}</div>}<div className="font-sans text-[11px] opacity-60 pt-1">Server-side capture succeeded for ${((evaluation?.amount ?? 0) / 100).toFixed(2)} USD</div></div> : <div className="text-xs space-y-1"><div className="font-semibold">Zero money movement. PayPal was never invoked.</div><div className="text-[11px] opacity-60">{evaluation?.failedCheck || "POLICY_RULE"} · {evaluation?.reason}</div></div>}
          </div>

          {evaluation?.aiExplanation && <div className="mt-3 rounded-2xl border border-purple-400/15 bg-purple-950/25 p-3.5 text-xs flex items-start gap-2.5"><Sparkles className="w-4 h-4 text-purple-300 shrink-0 mt-0.5" /><div><span className="font-bold block mb-0.5">AI decision explanation</span><p className="leading-relaxed text-white/50">{evaluation.aiExplanation}</p></div></div>}
        </div>
      </div>
    </div>
  );
}
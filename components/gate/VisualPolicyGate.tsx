"use client";

import React from "react";
import {
  CheckCircle,
  XCircle,
  ShieldCheck,
  CreditCard,
  Sparkles,
} from "lucide-react";

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

export function VisualPolicyGate({
  evaluation,
  loading,
  isDark = true,
}: VisualPolicyGateProps) {
  if (loading) {
    return (
    <div className="selo-checks rounded-[28px] overflow-hidden border shadow-2xl">
      <div className={`grid lg:grid-cols-[0.82fr_1.18fr] min-h-[520px] ${isDark ? "bg-[#101114] text-white border-white/10" : "bg-[#f8f7f3] text-slate-950 border-black/10"}`}>
        <div className={`relative p-7 sm:p-9 lg:p-10 border-b lg:border-b-0 lg:border-r ${isDark ? "border-white/10" : "border-black/10"}`}>
          <div className="absolute top-0 right-0 w-40 h-40 rounded-full bg-blue-500/10 blur-3xl pointer-events-none" />
          <div className="relative flex h-full flex-col justify-between gap-10">
            <div>
              <div className="flex items-center gap-2 mb-7">
                <span className={`w-2 h-2 rounded-full ${isAllowed ? "bg-emerald-400" : "bg-rose-400"} animate-pulse`} />
                <span className={`text-[10px] font-bold tracking-[0.18em] uppercase ${isDark ? "text-white/50" : "text-black/45"}`}>
                  Live authorization
                </span>
              </div>

              <div className="max-w-xs">
                <p className={`text-xs font-mono mb-3 ${isDark ? "text-white/35" : "text-black/35"}`}>/checks</p>
                <h2 className="text-4xl sm:text-5xl font-light tracking-[-0.045em] leading-[0.98]">
                  Policy
                  <br />
                  <span className={isDark ? "text-blue-300" : "text-[#1f4fe0]"}>checks.</span>
                </h2>
                <p className={`mt-5 text-sm leading-relaxed max-w-[280px] ${isDark ? "text-white/55" : "text-black/55"}`}>
                  Every payment moves through a fixed sequence before PayPal can be called.
                </p>
              </div>
            </div>

            <div className={`rounded-2xl border p-4 ${isDark ? "border-white/10 bg-white/[0.035]" : "border-black/10 bg-black/[0.025]"}`}>
              <div className={`text-[9px] font-bold tracking-[0.16em] uppercase mb-3 ${isDark ? "text-white/35" : "text-black/35"}`}>
                Final boundary
              </div>
              <div className="flex items-center justify-between gap-3">
                <span className="text-sm font-medium">PayPal execution</span>
                <span className={`text-[9px] font-bold tracking-wider uppercase px-2.5 py-1 rounded-full border ${evaluation.paypalCalled
                  ? "bg-emerald-400/10 text-emerald-300 border-emerald-400/20"
                  : "bg-rose-400/10 text-rose-300 border-rose-400/20"}`}>
                  {evaluation.paypalCalled ? "captured" : "blocked"}
                </span>
              </div>
            </div>
          </div>
        </div>

        <div className="p-4 sm:p-6 lg:p-7 flex flex-col">
          <div className={`flex items-center justify-between px-2 pb-4 border-b ${isDark ? "border-white/10" : "border-black/10"}`}>
            <span className={`text-[10px] font-bold tracking-[0.16em] uppercase ${isDark ? "text-white/40" : "text-black/40"}`}>
              Sequential evaluation
            </span>
            <span className={`text-[10px] font-bold uppercase tracking-wider ${isAllowed ? "text-emerald-500" : "text-rose-500"}`}>
              {evaluation.status}
            </span>
          </div>

          <div className="flex-1 py-2">
            {gateSteps.map((step, idx) => (
              <div
                key={step.key}
                className={`group grid grid-cols-[34px_1fr_auto] items-center gap-3 py-4 px-2 border-b last:border-b-0 transition-colors ${isDark ? "border-white/[0.07] hover:bg-white/[0.025]" : "border-black/[0.07] hover:bg-black/[0.025]"}`}
              >
                <span className={`text-[10px] font-mono ${isDark ? "text-white/25" : "text-black/25"}`}>
                  0{idx + 1}
                </span>
                <div>
                  <div className="text-sm font-semibold">{step.title.replace(/^\d+\. /, "")}</div>
                  <div className={`text-[11px] mt-0.5 ${isDark ? "text-white/40" : "text-black/40"}`}>
                    {step.subtitle}{step.message ? ` · ${step.message}` : ""}
                  </div>
                </div>
                <div className={`flex items-center gap-2 text-[9px] font-bold tracking-[0.12em] uppercase ${step.passed ? "text-emerald-500" : "text-rose-500"}`}>
                  {step.passed ? <CheckCircle className="w-4 h-4" /> : <XCircle className="w-4 h-4" />}
                  {step.passed ? "passed" : "failed"}
                </div>
              </div>
            ))}
          </div>

          <div className={`mt-3 rounded-2xl p-4 border ${isAllowed
            ? isDark ? "bg-[#003087]/80 border-blue-400/20" : "bg-[#003087] border-blue-700 text-white"
            : isDark ? "bg-rose-950/60 border-rose-500/20" : "bg-rose-50 border-rose-200"}`}>
            <div className="flex items-center justify-between gap-3 mb-2">
              <div className="flex items-center gap-2">
                <CreditCard className={`w-4 h-4 ${isAllowed ? "text-[#FFC439]" : "text-rose-400"}`} />
                <span className="text-[10px] font-bold tracking-[0.12em] uppercase">Execution boundary</span>
              </div>
              <span className="text-[9px] font-mono opacity-60">
                {evaluation.paypalCalled ? "API INVOKED" : "ZERO CALLS"}
              </span>
            </div>
            {isAllowed ? (
              <div className="text-xs font-mono space-y-1">
                <div><span className="opacity-50">order </span>{evaluation.paypalOrderId || "PENDING_CAPTURE"}</div>
                {evaluation.paypalCaptureId && <div><span className="opacity-50">capture </span>{evaluation.paypalCaptureId}</div>}
                <div className="font-sans text-[11px] opacity-60 pt-1">
                  Server-side capture succeeded for ${(evaluation.amount / 100).toFixed(2)} USD
                </div>
              </div>
            ) : (
              <div className="text-xs space-y-1">
                <div className="font-semibold">Zero money movement. PayPal was never invoked.</div>
                <div className="text-[11px] opacity-60">
                  {evaluation.failedCheck || "POLICY_RULE"} · {evaluation.reason}
                </div>
              </div>
            )}
          </div>

          {evaluation.aiExplanation && (
            <div className={`mt-3 rounded-2xl border p-3.5 text-xs flex items-start gap-2.5 ${isDark ? "bg-purple-950/30 border-purple-800/40 text-purple-200" : "bg-purple-50 border-purple-200 text-purple-950"}`}>
              <Sparkles className="w-4 h-4 text-purple-400 shrink-0 mt-0.5" />
              <div>
                <span className="font-bold block mb-0.5">AI decision explanation</span>
                <p className={`leading-relaxed ${isDark ? "text-white/55" : "text-black/55"}`}>{evaluation.aiExplanation}</p>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );}

"use client";

import React from "react";
import { CheckCircle, XCircle, CreditCard, Sparkles, Loader2, ExternalLink, Minus } from "lucide-react";
import { PolicyCheckDetail } from "@/lib/policy/types";

export interface GateEvaluationState {
  status: "ALLOWED" | "DENIED" | "COMPLETED" | "PENDING_APPROVAL" | "FAILED";
  amount: number;
  merchant: string;
  category: string;
  reason?: string;
  failedCheck?: string | null;
  paypalCalled: boolean;
  paypalOrderId: string | null;
  paypalCaptureId?: string | null;
  approvalUrl?: string | null;
  aiExplanation?: string;
  checks?: {
    MANDATE_EXISTS?: PolicyCheckDetail;
    MANDATE_ACTIVE?: PolicyCheckDetail;
    MANDATE_NOT_REVOKED?: PolicyCheckDetail;
    CART_EXISTS?: PolicyCheckDetail;
    MERCHANT_ALLOWED?: PolicyCheckDetail;
    CATEGORY_ALLOWED?: PolicyCheckDetail;
    AMOUNT_VALID?: PolicyCheckDetail;
    BUDGET_SUFFICIENT?: PolicyCheckDetail;
  };
}

interface VisualPolicyGateProps {
  evaluation: GateEvaluationState | null;
  loading: boolean;
  isDark?: boolean;
}

const checkLabels: Array<{
  key: keyof NonNullable<GateEvaluationState["checks"]>;
  title: string;
  subtitle: string;
}> = [
  { key: "MANDATE_EXISTS", title: "Mandate exists", subtitle: "Authoritative record" },
  { key: "MANDATE_ACTIVE", title: "Mandate active", subtitle: "Valid status + window" },
  { key: "MANDATE_NOT_REVOKED", title: "Not revoked", subtitle: "Human revocation state" },
  { key: "CART_EXISTS", title: "Cart exists", subtitle: "Valid items present" },
  { key: "MERCHANT_ALLOWED", title: "Merchant allowed", subtitle: "Approved merchant" },
  { key: "CATEGORY_ALLOWED", title: "Category allowed", subtitle: "Approved category" },
  { key: "AMOUNT_VALID", title: "Amount valid", subtitle: "Authoritative item sum" },
  { key: "BUDGET_SUFFICIENT", title: "Budget sufficient", subtitle: "Remaining mandate budget" },
];

export function VisualPolicyGate({
  evaluation,
  loading,
  isDark = false,
}: VisualPolicyGateProps) {
  if (loading) {
    return (
      <div className={`selo-card selo-dark-card rounded-2xl p-8 border shadow-xl flex flex-col items-center justify-center space-y-3`}>
        <Loader2 className="w-8 h-8 animate-spin text-[#1f4fe0]" />
        <p className="text-sm font-medium text-slate-300">
          Evaluating deterministic policy engine on server...
        </p>
      </div>
    );
  }

  if (!evaluation) {
    return (
      <div className="selo-card selo-dark-card rounded-2xl p-8 border shadow-xl text-center">
        <p className="text-sm text-slate-400">
          Select a shopping scenario above to observe real-time policy checks.
        </p>
      </div>
    );
  }

  const isDenied = evaluation.status === "DENIED";
  const isFailed = evaluation.status === "FAILED";
  const isPending = evaluation.status === "PENDING_APPROVAL";
  const isCaptured = evaluation.status === "COMPLETED" && Boolean(evaluation.paypalCaptureId);
  const checks = evaluation.checks || {};

  return (
    <div className="selo-card selo-dark-card rounded-2xl p-6 border shadow-2xl backdrop-blur-2xl transition-all">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-5 pb-3 border-b border-slate-800">
        <div className="flex items-center gap-2.5">
          <div
            className={`w-3 h-3 rounded-full ${isDenied || isFailed ? "bg-rose-500" : isPending ? "bg-amber-400" : "bg-emerald-500"}`}
          />
          <div>
            <h2 className="text-base font-bold tracking-tight">
              Visual Policy Gate Evaluation
            </h2>
            <p className="text-[11px] text-slate-400">
              Eight deterministic checks run before any PayPal execution.
            </p>
          </div>
        </div>
        <span
          className={`px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider border w-fit ${
            isDenied || isFailed
              ? "bg-rose-950/80 text-rose-300 border-rose-700/60"
              : isPending
              ? "bg-amber-950/80 text-amber-300 border-amber-700/60"
              : "bg-emerald-950/80 text-emerald-300 border-emerald-700/60"
          }`}
        >
          {evaluation.status}
        </span>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-2.5 mb-5">
        {checkLabels.map(({ key, title, subtitle }) => {
          const check = checks[key];
          const passed = check?.passed;
          return (
            <div
              key={key}
              className={`rounded-xl border p-3 min-w-0 transition-all ${
                passed === true
                  ? "bg-emerald-950/35 border-emerald-800/60"
                  : passed === false
                  ? "bg-rose-950/35 border-rose-800/70"
                  : "bg-white/[0.025] border-white/[0.08]"
              }`}
            >
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <div className="text-[11px] font-bold text-white break-words">{title}</div>
                  <div className="text-[10px] text-slate-400 mt-0.5">{subtitle}</div>
                </div>
                {passed === true ? (
                  <CheckCircle className="w-4 h-4 text-emerald-400 shrink-0" />
                ) : passed === false ? (
                  <XCircle className="w-4 h-4 text-rose-400 shrink-0" />
                ) : (
                  <Minus className="w-4 h-4 text-slate-500 shrink-0" />
                )}
              </div>
              <div className={`text-[9px] font-bold uppercase tracking-wide mt-2 ${
                passed === true ? "text-emerald-400" : passed === false ? "text-rose-400" : "text-slate-500"
              }`}>
                {passed === true ? "PASSED" : passed === false ? "FAILED" : "NOT RUN"}
              </div>
              {check?.message && (
                <p className="text-[10px] leading-relaxed text-slate-300/80 mt-1.5 break-words">
                  {check.message}
                </p>
              )}
            </div>
          );
        })}
      </div>

      <div
        className={`p-4 rounded-xl border transition-all ${
          isDenied || isFailed
            ? "bg-rose-950 border-rose-800 text-rose-100"
            : isPending
            ? "bg-amber-950 border-amber-800 text-amber-100"
            : "bg-gradient-to-r from-blue-950 via-[#003087] to-blue-900 text-white border-blue-700/80 shadow-lg"
        }`}
      >
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 mb-2">
          <div className="flex items-center gap-2">
            <CreditCard className={`w-5 h-5 ${isDenied || isFailed ? "text-rose-400" : isPending ? "text-amber-300" : "text-[#FFC439]"}`} />
            <span className="text-xs font-bold tracking-wide uppercase">
              PayPal Execution Boundary
            </span>
          </div>
          <span className={`text-[10px] font-bold px-2 py-0.5 rounded tracking-wider uppercase w-fit ${
            isDenied
              ? "bg-rose-500 text-white"
              : isFailed
              ? "bg-rose-500 text-white"
              : isPending
              ? "bg-amber-400 text-slate-950"
              : evaluation.paypalCalled
              ? isCaptured
                ? "bg-emerald-400 text-slate-950"
                : "bg-blue-300 text-slate-950"
              : "bg-slate-700 text-slate-100"
          }`}>
            {isDenied
              ? "PAYPAL NOT CALLED"
              : isFailed
              ? evaluation.paypalCalled
                ? "PAYPAL CALL FAILED"
                : "PAYPAL NOT CALLED"
              : isPending
              ? "PAYER APPROVAL REQUIRED"
              : evaluation.paypalCalled
              ? isCaptured
                ? "PAYPAL CAPTURED"
                : "PAYPAL ORDER CREATED"
              : "PAYPAL NOT CALLED"}
          </span>
        </div>

        {isDenied ? (
          <div className="text-xs space-y-1 font-mono">
            <div className="text-rose-200 font-bold">Zero Money Movement: PayPal API was never invoked.</div>
            <div className="text-[11px] text-rose-300/90 font-sans">
              Failed gate: {evaluation.failedCheck || "POLICY_RULE"} • {evaluation.reason}
            </div>
          </div>
        ) : isFailed ? (
          <div className="text-xs space-y-1 font-mono">
            <div className="text-rose-200 font-bold">
              Payment request failed{evaluation.paypalCalled ? " after crossing the PayPal boundary." : " before crossing the PayPal boundary."}
            </div>
            <div className="text-[11px] text-rose-300/90 font-sans">
              {evaluation.reason || "The payment request could not be completed."}
            </div>
            {evaluation.paypalOrderId && (
              <div className="text-[11px] text-rose-200/90 font-mono break-all">
                PayPal Order: {evaluation.paypalOrderId}
              </div>
            )}
          </div>
        ) : isPending ? (
          <div className="text-xs space-y-2 font-mono">
            <div className="font-bold">Policy passed. PayPal is waiting for payer approval.</div>
            <div className="text-[11px] text-amber-200/85 font-sans">
              Order {evaluation.paypalOrderId || "pending"} is created and reserved against the mandate budget.
            </div>
            {evaluation.approvalUrl && (
              <a
                href={evaluation.approvalUrl}
                className="selo-button !min-h-[36px] !rounded-xl !px-3 bg-amber-300 text-slate-950 inline-flex"
              >
                Continue to PayPal
                <ExternalLink className="w-3.5 h-3.5" />
              </a>
            )}
          </div>
        ) : evaluation.paypalCalled ? (
          <div className="text-xs space-y-1 font-mono">
            <div>
              <span className="text-blue-200">PayPal Order ID: </span>
              <span className="font-bold text-yellow-300 break-all">
                {evaluation.paypalOrderId || "UNKNOWN"}
              </span>
            </div>
            {evaluation.paypalCaptureId && (
              <div>
                <span className="text-blue-200">Capture ID: </span>
                <span className="text-emerald-300 break-all">{evaluation.paypalCaptureId}</span>
              </div>
            )}
            <div className="text-[11px] text-blue-200/90 font-sans pt-1">
              {isCaptured
                ? `Server-side PayPal capture completed for $${(evaluation.amount / 100).toFixed(2)} USD.`
                : `PayPal order created for $${(evaluation.amount / 100).toFixed(2)} USD and is awaiting payer completion.`}
            </div>
          </div>
        ) : (
          <div className="text-xs space-y-1 font-mono">
            <div className="font-bold text-slate-100">Policy approved in dry-run mode.</div>
            <div className="text-[11px] text-slate-300/80 font-sans">
              PayPal was intentionally not called. Use Execute PayPal Payment to cross the execution boundary.
            </div>
          </div>
        )}
      </div>

      {evaluation.aiExplanation && (
        <div className="mt-4 p-3.5 rounded-xl border bg-purple-950/40 border-purple-800/60 text-xs flex items-start gap-2.5">
          <Sparkles className="w-4 h-4 text-purple-400 shrink-0 mt-0.5" />
          <div>
            <span className="font-bold block mb-0.5 text-purple-300">AI Decision Explanation (Read-Only)</span>
            <p className="leading-relaxed font-sans text-slate-300">{evaluation.aiExplanation}</p>
          </div>
        </div>
      )}
    </div>
  );
}

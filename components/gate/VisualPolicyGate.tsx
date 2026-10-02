"use client";

import React from "react";
import {
  CheckCircle,
  XCircle,
  AlertOctagon,
  ArrowRight,
  ShieldCheck,
  CreditCard,
  Sparkles,
  Lock,
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
}

export function VisualPolicyGate({ evaluation, loading }: VisualPolicyGateProps) {
  if (loading) {
    return (
      <div className="bg-white/95 backdrop-blur-md rounded-2xl p-6 border border-slate-200 shadow-xl text-center">
        <div className="inline-block animate-spin w-8 h-8 border-4 border-paypal-blue border-t-transparent rounded-full mb-3" />
        <h3 className="text-sm font-bold text-slate-800">Evaluating Mandate Invariants...</h3>
        <p className="text-xs text-slate-500 mt-1">Executing deterministic policy checks on server</p>
      </div>
    );
  }

  if (!evaluation) {
    return (
      <div className="bg-white/95 backdrop-blur-md rounded-2xl p-6 border border-slate-200 shadow-xl text-center">
        <div className="w-12 h-12 rounded-2xl bg-blue-50 text-paypal-blue flex items-center justify-center mx-auto mb-3 border border-blue-100 shadow-sm">
          <ShieldCheck className="w-6 h-6" />
        </div>
        <h3 className="text-sm font-bold text-slate-900">Deterministic Policy Gate Ready</h3>
        <p className="text-xs text-slate-500 max-w-sm mx-auto mt-1">
          Select an agent purchase scenario above and click &quot;Dry-Run Policy Gate&quot; or &quot;Execute PayPal Payment&quot; to inspect real-time authorization.
        </p>
      </div>
    );
  }

  const isAllowed = evaluation.status === "ALLOWED" || evaluation.status === "COMPLETED";
  const checks = evaluation.checks || {};

  const gateSteps = [
    {
      key: "MANDATE_EXISTS",
      title: "1. Mandate",
      subtitle: "Identified",
      passed: checks.MANDATE_EXISTS?.passed ?? true,
      message: checks.MANDATE_EXISTS?.message,
    },
    {
      key: "MANDATE_ACTIVE",
      title: "2. Active",
      subtitle: "Not Revoked",
      passed:
        (checks.MANDATE_ACTIVE?.passed ?? true) &&
        (checks.MANDATE_NOT_REVOKED?.passed ?? true),
      message: checks.MANDATE_NOT_REVOKED?.passed === false
        ? checks.MANDATE_NOT_REVOKED.message
        : checks.MANDATE_ACTIVE?.message,
    },
    {
      key: "MERCHANT_ALLOWED",
      title: "3. Merchant",
      subtitle: "Authorized",
      passed: checks.MERCHANT_ALLOWED?.passed ?? true,
      message: checks.MERCHANT_ALLOWED?.message,
    },
    {
      key: "CATEGORY_ALLOWED",
      title: "4. Category",
      subtitle: "Permitted",
      passed: checks.CATEGORY_ALLOWED?.passed ?? true,
      message: checks.CATEGORY_ALLOWED?.message,
    },
    {
      key: "BUDGET_SUFFICIENT",
      title: "5. Budget",
      subtitle: "Remaining",
      passed: checks.BUDGET_SUFFICIENT?.passed ?? true,
      message: checks.BUDGET_SUFFICIENT?.message,
    },
  ];

  return (
    <div className="bg-white/95 backdrop-blur-md rounded-2xl p-6 border border-slate-200/80 shadow-xl transition-all">
      {/* Header */}
      <div className="flex items-center justify-between mb-5 pb-3 border-b border-slate-200">
        <div className="flex items-center space-x-2.5">
          <div
            className={`w-3 h-3 rounded-full ${
              isAllowed ? "bg-emerald-500 animate-pulse" : "bg-rose-500 animate-pulse"
            }`}
          />
          <h2 className="text-base font-black text-slate-900 tracking-tight">
            Visual Policy Gate Evaluation
          </h2>
        </div>
        <span
          className={`px-3 py-1 rounded-full text-xs font-black uppercase tracking-wider ${
            isAllowed
              ? "bg-emerald-100 text-emerald-800 border border-emerald-300"
              : "bg-rose-100 text-rose-800 border border-rose-300"
          }`}
        >
          {evaluation.status}
        </span>
      </div>

      {/* 5 Sequential Policy Check Gates */}
      <div className="grid grid-cols-2 sm:grid-cols-5 gap-2.5 mb-5">
        {gateSteps.map((step, idx) => (
          <div
            key={idx}
            className={`p-3 rounded-xl border flex flex-col justify-between transition-all ${
              step.passed
                ? "bg-emerald-50/70 border-emerald-200 text-emerald-950"
                : "bg-rose-50/90 border-rose-300 text-rose-950 shadow-md ring-2 ring-rose-400/20"
            }`}
          >
            <div className="flex items-center justify-between mb-1.5">
              <span className="text-[11px] font-bold text-slate-700">{step.title}</span>
              {step.passed ? (
                <CheckCircle className="w-4 h-4 text-emerald-600 shrink-0" />
              ) : (
                <XCircle className="w-4 h-4 text-rose-600 shrink-0" />
              )}
            </div>
            <div>
              <div className="text-[11px] font-semibold text-slate-900 leading-tight">
                {step.subtitle}
              </div>
              <div
                className={`text-[9px] font-bold uppercase mt-1 ${
                  step.passed ? "text-emerald-700" : "text-rose-700"
                }`}
              >
                {step.passed ? "PASSED" : "FAILED"}
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Final PayPal Gateway Execution State */}
      <div
        className={`p-4 rounded-xl border transition-all ${
          isAllowed
            ? "bg-gradient-to-r from-blue-900 to-[#003087] text-white border-blue-800 shadow-lg"
            : "bg-rose-950 text-rose-100 border-rose-900 shadow-md"
        }`}
      >
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center space-x-2">
            <CreditCard className={`w-5 h-5 ${isAllowed ? "text-[#FFC439]" : "text-rose-400"}`} />
            <span className="text-xs font-black tracking-wide uppercase">
              PayPal Execution Boundary
            </span>
          </div>
          <span
            className={`text-[10px] font-extrabold px-2 py-0.5 rounded tracking-wider uppercase ${
              isAllowed
                ? "bg-emerald-400 text-slate-950"
                : "bg-rose-500 text-white"
            }`}
          >
            {evaluation.paypalCalled ? "PAYPAL CAPTURED" : "PAYPAL NOT CALLED"}
          </span>
        </div>

        {isAllowed ? (
          <div className="text-xs space-y-1 font-mono">
            <div>
              <span className="text-blue-200">PayPal Order ID: </span>
              <span className="font-bold text-yellow-300">
                {evaluation.paypalOrderId || "PENDING_CAPTURE"}
              </span>
            </div>
            {evaluation.paypalCaptureId && (
              <div>
                <span className="text-blue-200">Capture ID: </span>
                <span className="text-emerald-300">{evaluation.paypalCaptureId}</span>
              </div>
            )}
            <div className="text-[11px] text-blue-200/80 font-sans pt-1">
              ✓ Server-side capture succeeded for ${(evaluation.amount / 100).toFixed(2)} USD
            </div>
          </div>
        ) : (
          <div className="text-xs space-y-1 font-mono">
            <div className="text-rose-200 font-bold">
              🚫 Zero Money Movement: PayPal API was never invoked.
            </div>
            <div className="text-[11px] text-rose-300/80 font-sans">
              Failed gate: {evaluation.failedCheck || "POLICY_RULE"} • {evaluation.reason}
            </div>
          </div>
        )}
      </div>

      {/* AI Read-Only Explanation Card */}
      {evaluation.aiExplanation && (
        <div className="mt-4 p-3.5 rounded-xl bg-purple-50/80 border border-purple-200 text-xs text-purple-950 flex items-start space-x-2.5">
          <Sparkles className="w-4 h-4 text-purple-600 shrink-0 mt-0.5" />
          <div>
            <span className="font-bold text-purple-900 block mb-0.5">
              AI Decision Explanation (Read-Only)
            </span>
            <p className="text-slate-700 leading-relaxed font-sans">
              {evaluation.aiExplanation}
            </p>
          </div>
        </div>
      )}
    </div>
  );
}

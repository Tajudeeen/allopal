"use client";

import React from "react";
import { History, CheckCircle, XCircle } from "lucide-react";

interface DecisionRecord {
  id: string;
  mandateId: string;
  cartId: string;
  amount: number;
  merchant: string;
  category: string;
  status: string; // ALLOWED | DENIED
  reason: string;
  paypalOrderId: string | null;
  paymentStatus?: string | null;
  paypalCaptureId?: string | null;
  createdAt: string;
}

interface DecisionLedgerProps {
  decisions: DecisionRecord[];
  isDark?: boolean;
}

export function DecisionLedger({ decisions, isDark = true }: DecisionLedgerProps) {
  return (
    <div
      className={`selo-card selo-dark-card rounded-[26px] p-6 border shadow-2xl backdrop-blur-2xl transition-all ${
        isDark
          ? "bg-slate-900/85 border-slate-700/80 text-white shadow-black/50"
          : "bg-white/95 border-slate-200/90 text-slate-900 shadow-xl"
      }`}
    >
      {/* Header */}
      <div
        className={`flex items-center justify-between mb-4 pb-3 border-b ${
          isDark ? "border-slate-800" : "border-slate-200"
        }`}
      >
        <div className="flex items-center space-x-3">
          <div
            className={`w-9 h-9 rounded-xl border flex items-center justify-center ${
              isDark
                ? "bg-slate-800/80 border-slate-700 text-slate-300"
                : "bg-slate-100 border-slate-200 text-slate-700"
            }`}
          >
            <History className="w-5 h-5" />
          </div>
          <div>
            <h2 className="text-base font-bold tracking-tight">
              Authoritative Decision Ledger
            </h2>
            <p className={`text-xs ${isDark ? "text-slate-400" : "text-slate-500"}`}>
              Immutable audit trail of all policy evaluations and PayPal order references
            </p>
          </div>
        </div>
        <span
          className={`text-xs font-mono font-bold ${
            isDark ? "text-slate-400" : "text-slate-500"
          }`}
        >
          {decisions.length} recorded
        </span>
      </div>

      {/* Decision Table */}
      {decisions.length === 0 ? (
        <div
          className={`py-8 text-center text-xs ${
            isDark ? "text-slate-400" : "text-slate-500"
          }`}
        >
          No decisions recorded yet. Run a test scenario above to populate the ledger.
        </div>
      ) : (
        <>
        <div className="hidden sm:block overflow-x-auto">
          <table className="w-full min-w-[760px] text-left text-xs">
            <thead>
              <tr
                className={`text-[10px] font-bold uppercase tracking-wider border-b ${
                  isDark
                    ? "text-slate-400 border-slate-800"
                    : "text-slate-500 border-slate-100"
                }`}
              >
                <th className="pb-2.5 font-bold">Status</th>
                <th className="pb-2.5 font-bold">Amount</th>
                <th className="pb-2.5 font-bold">Merchant / Category</th>
                <th className="pb-2.5 font-bold">Reason</th>
                <th className="pb-2.5 font-bold">PayPal Order ID</th>
                <th className="pb-2.5 font-bold text-right">Time</th>
              </tr>
            </thead>
            <tbody
              className={`divide-y ${
                isDark ? "divide-slate-800/60" : "divide-slate-100"
              }`}
            >
              {decisions.map((d) => {
                const isAllowed = d.status === "ALLOWED";
                const isCaptured = d.paymentStatus === "COMPLETED";
                const isPending = isAllowed && d.paymentStatus === "CREATED";
                return (
                  <tr
                    key={d.id}
                    className={`transition-colors ${
                      isDark ? "hover:bg-slate-800/40" : "hover:bg-slate-50/70"
                    }`}
                  >
                    <td className="py-3">
                      <span
                        className={`inline-flex items-center space-x-1 px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider border ${
                          isAllowed
                            ? isDark
                              ? "bg-emerald-950/80 text-emerald-300 border-emerald-700/60"
                              : "bg-emerald-100 text-emerald-800 border-emerald-300"
                            : isDark
                            ? "bg-rose-950/80 text-rose-300 border-rose-700/60"
                            : "bg-rose-100 text-rose-800 border-rose-300"
                        }`}
                      >
                        {isAllowed ? (
                          <CheckCircle className={"w-3 h-3 " + (isCaptured ? "text-emerald-400" : isPending ? "text-amber-400" : "text-blue-400")} />
                        ) : (
                          <XCircle className="w-3 h-3 text-rose-400" />
                        )}
                        <span>{isAllowed ? (isCaptured ? "CAPTURED" : isPending ? "AWAITING PAYER" : "ALLOWED") : "BLOCKED"}</span>
                      </span>
                    </td>
                    <td
                      className={`py-3 font-mono font-bold ${
                        isDark ? "text-white" : "text-slate-900"
                      }`}
                    >
                      ${(d.amount / 100).toFixed(2)}
                    </td>
                    <td className="py-3">
                      <div
                        className={`font-semibold ${
                          isDark ? "text-slate-100" : "text-slate-800"
                        }`}
                      >
                        {d.merchant}
                      </div>
                      <div
                        className={`text-[11px] ${
                          isDark ? "text-slate-400" : "text-slate-500"
                        }`}
                      >
                        {d.category}
                      </div>
                    </td>
                    <td
                      className={`py-3 max-w-xs text-[11px] leading-relaxed ${
                        isDark ? "text-slate-300" : "text-slate-600"
                      }`}
                    >
                      {d.reason}
                    </td>
                    <td className="py-3 font-mono text-[11px]">
                      {d.paypalOrderId ? (
                        <span
                          className={`font-bold flex items-center space-x-1 ${
                            isDark ? "text-blue-300" : "text-blue-700"
                          }`}
                        >
                          <span>{d.paypalOrderId}</span>
                        </span>
                      ) : (
                        <span
                          className={`italic ${
                            isDark ? "text-slate-500" : "text-slate-400"
                          }`}
                        >
                          null (Not Called)
                        </span>
                      )}
                    </td>
                    <td
                      className={`py-3 text-right font-mono text-[10px] ${
                        isDark ? "text-slate-400" : "text-slate-500"
                      }`}
                    >
                      {new Date(d.createdAt).toLocaleTimeString()}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        <div className="sm:hidden space-y-2.5">
          {decisions.map((d) => {
            const isAllowed = d.status === "ALLOWED";
            const isCaptured = d.paymentStatus === "COMPLETED";
            const isPending = isAllowed && d.paymentStatus === "CREATED";
            return (
              <div key={d.id} className="selo-inner-card rounded-[18px] border p-4 space-y-3">
                <div className="flex items-center justify-between gap-3">
                  <span className={`inline-flex items-center gap-1.5 px-2 py-1 rounded-full text-[9px] font-bold uppercase tracking-wider border ${
                    isAllowed
                      ? isCaptured
                        ? "bg-emerald-950/80 text-emerald-300 border-emerald-700/60"
                        : isPending
                        ? "bg-amber-950/80 text-amber-300 border-amber-700/60"
                        : "bg-blue-950/80 text-blue-300 border-blue-700/60"
                      : "bg-rose-950/80 text-rose-300 border-rose-700/60"
                  }`}>
                    {isAllowed ? <CheckCircle className={`w-3 h-3 ${isCaptured ? "text-emerald-400" : isPending ? "text-amber-400" : "text-blue-400"}`} /> : <XCircle className="w-3 h-3 text-rose-400" />}
                    {isAllowed ? (isCaptured ? "captured" : isPending ? "awaiting payer" : "allowed") : "blocked"}
                  </span>
                  <span className="font-mono text-sm font-bold text-white">${(d.amount / 100).toFixed(2)}</span>
                </div>

                <div>
                  <div className="text-sm font-semibold text-white">{d.merchant}</div>
                  <div className="text-[11px] text-slate-300">{d.category}</div>
                </div>

                <p className="text-[11px] leading-relaxed text-slate-300">{d.reason}</p>

                <div className="grid grid-cols-2 gap-2 text-[10px] font-mono">
                  <div className="rounded-xl border border-slate-200 bg-white p-2">
                    <span className="block text-[10px] font-semibold uppercase tracking-wider text-slate-400 mb-1">paypal order</span>
                    <span className="text-blue-300 break-all">{d.paypalOrderId || "null"}</span>
                  </div>
                  <div className="rounded-xl border border-white/[0.09] bg-white/[0.035] p-2">
                    <span className="block text-[10px] font-semibold uppercase tracking-wider text-slate-500 mb-1">time</span>
                    <span className="text-slate-200">{new Date(d.createdAt).toLocaleTimeString()}</span>
                  </div>
                  <div className="rounded-xl border border-white/[0.07] bg-white/[0.025] p-2">
                    <span className="block text-[10px] font-semibold uppercase tracking-wider text-slate-500 mb-1">payment state</span>
                    <span className="text-slate-700">{d.paymentStatus || "policy-only"}</span>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
        </>
      )}
    </div>
  );
}

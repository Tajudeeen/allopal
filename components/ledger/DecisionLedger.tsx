"use client";

import React from "react";
import { History, CheckCircle, XCircle, ExternalLink, Shield } from "lucide-react";

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
  createdAt: string;
}

interface DecisionLedgerProps {
  decisions: DecisionRecord[];
}

export function DecisionLedger({ decisions }: DecisionLedgerProps) {
  return (
    <div className="bg-white/95 backdrop-blur-md rounded-2xl p-6 border border-slate-200/80 shadow-xl transition-all">
      {/* Header */}
      <div className="flex items-center justify-between mb-4 pb-3 border-b border-slate-200">
        <div className="flex items-center space-x-3">
          <div className="w-9 h-9 rounded-xl bg-slate-100 border border-slate-200 text-slate-700 flex items-center justify-center">
            <History className="w-5 h-5" />
          </div>
          <div>
            <h2 className="text-base font-black text-slate-900 tracking-tight">
              Authoritative Decision Ledger
            </h2>
            <p className="text-xs text-slate-500">
              Immutable audit trail of all policy evaluations and PayPal order references
            </p>
          </div>
        </div>
        <span className="text-xs font-mono font-bold text-slate-500">
          {decisions.length} recorded
        </span>
      </div>

      {/* Decision Table */}
      {decisions.length === 0 ? (
        <div className="py-8 text-center text-xs text-slate-400">
          No decisions recorded yet. Run a test scenario above to populate the ledger.
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead>
              <tr className="text-[10px] font-extrabold uppercase tracking-wider text-slate-400 border-b border-slate-100">
                <th className="pb-2.5 font-bold">Status</th>
                <th className="pb-2.5 font-bold">Amount</th>
                <th className="pb-2.5 font-bold">Merchant / Category</th>
                <th className="pb-2.5 font-bold">Reason</th>
                <th className="pb-2.5 font-bold">PayPal Order ID</th>
                <th className="pb-2.5 font-bold text-right">Time</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {decisions.map((d) => {
                const isAllowed = d.status === "ALLOWED";
                return (
                  <tr key={d.id} className="hover:bg-slate-50/60 transition-colors">
                    <td className="py-3">
                      <span
                        className={`inline-flex items-center space-x-1 px-2 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider ${
                          isAllowed
                            ? "bg-emerald-100 text-emerald-800 border border-emerald-300"
                            : "bg-rose-100 text-rose-800 border border-rose-300"
                        }`}
                      >
                        {isAllowed ? (
                          <CheckCircle className="w-3 h-3 text-emerald-600" />
                        ) : (
                          <XCircle className="w-3 h-3 text-rose-600" />
                        )}
                        <span>{isAllowed ? "CAPTURED" : "BLOCKED"}</span>
                      </span>
                    </td>
                    <td className="py-3 font-mono font-bold text-slate-900">
                      ${(d.amount / 100).toFixed(2)}
                    </td>
                    <td className="py-3">
                      <div className="font-semibold text-slate-800">{d.merchant}</div>
                      <div className="text-[11px] text-slate-500">{d.category}</div>
                    </td>
                    <td className="py-3 max-w-xs text-slate-600 text-[11px]">
                      {d.reason}
                    </td>
                    <td className="py-3 font-mono text-[11px]">
                      {d.paypalOrderId ? (
                        <span className="text-paypal-blue font-bold flex items-center space-x-1">
                          <span>{d.paypalOrderId}</span>
                        </span>
                      ) : (
                        <span className="text-slate-400 italic">null (Not Called)</span>
                      )}
                    </td>
                    <td className="py-3 text-right text-slate-400 font-mono text-[10px]">
                      {new Date(d.createdAt).toLocaleTimeString()}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

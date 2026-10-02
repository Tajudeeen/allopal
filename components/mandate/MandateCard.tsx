"use client";

import React, { useState } from "react";
import { Shield, Ban, Calendar, Store, Tag, DollarSign, AlertCircle, CheckCircle } from "lucide-react";

interface MandateData {
  id: string;
  name: string;
  weeklyLimit: number; // cents
  spentAmount: number; // cents
  status: string; // ACTIVE | REVOKED | EXPIRED
  allowedCategories: string[];
  allowedMerchants: string[];
  validFrom: string;
  validUntil: string;
}

interface MandateCardProps {
  mandate: MandateData | null;
  onRevoke: (mandateId: string) => Promise<void>;
}

export function MandateCard({ mandate, onRevoke }: MandateCardProps) {
  const [revoking, setRevoking] = useState(false);

  if (!mandate) {
    return (
      <div className="bg-white/90 backdrop-blur-md rounded-2xl p-6 border border-slate-200 shadow-xl text-center">
        <p className="text-slate-500 font-medium">No active mandate found.</p>
      </div>
    );
  }

  const remaining = Math.max(0, mandate.weeklyLimit - mandate.spentAmount);
  const percentSpent = Math.min(100, Math.round((mandate.spentAmount / mandate.weeklyLimit) * 100));
  const isRevoked = mandate.status === "REVOKED";
  const isActive = mandate.status === "ACTIVE";

  const handleRevoke = async () => {
    if (!confirm(`Are you sure you want to revoke the "${mandate.name}" mandate? This will immediately prevent all agent spending.`)) {
      return;
    }
    setRevoking(true);
    try {
      await onRevoke(mandate.id);
    } finally {
      setRevoking(false);
    }
  };

  return (
    <div className="bg-white/95 backdrop-blur-md rounded-2xl p-6 border border-slate-200/80 shadow-xl transition-all relative overflow-hidden">
      {/* Decorative top accent line */}
      <div
        className={`absolute top-0 left-0 right-0 h-1.5 ${
          isActive ? "bg-gradient-to-r from-emerald-500 via-teal-500 to-blue-500" : "bg-rose-500"
        }`}
      />

      {/* Header */}
      <div className="flex items-start justify-between">
        <div className="flex items-center space-x-3">
          <div
            className={`w-11 h-11 rounded-xl flex items-center justify-center shadow-md ${
              isActive
                ? "bg-blue-50 text-paypal-blue border border-blue-200"
                : "bg-rose-50 text-rose-600 border border-rose-200"
            }`}
          >
            <Shield className="w-6 h-6" />
          </div>
          <div>
            <div className="flex items-center space-x-2">
              <h2 className="text-lg font-black text-slate-900 tracking-tight">{mandate.name}</h2>
              <span
                className={`px-2.5 py-0.5 rounded-full text-[11px] font-bold uppercase tracking-wider ${
                  isActive
                    ? "bg-emerald-100 text-emerald-800 border border-emerald-300"
                    : "bg-rose-100 text-rose-800 border border-rose-300"
                }`}
              >
                {mandate.status}
              </span>
            </div>
            <p className="text-xs text-slate-500 font-mono mt-0.5">ID: {mandate.id}</p>
          </div>
        </div>

        {/* Revoke Button */}
        {isActive && (
          <button
            onClick={handleRevoke}
            disabled={revoking}
            className="flex items-center space-x-1.5 px-3 py-1.5 rounded-lg bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 text-xs font-semibold shadow-sm transition-all hover:scale-[1.02] active:scale-[0.98] disabled:opacity-50"
          >
            <Ban className="w-3.5 h-3.5" />
            <span>{revoking ? "Revoking..." : "Revoke Mandate"}</span>
          </button>
        )}
      </div>

      {/* Budget Balance Visualization */}
      <div className="mt-5 p-4 rounded-xl bg-slate-50 border border-slate-200/80">
        <div className="flex justify-between items-baseline mb-2">
          <div>
            <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Remaining Budget</span>
            <div className="text-2xl font-black text-slate-900">
              ${(remaining / 100).toFixed(2)}
              <span className="text-xs font-normal text-slate-500 ml-1.5">
                of ${(mandate.weeklyLimit / 100).toFixed(2)} limit
              </span>
            </div>
          </div>
          <div className="text-right">
            <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Spent</span>
            <div className="text-lg font-bold text-slate-700">
              ${(mandate.spentAmount / 100).toFixed(2)}
            </div>
          </div>
        </div>

        {/* Progress Bar */}
        <div className="w-full bg-slate-200 rounded-full h-2.5 overflow-hidden">
          <div
            className={`h-full rounded-full transition-all duration-500 ${
              percentSpent > 90
                ? "bg-rose-500"
                : percentSpent > 50
                ? "bg-amber-500"
                : "bg-emerald-500"
            }`}
            style={{ width: `${percentSpent}%` }}
          />
        </div>
        <div className="flex justify-between text-[11px] text-slate-500 mt-1 font-medium">
          <span>{percentSpent}% consumed</span>
          <span>{100 - percentSpent}% left</span>
        </div>
      </div>

      {/* Constraint Badges */}
      <div className="mt-4 grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
        {/* Categories */}
        <div className="p-3 bg-slate-50/80 rounded-xl border border-slate-200/60">
          <div className="flex items-center space-x-1.5 text-slate-600 font-semibold mb-1.5">
            <Tag className="w-3.5 h-3.5 text-blue-600" />
            <span>Allowed Categories</span>
          </div>
          <div className="flex flex-wrap gap-1.5">
            {mandate.allowedCategories.map((cat, idx) => (
              <span
                key={idx}
                className="px-2 py-0.5 rounded-md bg-blue-100/80 text-paypal-blue font-semibold text-[11px]"
              >
                {cat}
              </span>
            ))}
          </div>
        </div>

        {/* Merchants */}
        <div className="p-3 bg-slate-50/80 rounded-xl border border-slate-200/60">
          <div className="flex items-center space-x-1.5 text-slate-600 font-semibold mb-1.5">
            <Store className="w-3.5 h-3.5 text-blue-600" />
            <span>Allowed Merchants</span>
          </div>
          <div className="flex flex-wrap gap-1.5">
            {mandate.allowedMerchants.map((merch, idx) => (
              <span
                key={idx}
                className="px-2 py-0.5 rounded-md bg-indigo-100/80 text-indigo-900 font-semibold text-[11px]"
              >
                {merch}
              </span>
            ))}
          </div>
        </div>
      </div>

      {/* Expiry / Lock Status */}
      <div className="mt-4 pt-3 border-t border-slate-200 flex items-center justify-between text-[11px] text-slate-500">
        <div className="flex items-center space-x-1">
          <Calendar className="w-3.5 h-3.5 text-slate-400" />
          <span>Valid through: {new Date(mandate.validUntil).toLocaleDateString()}</span>
        </div>
        <div className="flex items-center space-x-1 font-semibold">
          {isActive ? (
            <span className="text-emerald-700 flex items-center space-x-1">
              <CheckCircle className="w-3.5 h-3.5" />
              <span>Human-Locked &amp; Authoritative</span>
            </span>
          ) : (
            <span className="text-rose-700 flex items-center space-x-1">
              <AlertCircle className="w-3.5 h-3.5" />
              <span>Spending Blocked</span>
            </span>
          )}
        </div>
      </div>
    </div>
  );
}

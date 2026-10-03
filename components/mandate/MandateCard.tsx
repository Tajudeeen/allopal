"use client";

import React, { useState } from "react";
import { Shield, Ban, Calendar, Store, Tag, AlertCircle, CheckCircle } from "lucide-react";

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
  isDark?: boolean;
}

export function MandateCard({ mandate, onRevoke, isDark = true }: MandateCardProps) {
  const [revoking, setRevoking] = useState(false);

  if (!mandate) {
    return (
      <div
        className={`selo-card selo-dark-card rounded-[26px] p-6 border shadow-xl text-center transition-all ${
          isDark
            ? "bg-slate-900/85 backdrop-blur-xl border-slate-800 text-slate-400"
            : "bg-white/90 backdrop-blur-xl border-slate-200 text-slate-500"
        }`}
      >
        <p className="font-medium">No active mandate found.</p>
      </div>
    );
  }

  const remaining = Math.max(0, mandate.weeklyLimit - mandate.spentAmount);
  const percentSpent = Math.min(100, Math.round((mandate.spentAmount / mandate.weeklyLimit) * 100));
  const isRevoked = mandate.status === "REVOKED";
  const isActive = mandate.status === "ACTIVE";

  const handleRevoke = async () => {
    if (
      !confirm(
        `Are you sure you want to revoke the "${mandate.name}" mandate? This will immediately prevent all agent spending.`
      )
    ) {
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
    <div
      className={`selo-card selo-dark-card rounded-[26px] p-6 border shadow-2xl transition-all relative overflow-hidden backdrop-blur-2xl ${
        isDark
          ? "bg-slate-900/85 border-slate-700/80 text-white shadow-black/50"
          : "bg-white/95 border-slate-200/90 text-slate-900 shadow-xl"
      }`}
    >
      {/* Decorative top accent line */}
      <div
        className={`absolute top-0 left-0 right-0 h-1.5 ${
          isActive
            ? "bg-gradient-to-r from-emerald-500 via-teal-500 to-blue-500"
            : "bg-rose-500"
        }`}
      />

      {/* Header */}
      <div className="flex items-start justify-between">
        <div className="flex items-center space-x-3">
          <div
            className={`w-11 h-11 rounded-xl flex items-center justify-center shadow-md flex-none ${
              isActive
                ? isDark
                  ? "bg-blue-950/80 text-blue-400 border border-blue-800/60"
                  : "bg-blue-50 text-blue-700 border border-blue-200"
                : isDark
                ? "bg-rose-950/80 text-rose-400 border border-rose-800/60"
                : "bg-rose-50 text-rose-600 border border-rose-200"
            }`}
          >
            <Shield className="w-6 h-6" />
          </div>
          <div>
            <div className="flex items-center space-x-2">
              <h2
                className={`text-lg font-bold tracking-tight ${
                  isDark ? "text-white" : "text-slate-900"
                }`}
              >
                {mandate.name}
              </h2>
              <span
                className={`px-2.5 py-0.5 rounded-full text-[11px] font-bold uppercase tracking-wider border ${
                  isActive
                    ? isDark
                      ? "bg-emerald-950/80 text-emerald-300 border-emerald-700/60"
                      : "bg-emerald-100 text-emerald-800 border-emerald-300"
                    : isDark
                    ? "bg-rose-950/80 text-rose-300 border-rose-700/60"
                    : "bg-rose-100 text-rose-800 border-rose-300"
                }`}
              >
                {mandate.status}
              </span>
            </div>
            <p
              className={`text-xs font-mono mt-0.5 ${
                isDark ? "text-slate-400" : "text-slate-500"
              }`}
            >
              ID: {mandate.id}
            </p>
          </div>
        </div>

        {/* Revoke Button */}
        {isActive && (
          <button
            onClick={handleRevoke}
            disabled={revoking}
            className={`selo-button selo-button-danger !min-h-[36px] !rounded-xl !px-3 flex items-center space-x-1.5 disabled:opacity-50 ${
              isDark
                ? "bg-rose-950/80 hover:bg-rose-900 text-rose-300 border-rose-700/80"
                : "bg-rose-50 hover:bg-rose-100 text-rose-700 border-rose-200"
            }`}
          >
            <Ban className="w-3.5 h-3.5" />
            <span>{revoking ? "Revoking..." : "Revoke Mandate"}</span>
          </button>
        )}
      </div>

      {/* Budget Balance Visualization */}
      <div
        className={`mt-5 p-4 rounded-xl border ${
          isDark
            ? "bg-slate-950/60 border-slate-800/80"
            : "bg-slate-50 border-slate-200/80"
        }`}
      >
        <div className="flex justify-between items-baseline mb-2">
          <div>
            <span
              className={`text-xs font-semibold uppercase tracking-wider ${
                isDark ? "text-slate-400" : "text-slate-500"
              }`}
            >
              Remaining Budget
            </span>
            <div
              className={`text-2xl font-black ${
                isDark ? "text-white" : "text-slate-900"
              }`}
            >
              ${(remaining / 100).toFixed(2)}
              <span
                className={`text-xs font-normal ml-1.5 ${
                  isDark ? "text-slate-400" : "text-slate-500"
                }`}
              >
                of ${(mandate.weeklyLimit / 100).toFixed(2)} limit
              </span>
            </div>
          </div>
          <div className="text-right">
            <span
              className={`text-xs font-semibold uppercase tracking-wider ${
                isDark ? "text-slate-400" : "text-slate-500"
              }`}
            >
              Spent
            </span>
            <div
              className={`text-lg font-bold ${
                isDark ? "text-slate-200" : "text-slate-700"
              }`}
            >
              ${(mandate.spentAmount / 100).toFixed(2)}
            </div>
          </div>
        </div>

        {/* Progress Bar */}
        <div
          className={`w-full rounded-full h-2.5 overflow-hidden ${
            isDark ? "bg-slate-800" : "bg-slate-200"
          }`}
        >
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
        <div
          className={`flex justify-between text-[11px] mt-1 font-medium ${
            isDark ? "text-slate-400" : "text-slate-500"
          }`}
        >
          <span>{percentSpent}% consumed</span>
          <span>{100 - percentSpent}% left</span>
        </div>
      </div>

      {/* Constraint Badges */}
      <div className="mt-4 grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
        {/* Categories */}
        <div
          className={`p-3 rounded-xl border ${
            isDark
              ? "bg-slate-950/60 border-slate-800/80"
              : "bg-slate-50/80 border-slate-200/60"
          }`}
        >
          <div
            className={`flex items-center space-x-1.5 font-semibold mb-1.5 ${
              isDark ? "text-slate-300" : "text-slate-600"
            }`}
          >
            <Tag className="w-3.5 h-3.5 text-blue-400" />
            <span>Allowed Categories</span>
          </div>
          <div className="flex flex-wrap gap-1.5">
            {mandate.allowedCategories.map((cat, idx) => (
              <span
                key={idx}
                className={`px-2 py-0.5 rounded-md font-semibold text-[11px] border ${
                  isDark
                    ? "bg-blue-950/70 text-blue-300 border-blue-800/60"
                    : "bg-blue-100/80 text-blue-800 border-blue-200"
                }`}
              >
                {cat}
              </span>
            ))}
          </div>
        </div>

        {/* Merchants */}
        <div
          className={`p-3 rounded-xl border ${
            isDark
              ? "bg-slate-950/60 border-slate-800/80"
              : "bg-slate-50/80 border-slate-200/60"
          }`}
        >
          <div
            className={`flex items-center space-x-1.5 font-semibold mb-1.5 ${
              isDark ? "text-slate-300" : "text-slate-600"
            }`}
          >
            <Store className="w-3.5 h-3.5 text-indigo-400" />
            <span>Allowed Merchants</span>
          </div>
          <div className="flex flex-wrap gap-1.5">
            {mandate.allowedMerchants.map((merch, idx) => (
              <span
                key={idx}
                className={`px-2 py-0.5 rounded-md font-semibold text-[11px] border ${
                  isDark
                    ? "bg-indigo-950/70 text-indigo-300 border-indigo-800/60"
                    : "bg-indigo-100/80 text-indigo-900 border-indigo-200"
                }`}
              >
                {merch}
              </span>
            ))}
          </div>
        </div>
      </div>

      {/* Expiry / Lock Status */}
      <div
        className={`mt-4 pt-3 border-t flex items-center justify-between text-[11px] ${
          isDark
            ? "border-slate-800 text-slate-400"
            : "border-slate-200 text-slate-500"
        }`}
      >
        <div className="flex items-center space-x-1">
          <Calendar className="w-3.5 h-3.5 opacity-60" />
          <span>Valid through: {new Date(mandate.validUntil).toLocaleDateString()}</span>
        </div>
        <div className="flex items-center space-x-1 font-semibold">
          {isActive ? (
            <span
              className={`flex items-center space-x-1 ${
                isDark ? "text-emerald-400" : "text-emerald-700"
              }`}
            >
              <CheckCircle className="w-3.5 h-3.5" />
              <span>Human-Locked &amp; Authoritative</span>
            </span>
          ) : (
            <span
              className={`flex items-center space-x-1 ${
                isDark ? "text-rose-400" : "text-rose-700"
              }`}
            >
              <AlertCircle className="w-3.5 h-3.5" />
              <span>Spending Blocked</span>
            </span>
          )}
        </div>
      </div>
    </div>
  );
}

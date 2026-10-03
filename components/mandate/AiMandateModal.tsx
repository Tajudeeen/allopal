"use client";

import React, { useState } from "react";
import {
  Sparkles,
  Lock,
  X,
  CheckCircle,
  ShieldAlert,
} from "lucide-react";

interface AiMandateProposal {
  name: string;
  weeklyLimit: number;
  durationDays: number;
  allowedCategories: string[];
  allowedMerchants: string[];
}

interface AiMandateModalProps {
  isOpen: boolean;
  onClose: () => void;
  onMandateLocked: () => Promise<void>;
  isDark?: boolean;
}

export function AiMandateModal({
  isOpen,
  onClose,
  onMandateLocked,
  isDark = true,
}: AiMandateModalProps) {
  const [prompt, setPrompt] = useState(
    "Give my shopping agent $40 for school supplies from Campus Books for the next 7 days."
  );
  const [interpreting, setInterpreting] = useState(false);
  const [proposal, setProposal] = useState<AiMandateProposal | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [locking, setLocking] = useState(false);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  if (!isOpen) return null;

  const handlePropose = async () => {
    if (!prompt.trim()) return;
    setInterpreting(true);
    setError(null);
    setProposal(null);
    setSuccessMessage(null);

    try {
      const res = await fetch("/api/mandates/interpret", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ prompt }),
      });
      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.message || data.error || "Failed to interpret prompt");
      }

      setProposal(data.proposedMandate);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Error interpreting mandate");
    } finally {
      setInterpreting(false);
    }
  };

  const handleLock = async () => {
    if (!proposal) return;
    setLocking(true);
    setError(null);

    try {
      const res = await fetch("/api/mandates/lock", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(proposal),
      });
      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.message || "Failed to lock mandate");
      }

      setSuccessMessage(
        ` Mandate "${data.mandate.name}" ($${(
          data.mandate.weeklyLimit / 100
        ).toFixed(2)}) explicitly approved and locked by human!`
      );
      await onMandateLocked();
      setTimeout(() => {
        onClose();
        setSuccessMessage(null);
        setProposal(null);
      }, 1500);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Error locking mandate");
    } finally {
      setLocking(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-md animate-fade-in">
      <div
        className={`rounded-2xl max-w-lg w-full p-6 shadow-2xl border relative overflow-hidden backdrop-blur-2xl transition-all ${
          isDark
            ? "bg-slate-900/95 border-slate-700/80 text-white shadow-black/80"
            : "bg-white border-slate-200 text-slate-900 shadow-xl"
        }`}
      >
        {/* Close Button */}
        <button
          onClick={onClose}
          className={`absolute top-4 right-4 p-1.5 rounded-lg transition-colors ${
            isDark
              ? "text-slate-400 hover:text-white hover:bg-slate-800"
              : "text-slate-400 hover:text-slate-600 hover:bg-slate-100"
          }`}
        >
          <X className="w-5 h-5" />
        </button>

        {/* Modal Title */}
        <div className="flex items-center space-x-2.5 mb-4">
          <div
            className={`w-9 h-9 rounded-xl flex items-center justify-center shadow-sm border flex-none ${
              isDark
                ? "bg-purple-950/80 border-purple-800 text-purple-300"
                : "bg-purple-100 border-purple-200 text-purple-700"
            }`}
          >
            <Sparkles className="w-5 h-5" />
          </div>
          <div>
            <h3 className="text-base font-bold tracking-tight">
              AI Mandate Proposal Assistant
            </h3>
            <p className={`text-xs ${isDark ? "text-slate-400" : "text-slate-500"}`}>
              Natural language intent &rarr; Structured proposal &rarr; Human lock gate
            </p>
          </div>
        </div>

        {/* Input Textarea */}
        <div className="mb-4">
          <label
            className={`block text-xs font-bold mb-1.5 uppercase tracking-wider ${
              isDark ? "text-slate-300" : "text-slate-700"
            }`}
          >
            Natural Language Mandate Prompt
          </label>
          <textarea
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
            rows={3}
            className={`w-full p-3 rounded-xl border text-xs focus:ring-2 focus:ring-blue-500/30 focus:outline-none font-sans transition-colors ${
              isDark
                ? "bg-slate-950 border-slate-700 text-white placeholder-slate-500 focus:border-blue-500"
                : "bg-slate-50 border-slate-300 text-slate-900 placeholder-slate-400 focus:border-blue-600"
            }`}
            placeholder="e.g. Give my shopping agent $40 for school supplies from Campus Books for 7 days."
          />
          <div
            className={`flex justify-between items-center mt-1 text-[11px] ${
              isDark ? "text-slate-400" : "text-slate-500"
            }`}
          >
            <span>Case E canonical prompt</span>
            <button
              onClick={() =>
                setPrompt(
                  "Give my shopping agent $40 for school supplies from Campus Books for the next 7 days."
                )
              }
              className="text-blue-400 hover:underline font-semibold"
            >
              Reset to Case E
            </button>
          </div>
        </div>

        {/* Propose Button */}
        <button
          onClick={handlePropose}
          disabled={interpreting || !prompt.trim()}
          className={`selo-button selo-button-primary w-full disabled:opacity-50 mb-4 ${
            isDark
              ? "bg-blue-600 hover:bg-blue-500 text-white shadow-blue-500/20"
              : "bg-slate-900 hover:bg-slate-800 text-white"
          }`}
        >
          <Sparkles className="w-4 h-4 text-amber-300" />
          <span>{interpreting ? "Interpreting Intent..." : "Generate Mandate Proposal"}</span>
        </button>

        {/* Error message */}
        {error && (
          <div
            className={`p-3 mb-4 rounded-xl border text-xs ${
              isDark
                ? "bg-rose-950/80 border-rose-800 text-rose-200"
                : "bg-rose-50 border-rose-200 text-rose-800"
            }`}
          >
            {error}
          </div>
        )}

        {/* Success message */}
        {successMessage && (
          <div
            className={`p-3 mb-4 rounded-xl border text-xs font-bold flex items-center space-x-2 ${
              isDark
                ? "bg-emerald-950/80 border-emerald-800 text-emerald-200"
                : "bg-emerald-50 border-emerald-200 text-emerald-800"
            }`}
          >
            <CheckCircle className="w-4 h-4 text-emerald-400 shrink-0" />
            <span>{successMessage}</span>
          </div>
        )}

        {/* Structured Proposal Preview (Human Review Gate) */}
        {proposal && (
          <div
            className={`p-4 rounded-xl border mb-4 animate-fade-in ${
              isDark
                ? "bg-slate-950/80 border-purple-900/60"
                : "bg-purple-50/60 border-purple-200"
            }`}
          >
            <div
              className={`flex items-center space-x-2 px-2.5 py-1 rounded-lg text-[11px] font-bold mb-3 border ${
                isDark
                  ? "bg-amber-950/60 text-amber-300 border-amber-800/80"
                  : "bg-amber-100/80 text-amber-800 border-amber-200"
              }`}
            >
              <ShieldAlert className="w-4 h-4 text-amber-400 shrink-0" />
              <span>Human Review Required: AI cannot independently activate spending</span>
            </div>

            <div className="space-y-2 text-xs">
              <div className="flex justify-between">
                <span className={isDark ? "text-slate-400" : "text-slate-500"}>
                  Proposed Name:
                </span>
                <span className="font-bold">{proposal.name}</span>
              </div>
              <div className="flex justify-between">
                <span className={isDark ? "text-slate-400" : "text-slate-500"}>
                  Weekly Limit:
                </span>
                <span className="font-bold font-mono text-emerald-400">
                  ${(proposal.weeklyLimit / 100).toFixed(2)} USD ({proposal.weeklyLimit} cents)
                </span>
              </div>
              <div className="flex justify-between">
                <span className={isDark ? "text-slate-400" : "text-slate-500"}>
                  Duration:
                </span>
                <span className="font-bold">{proposal.durationDays} days</span>
              </div>
              <div className="flex justify-between">
                <span className={isDark ? "text-slate-400" : "text-slate-500"}>
                  Allowed Categories:
                </span>
                <span className="font-semibold text-blue-400">
                  {proposal.allowedCategories.join(", ")}
                </span>
              </div>
              <div className="flex justify-between">
                <span className={isDark ? "text-slate-400" : "text-slate-500"}>
                  Allowed Merchants:
                </span>
                <span className="font-semibold text-indigo-400">
                  {proposal.allowedMerchants.join(", ")}
                </span>
              </div>
            </div>

            {/* Lock Button */}
            <button
              onClick={handleLock}
              disabled={locking}
              className="selo-button w-full text-white bg-gradient-to-r from-emerald-600 to-teal-600 shadow-lg shadow-emerald-600/25 disabled:opacity-50"
            >
              <Lock className="w-4 h-4" />
              <span>{locking ? "Locking Mandate..." : "Approve & Lock Mandate (Human Gate)"}</span>
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

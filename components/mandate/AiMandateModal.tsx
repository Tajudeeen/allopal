"use client";

import React, { useState } from "react";
import { Sparkles, X, ShieldAlert, ArrowRight, CheckCircle, Lock } from "lucide-react";
import { MandateProposal } from "@/lib/ai/types";

interface AiMandateModalProps {
  isOpen: boolean;
  onClose: () => void;
  onMandateLocked: () => Promise<void>;
}

export function AiMandateModal({ isOpen, onClose, onMandateLocked }: AiMandateModalProps) {
  const [prompt, setPrompt] = useState(
    "Give my shopping agent $40 for school supplies from Campus Books for the next 7 days."
  );
  const [proposal, setProposal] = useState<MandateProposal | null>(null);
  const [interpreting, setInterpreting] = useState(false);
  const [locking, setLocking] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  if (!isOpen) return null;

  const handlePropose = async () => {
    setInterpreting(true);
    setError(null);
    setProposal(null);
    setSuccessMessage(null);

    try {
      const res = await fetch("/api/mandates/propose", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ prompt }),
      });
      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.message || data.error || "Failed to generate proposal");
      }

      setProposal(data.proposal);
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
        `✓ Mandate "${data.mandate.name}" ($${(
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
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/70 backdrop-blur-sm animate-fade-in">
      <div className="bg-white rounded-2xl max-w-lg w-full p-6 shadow-2xl border border-slate-200 relative overflow-hidden">
        {/* Close Button */}
        <button
          onClick={onClose}
          className="absolute top-4 right-4 p-1 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-colors"
        >
          <X className="w-5 h-5" />
        </button>

        {/* Modal Title */}
        <div className="flex items-center space-x-2.5 mb-4">
          <div className="w-9 h-9 rounded-xl bg-purple-100 text-purple-700 flex items-center justify-center shadow-sm">
            <Sparkles className="w-5 h-5" />
          </div>
          <div>
            <h3 className="text-base font-black text-slate-900">AI Mandate Proposal Assistant</h3>
            <p className="text-xs text-slate-500">
              Natural language intent &rarr; Structured proposal &rarr; Human lock gate
            </p>
          </div>
        </div>

        {/* Input Textarea */}
        <div className="mb-4">
          <label className="block text-xs font-bold text-slate-700 mb-1.5 uppercase tracking-wider">
            Natural Language Mandate Prompt
          </label>
          <textarea
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
            rows={3}
            className="w-full p-3 rounded-xl border border-slate-300 text-xs text-slate-900 focus:ring-2 focus:ring-paypal-blue/30 focus:border-paypal-blue focus:outline-none font-sans"
            placeholder="e.g. Give my shopping agent $40 for school supplies from Campus Books for 7 days."
          />
          <div className="flex justify-between items-center mt-1 text-[11px] text-slate-500">
            <span>Case E canonical prompt provided</span>
            <button
              onClick={() =>
                setPrompt(
                  "Give my shopping agent $40 for school supplies from Campus Books for the next 7 days."
                )
              }
              className="text-paypal-blue hover:underline font-semibold"
            >
              Reset to Case E
            </button>
          </div>
        </div>

        {/* Propose Button */}
        <button
          onClick={handlePropose}
          disabled={interpreting || !prompt.trim()}
          className="w-full py-2.5 rounded-xl bg-slate-900 hover:bg-slate-800 text-white text-xs font-bold flex items-center justify-center space-x-2 shadow transition-all hover:scale-[1.01] active:scale-[0.99] disabled:opacity-50 mb-4"
        >
          <Sparkles className="w-4 h-4 text-yellow-300" />
          <span>{interpreting ? "Interpreting Intent..." : "Generate Mandate Proposal"}</span>
        </button>

        {/* Error message */}
        {error && (
          <div className="p-3 mb-4 rounded-xl bg-rose-50 border border-rose-200 text-xs text-rose-800">
            {error}
          </div>
        )}

        {/* Success message */}
        {successMessage && (
          <div className="p-3 mb-4 rounded-xl bg-emerald-50 border border-emerald-200 text-xs font-bold text-emerald-800 flex items-center space-x-2">
            <CheckCircle className="w-4 h-4 text-emerald-600 shrink-0" />
            <span>{successMessage}</span>
          </div>
        )}

        {/* Structured Proposal Preview (Human Review Gate) */}
        {proposal && (
          <div className="p-4 rounded-xl bg-purple-50/60 border border-purple-200 mb-4 animate-fade-in">
            <div className="flex items-center space-x-2 text-amber-800 bg-amber-100/80 px-2.5 py-1 rounded-lg text-[11px] font-bold mb-3 border border-amber-200">
              <ShieldAlert className="w-4 h-4 text-amber-600 shrink-0" />
              <span>Human Review Required: AI cannot independently activate spending</span>
            </div>

            <div className="space-y-2 text-xs">
              <div className="flex justify-between">
                <span className="text-slate-500 font-medium">Proposed Name:</span>
                <span className="font-bold text-slate-900">{proposal.name}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500 font-medium">Weekly Limit:</span>
                <span className="font-bold text-slate-900 font-mono">
                  ${(proposal.weeklyLimit / 100).toFixed(2)} USD ({proposal.weeklyLimit} cents)
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500 font-medium">Duration:</span>
                <span className="font-bold text-slate-900">{proposal.durationDays} days</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500 font-medium">Allowed Categories:</span>
                <span className="font-semibold text-slate-800">
                  {proposal.allowedCategories.join(", ")}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500 font-medium">Allowed Merchants:</span>
                <span className="font-semibold text-slate-800">
                  {proposal.allowedMerchants.join(", ")}
                </span>
              </div>
            </div>

            {/* Lock Button */}
            <button
              onClick={handleLock}
              disabled={locking}
              className="mt-4 w-full py-2.5 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-700 hover:to-teal-700 text-white text-xs font-black flex items-center justify-center space-x-2 shadow-lg shadow-emerald-600/20 transition-all hover:scale-[1.01] active:scale-[0.99] disabled:opacity-50"
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

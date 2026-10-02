"use client";

import React, { useState } from "react";
import { ShieldCheck, RotateCcw, CreditCard, Sparkles } from "lucide-react";

interface NavbarProps {
  onResetDemo: () => Promise<void>;
  onOpenAiModal: () => void;
}

export function Navbar({ onResetDemo, onOpenAiModal }: NavbarProps) {
  const [resetting, setResetting] = useState(false);

  const handleReset = async () => {
    setResetting(true);
    try {
      await onResetDemo();
    } finally {
      setResetting(false);
    }
  };

  return (
    <header className="sticky top-0 z-50 bg-[#001C64]/90 backdrop-blur-md border-b border-blue-900/50 text-white shadow-xl">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
        {/* Brand */}
        <div className="flex items-center space-x-3">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-[#003087] via-[#0070BA] to-[#00CFDE] flex items-center justify-center shadow-lg shadow-blue-500/20 border border-white/20">
            <ShieldCheck className="w-6 h-6 text-white" />
          </div>
          <div>
            <div className="flex items-center space-x-2">
              <span className="text-xl font-black tracking-tight bg-gradient-to-r from-white via-blue-100 to-blue-200 bg-clip-text text-transparent">
                ALLOPAL
              </span>
              <span className="px-2 py-0.5 rounded text-[10px] font-extrabold tracking-wider bg-[#FFC439] text-[#003087] uppercase">
                PAYPAL AGENTIC
              </span>
            </div>
            <p className="text-[11px] text-blue-200/80 font-medium">
              Deterministic Spending Authorization Gateway
            </p>
          </div>
        </div>

        {/* Invariant Banner */}
        <div className="hidden lg:flex items-center space-x-2 px-3 py-1.5 rounded-full bg-blue-950/60 border border-blue-400/20 text-xs font-mono">
          <span className="text-emerald-400 font-bold">PASS &rarr; PAYPAL CAPTURE</span>
          <span className="text-blue-500 font-bold">|</span>
          <span className="text-rose-400 font-bold">FAIL &rarr; ZERO MONEY MOVEMENT</span>
        </div>

        {/* Action Controls */}
        <div className="flex items-center space-x-3">
          <button
            onClick={onOpenAiModal}
            className="flex items-center space-x-1.5 px-3.5 py-1.5 rounded-lg bg-blue-600/60 hover:bg-blue-600 border border-blue-400/30 text-xs font-semibold text-white shadow transition-all hover:scale-[1.02] active:scale-[0.98]"
          >
            <Sparkles className="w-3.5 h-3.5 text-yellow-300" />
            <span>AI Mandate Draft</span>
          </button>

          <button
            onClick={handleReset}
            disabled={resetting}
            title="Reset database to fresh canonical hackathon demo state"
            className="flex items-center space-x-1.5 px-3.5 py-1.5 rounded-lg bg-slate-800/80 hover:bg-slate-700 border border-slate-600/40 text-xs font-semibold text-slate-200 shadow transition-all hover:scale-[1.02] active:scale-[0.98] disabled:opacity-50"
          >
            <RotateCcw className={`w-3.5 h-3.5 ${resetting ? "animate-spin text-blue-400" : "text-slate-300"}`} />
            <span>{resetting ? "Resetting..." : "Reset Demo"}</span>
          </button>
        </div>
      </div>
    </header>
  );
}

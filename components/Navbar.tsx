"use client";

import React, { useState } from "react";
import { ShieldCheck, RotateCcw, Sparkles } from "lucide-react";

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
    <header className="fixed top-5 left-4 right-4 max-w-7xl mx-auto z-50">
      <nav className="h-16 px-5 sm:px-6 rounded-2xl bg-white/85 backdrop-blur-xl border border-white/70 shadow-lg shadow-black/5 flex items-center justify-between transition-all">
        {/* Brand */}
        <div className="flex items-center space-x-3">
          <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-[#1f4fe0] via-[#3a6bf5] to-[#7095ff] flex items-center justify-center text-white shadow-md shadow-blue-500/25 border border-white/30">
            <ShieldCheck className="w-5 h-5" />
          </div>
          <div>
            <div className="flex items-center space-x-2">
              <span className="text-base font-bold text-[#1c1c1f] tracking-tight">
                Allopal
              </span>
              <span className="px-2 py-0.5 rounded-full text-[10px] font-bold tracking-wider bg-[#1f4fe0]/10 text-[#1f4fe0] border border-[#1f4fe0]/20">
                PAYPAL GATE
              </span>
            </div>
            <p className="hidden sm:block text-[11px] text-[#6b6b73] font-medium leading-none mt-0.5">
              Spending controls for AI-agent commerce
            </p>
          </div>
        </div>

        {/* Center Nav Links */}
        <div className="hidden md:flex items-center space-x-1 lg:space-x-2 text-xs font-medium text-[#5f5f67]">
          <a
            href="#invariant"
            className="px-3 py-1.5 rounded-lg hover:text-[#1c1c1f] hover:bg-black/5 transition-colors"
          >
            Invariant Gate
          </a>
          <a
            href="#console"
            className="px-3 py-1.5 rounded-lg hover:text-[#1c1c1f] hover:bg-black/5 transition-colors"
          >
            Agent Console
          </a>
          <a
            href="#gate"
            className="px-3 py-1.5 rounded-lg hover:text-[#1c1c1f] hover:bg-black/5 transition-colors"
          >
            Policy Engine
          </a>
          <a
            href="#ledger"
            className="px-3 py-1.5 rounded-lg hover:text-[#1c1c1f] hover:bg-black/5 transition-colors"
          >
            Audit Ledger
          </a>
        </div>

        {/* Action Controls */}
        <div className="flex items-center space-x-2.5">
          <button
            onClick={onOpenAiModal}
            className="flex items-center space-x-1.5 px-3.5 py-2 rounded-xl bg-[#17171a] hover:bg-black text-xs font-medium text-white shadow-sm transition-all hover:scale-[1.02] active:scale-[0.98]"
          >
            <Sparkles className="w-3.5 h-3.5 text-amber-300" />
            <span className="hidden sm:inline">Draft Mandate</span>
            <span className="sm:hidden">Draft</span>
          </button>

          <button
            onClick={handleReset}
            disabled={resetting}
            title="Reset database to fresh canonical demo state"
            className="flex items-center space-x-1.5 px-3 py-2 rounded-xl bg-white/90 hover:bg-white border border-[#d6d6dc] text-xs font-medium text-[#1c1c1f] shadow-sm transition-all hover:scale-[1.02] active:scale-[0.98] disabled:opacity-50"
          >
            <RotateCcw className={`w-3.5 h-3.5 ${resetting ? "animate-spin text-[#1f4fe0]" : "text-[#6b6b73]"}`} />
            <span className="hidden sm:inline">{resetting ? "Resetting..." : "Reset Demo"}</span>
          </button>
        </div>
      </nav>
    </header>
  );
}

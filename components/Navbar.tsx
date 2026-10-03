"use client";

import React, { useState } from "react";
import { RotateCcw, Sparkles, ArrowUpRight } from "lucide-react";

interface NavbarProps {
  onResetDemo: () => Promise<void>;
  onOpenAiModal: () => void;
}

export function Navbar({ onResetDemo, onOpenAiModal }: NavbarProps) {
  const [resetting, setResetting] = useState(false);

  const handleReset = async () => {
    setResetting(true);
    try { await onResetDemo(); } finally { setResetting(false); }
  };

  return (
    <header className="fixed top-4 left-3 right-3 sm:top-5 sm:left-4 sm:right-4 max-w-7xl mx-auto z-50">
      <nav className="h-14 sm:h-16 px-3 sm:px-5 rounded-[18px] bg-white/72 flex items-center justify-between">
        <a href="#hero" className="flex items-center gap-2.5 sm:gap-3 group min-w-0">
          <div className="w-9 h-9 sm:w-10 sm:h-10 rounded-[13px] overflow-hidden shadow-sm border border-black/10 flex items-center justify-center bg-white flex-none transition-transform duration-300 group-hover:scale-[1.04]">
            <img src="/logo.png" alt="Allopal Logo" className="w-full h-full object-cover" />
          </div>
          <div className="min-w-0">
            <div className="flex items-center gap-1.5 sm:gap-2">
              <span className="text-sm sm:text-base font-bold text-[#18191c] tracking-tight group-hover:text-[#1f4fe0] transition-colors">Allopal</span>
              <span className="hidden sm:inline-flex px-2 py-0.5 rounded-full text-[9px] font-bold tracking-[0.14em] bg-[#1f4fe0]/8 text-[#1f4fe0] border border-[#1f4fe0]/15">PAYPAL GATE</span>
            </div>
            <p className="hidden md:block text-[10px] text-[#70727a] font-medium leading-none mt-1">Spending controls for AI-agent commerce</p>
          </div>
        </a>

        <div className="hidden lg:flex items-center gap-1 text-[11px] font-semibold text-[#666870]">
          <a href="#invariant" className="px-3 py-2 rounded-xl hover:text-[#18191c] hover:bg-black/[0.04]">Invariant</a>
          <a href="#console" className="px-3 py-2 rounded-xl hover:text-[#18191c] hover:bg-black/[0.04]">Console</a>
          <a href="#gate" className="px-3 py-2 rounded-xl hover:text-[#18191c] hover:bg-black/[0.04]">Policy</a>
          <a href="#ledger" className="px-3 py-2 rounded-xl hover:text-[#18191c] hover:bg-black/[0.04]">Ledger</a>
        </div>

        <div className="flex items-center gap-1.5 sm:gap-2">
          <button onClick={onOpenAiModal} className="selo-button selo-button-primary !min-h-[38px] !rounded-[12px] !px-3 sm:!px-3.5">
            <Sparkles className="w-3.5 h-3.5 text-amber-300" />
            <span className="hidden sm:inline">Draft Mandate</span>
            <span className="sm:hidden">Draft</span>
          </button>

          <button onClick={handleReset} disabled={resetting} title="Reset database to fresh canonical demo state" className="selo-button selo-button-secondary !min-h-[38px] !rounded-[12px] !px-2.5 sm:!px-3">
            <RotateCcw className={"w-3.5 h-3.5 " + (resetting ? "animate-spin text-[#1f4fe0]" : "text-[#6b6b73]")} />
            <span className="hidden sm:inline">{resetting ? "Resetting..." : "Reset Demo"}</span>
            <ArrowUpRight className="hidden sm:block w-3 h-3 opacity-35" />
          </button>
        </div>
      </nav>
    </header>
  );
}
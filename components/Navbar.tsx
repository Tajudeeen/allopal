"use client";

import React, { useState } from "react";
import { RotateCcw, Sparkles, Palette, ChevronDown, Check } from "lucide-react";

export type AppPalette = "obsidian" | "alabaster" | "navy" | "emerald";

interface NavbarProps {
  onResetDemo: () => Promise<void>;
  onOpenAiModal: () => void;
  palette?: AppPalette;
  onSelectPalette?: (palette: AppPalette) => void;
}

export function Navbar({
  onResetDemo,
  onOpenAiModal,
  palette = "obsidian",
  onSelectPalette,
}: NavbarProps) {
  const [resetting, setResetting] = useState(false);
  const [isPaletteOpen, setIsPaletteOpen] = useState(false);

  const isDark = palette !== "alabaster";

  const handleReset = async () => {
    setResetting(true);
    try {
      await onResetDemo();
    } finally {
      setResetting(false);
    }
  };

  const paletteOptions: Array<{ id: AppPalette; label: string; dotColor: string; desc: string }> = [
    {
      id: "obsidian",
      label: "Obsidian Void",
      dotColor: "bg-slate-900 border-slate-700",
      desc: "Deep contrast with default bg.jpg",
    },
    {
      id: "alabaster",
      label: "Alabaster Light",
      dotColor: "bg-slate-100 border-slate-300",
      desc: "Clean frosted minimalist daylight",
    },
    {
      id: "navy",
      label: "PayPal Cyber",
      dotColor: "bg-blue-600 border-blue-400",
      desc: "Signature PayPal midnight blue",
    },
    {
      id: "emerald",
      label: "Emerald Vault",
      dotColor: "bg-emerald-600 border-emerald-400",
      desc: "Secure authorization gate theme",
    },
  ];

  return (
    <header className="fixed top-5 left-4 right-4 max-w-7xl mx-auto z-50">
      <nav
        className={`h-16 px-4 sm:px-6 rounded-2xl backdrop-blur-2xl border shadow-xl flex items-center justify-between transition-all duration-300 ${
          isDark
            ? "bg-slate-950/85 border-slate-800/80 text-white shadow-black/50"
            : "bg-white/90 border-slate-200/90 text-slate-900 shadow-slate-900/5"
        }`}
      >
        {/* Brand: Only Logo and Name */}
        <a href="#hero" className="flex items-center space-x-3 group">
          <div className="w-10 h-10 rounded-xl overflow-hidden shadow-md shadow-blue-500/20 border border-white/40 flex items-center justify-center bg-white flex-none group-hover:scale-105 transition-transform">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src="/logo.png"
              alt="Allopal Logo"
              className="w-full h-full object-cover"
            />
          </div>
          <span
            className={`text-lg font-bold tracking-tight transition-colors ${
              isDark ? "text-white group-hover:text-blue-400" : "text-slate-950 group-hover:text-[#1f4fe0]"
            }`}
          >
            Allopal
          </span>
        </a>

        {/* Center Nav Links */}
        <div
          className={`hidden md:flex items-center space-x-1 lg:space-x-2 text-xs font-medium ${
            isDark ? "text-slate-300" : "text-slate-600"
          }`}
        >
          <a
            href="#invariant"
            className={`px-3 py-1.5 rounded-lg transition-colors ${
              isDark
                ? "hover:text-white hover:bg-white/10"
                : "hover:text-slate-950 hover:bg-slate-100"
            }`}
          >
            Invariant Gate
          </a>
          <a
            href="#console"
            className={`px-3 py-1.5 rounded-lg transition-colors ${
              isDark
                ? "hover:text-white hover:bg-white/10"
                : "hover:text-slate-950 hover:bg-slate-100"
            }`}
          >
            Agent Console
          </a>
          <a
            href="#gate"
            className={`px-3 py-1.5 rounded-lg transition-colors ${
              isDark
                ? "hover:text-white hover:bg-white/10"
                : "hover:text-slate-950 hover:bg-slate-100"
            }`}
          >
            Policy Engine
          </a>
          <a
            href="#ledger"
            className={`px-3 py-1.5 rounded-lg transition-colors ${
              isDark
                ? "hover:text-white hover:bg-white/10"
                : "hover:text-slate-950 hover:bg-slate-100"
            }`}
          >
            Audit Ledger
          </a>
        </div>

        {/* Action Controls */}
        <div className="flex items-center space-x-2 sm:space-x-2.5">
          {/* Palette Selector Dropdown (optional) */}
          {onSelectPalette && (
            <div className="relative">
              <button
                onClick={() => setIsPaletteOpen((prev) => !prev)}
                title="Change Background Palette"
                className={`flex items-center space-x-1 px-2.5 sm:px-3 py-2 rounded-xl border text-xs font-medium transition-all ${
                  isDark
                    ? "bg-slate-900/90 hover:bg-slate-800 border-slate-700/80 text-slate-200"
                    : "bg-slate-100 hover:bg-slate-200 border-slate-300 text-slate-800"
                }`}
              >
                <Palette className="w-3.5 h-3.5 text-[#1f4fe0]" />
                <span className="hidden lg:inline capitalize">{palette}</span>
                <ChevronDown className="w-3 h-3 opacity-60" />
              </button>

              {isPaletteOpen && (
                <>
                  <div
                    className="fixed inset-0 z-40"
                    onClick={() => setIsPaletteOpen(false)}
                  />
                  <div
                    className={`absolute right-0 mt-2 w-56 rounded-2xl p-2 border shadow-2xl z-50 transition-all ${
                      isDark
                        ? "bg-slate-900/95 backdrop-blur-xl border-slate-700 text-white"
                        : "bg-white/95 backdrop-blur-xl border-slate-200 text-slate-900"
                    }`}
                  >
                    <div className="px-3 py-1.5 text-[10px] font-bold uppercase tracking-wider text-slate-400">
                      Background Palette
                    </div>
                    <div className="space-y-1">
                      {paletteOptions.map((opt) => (
                        <button
                          key={opt.id}
                          onClick={() => {
                            onSelectPalette?.(opt.id);
                            setIsPaletteOpen(false);
                          }}
                          className={`w-full flex items-center justify-between px-3 py-2 rounded-xl text-left text-xs transition-colors ${
                            palette === opt.id
                              ? isDark
                                ? "bg-blue-600/30 text-white font-semibold"
                                : "bg-blue-50 text-blue-700 font-semibold"
                              : isDark
                              ? "hover:bg-slate-800 text-slate-300"
                              : "hover:bg-slate-100 text-slate-700"
                          }`}
                        >
                          <div className="flex items-center space-x-2">
                            <span
                              className={`w-3.5 h-3.5 rounded-full border ${opt.dotColor}`}
                            />
                            <div>
                              <div className="leading-tight">{opt.label}</div>
                              <div className="text-[10px] opacity-60 font-normal leading-tight">
                                {opt.desc}
                              </div>
                            </div>
                          </div>
                          {palette === opt.id && (
                            <Check className="w-3.5 h-3.5 text-blue-400 flex-none" />
                          )}
                        </button>
                      ))}
                    </div>
                  </div>
                </>
              )}
            </div>
          )}

          <button
            onClick={onOpenAiModal}
            className={`flex items-center space-x-1.5 px-3 py-2 rounded-xl text-xs font-medium shadow-sm transition-all hover:scale-[1.02] active:scale-[0.98] ${
              isDark
                ? "bg-blue-600 hover:bg-blue-500 text-white border border-blue-400/40"
                : "bg-[#17171a] hover:bg-black text-white"
            }`}
          >
            <Sparkles className="w-3.5 h-3.5 text-amber-300" />
            <span className="hidden sm:inline">Draft Mandate</span>
            <span className="sm:hidden">Draft</span>
          </button>

          <button
            onClick={handleReset}
            disabled={resetting}
            title="Reset database to fresh canonical demo state"
            className={`flex items-center space-x-1.5 px-3 py-2 rounded-xl border text-xs font-medium shadow-sm transition-all hover:scale-[1.02] active:scale-[0.98] disabled:opacity-50 ${
              isDark
                ? "bg-slate-900/90 hover:bg-slate-800 border-slate-700/80 text-slate-200"
                : "bg-white hover:bg-slate-50 border-slate-300 text-slate-800"
            }`}
          >
            <RotateCcw
              className={`w-3.5 h-3.5 ${
                resetting ? "animate-spin text-blue-400" : isDark ? "text-slate-300" : "text-slate-600"
              }`}
            />
            <span className="hidden sm:inline">{resetting ? "Resetting..." : "Reset"}</span>
          </button>
        </div>
      </nav>
    </header>
  );
}

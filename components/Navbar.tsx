"use client";

import React, { useState } from "react";
import { RotateCcw, Sparkles, ChevronDown, Check, Pipette } from "lucide-react";
import {
  PRESET_BACKGROUND_COLORS,
  getAdaptiveTypography,
  AdaptiveTypography,
} from "@/lib/theme/contrast";

export type AppPalette = "obsidian" | "alabaster" | "navy" | "emerald" | "amethyst" | "amber" | "custom";

interface NavbarProps {
  onResetDemo: () => Promise<void>;
  onOpenAiModal: () => void;
  palette?: string;
  onSelectPalette?: (palette: AppPalette) => void;
  currentBgColorHex?: string;
  onSelectBgColorHex?: (hex: string) => void;
}

export function Navbar({
  onResetDemo,
  onOpenAiModal,
  palette = "obsidian",
  onSelectPalette,
  currentBgColorHex = "#05070d",
  onSelectBgColorHex,
}: NavbarProps) {
  const [resetting, setResetting] = useState(false);
  const [isColorMenuOpen, setIsColorMenuOpen] = useState(false);
  const [customHexInput, setCustomHexInput] = useState(currentBgColorHex);

  const typography: AdaptiveTypography = getAdaptiveTypography(currentBgColorHex);
  const isDark = typography.isDark;

  const handleReset = async () => {
    setResetting(true);
    try {
      await onResetDemo();
    } finally {
      setResetting(false);
    }
  };

  const handleApplyHex = (hex: string) => {
    setCustomHexInput(hex);
    onSelectBgColorHex?.(hex);
    // Map to known palette if applicable
    const matched = PRESET_BACKGROUND_COLORS.find(
      (p) => p.hex.toLowerCase() === hex.toLowerCase()
    );
    if (matched) {
      onSelectPalette?.(matched.id as AppPalette);
    } else {
      onSelectPalette?.("custom");
    }
  };

  return (
    <header className="fixed top-5 left-4 right-4 max-w-7xl mx-auto z-50">
      <nav
        className={`h-16 px-4 sm:px-6 rounded-2xl backdrop-blur-2xl border shadow-xl flex items-center justify-between transition-all duration-300 ${
          isDark
            ? "bg-gradient-to-b from-[#18181b] to-black border-slate-800/80 text-white shadow-black/50"
            : "bg-white/90 border-slate-200/90 text-slate-900 shadow-slate-900/5"
        }`}
      >
        {/* Brand: Logo and Name */}
        <a href="#hero" className="flex items-center space-x-3 group">
          <div className="w-10 h-10 rounded-xl overflow-hidden shadow-md shadow-zinc-500/20 border border-white/40 flex items-center justify-center bg-white flex-none group-hover:scale-105 transition-transform">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src="/logo.png"
              alt="Allopal Logo"
              className="w-full h-full object-cover"
            />
          </div>
          <span
            className={`text-lg font-bold tracking-tight transition-colors ${
              isDark ? "text-white group-hover:text-zinc-400" : "text-slate-950 group-hover:text-zinc-800"
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
          {/* Background Color & Contrast Controller */}
          <div className="relative">
            <button
              onClick={() => setIsColorMenuOpen((prev) => !prev)}
              title="Change Background Color & Test Text Contrast"
              className={`flex items-center space-x-1.5 px-2.5 sm:px-3 py-2 rounded-xl border text-xs font-medium transition-all ${
                isDark
                  ? "bg-slate-900/90 hover:bg-slate-800 border-slate-700/80 text-slate-200"
                  : "bg-slate-100 hover:bg-slate-200 border-slate-300 text-slate-800"
              }`}
            >
              <div
                className="w-3.5 h-3.5 rounded-full border border-white/40 shadow-sm flex-none"
                style={{ backgroundColor: currentBgColorHex }}
              />
              <span className="hidden sm:inline">Background Color</span>
              <span
                className={`hidden lg:inline text-[10px] px-1.5 py-0.5 rounded font-mono font-semibold ${
                  isDark ? "bg-slate-800 text-emerald-400" : "bg-slate-200 text-emerald-700"
                }`}
              >
                AAA
              </span>
              <ChevronDown className="w-3 h-3 opacity-60" />
            </button>

            {isColorMenuOpen && (
              <>
                <div
                  className="fixed inset-0 z-40"
                  onClick={() => setIsColorMenuOpen(false)}
                />
                <div
                  className={`absolute right-0 mt-2 w-72 sm:w-80 rounded-2xl p-4 border shadow-2xl z-50 transition-all ${
                    isDark
                      ? "bg-slate-950/95 backdrop-blur-xl border-slate-700 text-white shadow-black/80"
                      : "bg-white/95 backdrop-blur-xl border-slate-200 text-slate-900 shadow-xl"
                  }`}
                >
                  <div className="flex items-center justify-between pb-2 border-b border-slate-800/40">
                    <div>
                      <div className="text-[11px] font-bold uppercase tracking-wider text-zinc-400 flex items-center gap-1.5">
                        <Pipette className="w-3.5 h-3.5" />
                        <span>Adaptive Text Engine</span>
                      </div>
                      <p className="text-[10px] text-slate-400 font-normal leading-tight mt-0.5">
                        All text dynamically adapts to any background color
                      </p>
                    </div>
                  </div>

                  {/* Real-time WCAG Stats */}
                  <div
                    className={`mt-3 p-2.5 rounded-xl border text-xs font-mono space-y-1 ${
                      isDark
                        ? "bg-slate-900/80 border-slate-800 text-slate-300"
                        : "bg-slate-50 border-slate-200 text-slate-700"
                    }`}
                  >
                    <div className="flex justify-between items-center text-[11px]">
                      <span className="opacity-70">Active Color:</span>
                      <span className="font-bold">{currentBgColorHex.toUpperCase()}</span>
                    </div>
                    <div className="flex justify-between items-center text-[11px]">
                      <span className="opacity-70">Relative Luminance:</span>
                      <span>{typography.luminance.toFixed(3)}</span>
                    </div>
                    <div className="flex justify-between items-center text-[11px]">
                      <span className="opacity-70">Contrast vs Text:</span>
                      <span className="text-emerald-500 font-bold">
                        {(typography.isDark
                          ? typography.contrastRatioAgainstWhite
                          : typography.contrastRatioAgainstBlack
                        ).toFixed(1)}
                        :1 (WCAG AAA)
                      </span>
                    </div>
                    <div className="flex justify-between items-center text-[11px]">
                      <span className="opacity-70">Adapted Text:</span>
                      <span className="font-semibold text-zinc-400">
                        {typography.isDark ? "Crisp White (#FFF)" : "Deep Slate (#0F172A)"}
                      </span>
                    </div>
                  </div>

                  {/* Preset Swatches */}
                  <div className="mt-3">
                    <label className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block mb-1.5">
                      Preset Backgrounds
                    </label>
                    <div className="grid grid-cols-2 gap-1.5">
                      {PRESET_BACKGROUND_COLORS.map((preset) => {
                        const isSelected =
                          currentBgColorHex.toLowerCase() === preset.hex.toLowerCase();
                        return (
                          <button
                            key={preset.id}
                            type="button"
                            onClick={() => {
                              handleApplyHex(preset.hex);
                              setIsColorMenuOpen(false);
                            }}
                            className={`flex items-center space-x-2 px-2.5 py-1.5 rounded-xl text-left text-xs transition-colors border ${
                              isSelected
                                ? isDark
                                  ? "bg-zinc-600/30 border-zinc-500 text-white font-semibold"
                                  : "bg-zinc-50 border-zinc-400 text-zinc-800 font-semibold"
                                : isDark
                                ? "bg-slate-900/60 border-slate-800/80 hover:bg-slate-800 text-slate-300"
                                : "bg-slate-50 border-slate-200 hover:bg-slate-100 text-slate-700"
                            }`}
                          >
                            <span
                              className="w-3.5 h-3.5 rounded-full border border-white/20 flex-none"
                              style={{ backgroundColor: preset.hex }}
                            />
                            <span className="truncate text-[11px]">{preset.label}</span>
                            {isSelected && <Check className="w-3 h-3 text-zinc-400 ml-auto flex-none" />}
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  {/* Custom Color Spectrum Picker */}
                  <div className="mt-3 pt-3 border-t border-slate-800/40">
                    <label className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block mb-1.5">
                      Custom Color (Spectrum / Hex)
                    </label>
                    <div className="flex items-center gap-2">
                      <div className="relative w-8 h-8 rounded-lg overflow-hidden border border-slate-700 flex-none cursor-pointer">
                        <input
                          type="color"
                          value={currentBgColorHex}
                          onChange={(e) => handleApplyHex(e.target.value)}
                          className="absolute -top-2 -left-2 w-12 h-12 cursor-pointer opacity-100"
                          title="Pick custom background color"
                        />
                      </div>
                      <input
                        type="text"
                        value={customHexInput}
                        onChange={(e) => setCustomHexInput(e.target.value)}
                        onBlur={() => handleApplyHex(customHexInput)}
                        onKeyDown={(e) => {
                          if (e.key === "Enter") {
                            handleApplyHex(customHexInput);
                          }
                        }}
                        placeholder="#05070d"
                        className={`w-full text-xs font-mono px-3 py-1.5 rounded-lg border focus:outline-none focus:ring-1 focus:ring-zinc-500 ${
                          isDark
                            ? "bg-slate-900 border-slate-700 text-white"
                            : "bg-slate-50 border-slate-300 text-slate-900"
                        }`}
                      />
                      <button
                        type="button"
                        onClick={() => handleApplyHex(customHexInput)}
                        className="px-2.5 py-1.5 bg-zinc-600 hover:bg-zinc-500 text-white rounded-lg text-xs font-semibold flex-none transition-colors"
                      >
                        Set
                      </button>
                    </div>
                  </div>
                </div>
              </>
            )}
          </div>

          <button
            onClick={onOpenAiModal}
            className={`flex items-center space-x-1.5 px-3 py-2 rounded-xl text-xs font-medium shadow-sm transition-all hover:scale-[1.02] active:scale-[0.98] ${
              isDark
                ? "bg-zinc-600 hover:bg-zinc-500 text-white border border-zinc-400/40"
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
                resetting ? "animate-spin text-zinc-400" : isDark ? "text-slate-300" : "text-slate-600"
              }`}
            />
            <span className="hidden sm:inline">{resetting ? "Resetting..." : "Reset"}</span>
          </button>
        </div>
      </nav>
    </header>
  );
}

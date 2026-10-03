"use client";

import React, { useState } from "react";
import { Menu, RotateCcw, Sparkles, X } from "lucide-react";
import { usePathname } from "next/navigation";

const links = [
  { label: "Overview", href: "/" },
  { label: "Mandate", href: "/mandate" },
  { label: "Agent Console", href: "/console" },
  { label: "Policy", href: "/policy" },
  { label: "Ledger", href: "/ledger" },
];

export function Navbar() {
  const pathname = usePathname();
  const [menuOpen, setMenuOpen] = useState(false);
  const [resetting, setResetting] = useState(false);
  const [resetError, setResetError] = useState<string | null>(null);

  const handleReset = async () => {
    setResetting(true);
    setResetError(null);
    try {
      const res = await fetch("/api/demo/reset", { method: "POST" });
      if (!res.ok) {
        const data = await res.json().catch(() => null);
        throw new Error(data?.message || "Reset failed");
      }
      window.location.reload();
    } catch (error) {
      setResetError(error instanceof Error ? error.message : "Reset failed");
      setResetting(false);
    }
  };

  const closeMenu = () => setMenuOpen(false);

  return (
    <header className="fixed top-3 left-3 right-3 sm:top-5 sm:left-4 sm:right-4 max-w-7xl mx-auto z-50">
      <nav className="relative rounded-[18px] border border-black/[0.08] bg-white/82 shadow-[0_18px_48px_rgba(27,28,31,0.10)] backdrop-blur-2xl">
        <div className="min-h-14 sm:min-h-16 px-3 sm:px-5 flex items-center justify-between gap-3">
          <a href="/" onClick={closeMenu} className="flex items-center gap-2.5 sm:gap-3 group min-w-0">
            <div className="w-9 h-9 sm:w-10 sm:h-10 rounded-[13px] overflow-hidden shadow-sm border border-black/10 flex items-center justify-center bg-white flex-none transition-transform duration-300 group-hover:scale-[1.04]">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src="/logo.png" alt="Allopal Logo" className="w-full h-full object-contain p-1" />
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-1.5 sm:gap-2">
                <span className="text-sm sm:text-base font-bold text-[#18191c] tracking-tight group-hover:text-[#1f4fe0] transition-colors">
                  Allopal
                </span>
                <span className="hidden sm:inline-flex px-2 py-0.5 rounded-full text-[9px] font-bold tracking-[0.14em] bg-[#1f4fe0]/8 text-[#1f4fe0] border border-[#1f4fe0]/15">
                  PAYPAL GATE
                </span>
              </div>
              <p className="hidden md:block text-[10px] text-[#51545b] font-medium leading-none mt-1">
                Spending controls for AI-agent commerce
              </p>
            </div>
          </a>

          <div className="hidden lg:flex items-center gap-1 text-[11px] font-semibold text-[#51545b]">
            {links.map((link) => {
              const active = pathname === link.href;
              return (
                <a
                  key={link.href}
                  href={link.href}
                  className={`px-3 py-2 rounded-xl transition-all ${active
                    ? "text-[#18191c] bg-black/[0.055]"
                    : "hover:text-[#18191c] hover:bg-black/[0.04]"}`}
                >
                  {link.label}
                </a>
              );
            })}
          </div>

          <div className="flex items-center gap-1.5 sm:gap-2">
            <a
              href="/mandate#draft"
              className="selo-button selo-button-primary !min-h-[38px] !rounded-[12px] !px-3 sm:!px-3.5"
              onClick={closeMenu}
            >
              <Sparkles className="w-3.5 h-3.5 text-amber-300" />
              <span className="hidden sm:inline">Draft Mandate</span>
              <span className="sm:hidden">Draft</span>
            </a>

            <button
              type="button"
              onClick={handleReset}
              disabled={resetting}
              title={resetError || "Reset database to fresh canonical demo state"}
              aria-label={resetError || (resetting ? "Resetting demo" : "Reset demo")}
              className="inline-flex items-center justify-center w-10 h-10 rounded-[12px] border border-black/[0.08] bg-black/[0.025] text-[#2b2e33] hover:bg-black/[0.06] transition-colors disabled:opacity-50"
            >
              <RotateCcw className={`w-3.5 h-3.5 ${resetting ? "animate-spin text-[#1f4fe0]" : "text-[#51545b]"}`} />
              <span className="sr-only">{resetting ? "Resetting demo" : "Reset demo"}</span>
            </button>

            <button
              type="button"
              onClick={() => setMenuOpen((open) => !open)}
              aria-expanded={menuOpen}
              aria-controls="allopal-mobile-menu"
              aria-label={menuOpen ? "Close navigation menu" : "Open navigation menu"}
              className="lg:hidden inline-flex items-center justify-center w-10 h-10 rounded-[12px] border border-black/[0.08] bg-black/[0.025] text-[#2b2e33] hover:bg-black/[0.06] transition-colors"
            >
              {menuOpen ? <X className="w-4 h-4" /> : <Menu className="w-4 h-4" />}
            </button>

          </div>
        </div>

        {menuOpen && (
          <div
            id="allopal-mobile-menu"
            className="lg:hidden border-t border-black/[0.07] px-3 pb-3 pt-2 bg-white/95 rounded-b-[18px]"
          >
            <div className="grid gap-1">
              {links.map((link) => {
                const active = pathname === link.href;
                return (
                  <a
                    key={link.href}
                    href={link.href}
                    onClick={closeMenu}
                    className={`flex items-center justify-between px-3 py-2.5 rounded-[12px] text-sm font-semibold transition-colors ${active
                      ? "bg-[#1f4fe0]/8 text-[#1736b8]"
                      : "text-[#4c5057] hover:bg-black/[0.04] hover:text-[#18191c]"}`}
                  >
                    <span>{link.label}</span>
                    <span className="text-[10px] uppercase tracking-wider opacity-45">open</span>
                  </a>
                );
              })}
              {resetError && (
                <p className="px-3 pt-1 text-xs text-rose-700">{resetError}</p>
              )}
            </div>
          </div>
        )}
      </nav>
    </header>
  );
}

"use client";

import React from "react";
import { ArrowUp, ExternalLink, ShieldCheck } from "lucide-react";

interface FooterLink {
  readonly label: string;
  readonly href?: string;
  readonly onClick?: () => void;
  readonly external?: boolean;
}

export function Footer() {
  const columns: readonly { readonly title: string; readonly items: readonly FooterLink[] }[] = [
    {
      title: "Product",
      items: [
        { label: "Overview", href: "/" },
        { label: "Mandate", href: "/mandate" },
        { label: "Agent Console", href: "/console" },
        { label: "Policy Engine", href: "/policy" },
      ],
    },
    {
      title: "Security",
      items: [
        { label: "Deterministic Checks", href: "/policy" },
        { label: "Audit Decision Ledger", href: "/ledger" },
        { label: "Zero-Bypass Boundary", href: "/policy#boundary" },
        { label: "Atomic Concurrency", href: "/console#replay-safety" },
      ],
    },
    {
      title: "Developers",
      items: [
        { label: "GitHub Repository", href: "https://github.com/Tajudeeen/allopal", external: true },
        { label: "PayPal Sandbox API", href: "https://developer.paypal.com", external: true },
        { label: "Draft AI Mandate", href: "/mandate#draft" },
      ],
    },
  ];

  const handleBackToTop = () => {
    if (typeof window !== "undefined") {
      const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
      window.scrollTo({ top: 0, behavior: reduced ? "auto" : "smooth" });
    }
  };

  return (
    <footer
      className={`relative z-20 w-full border-t pb-10 pt-16 backdrop-blur-2xl transition-all duration-300 ${
        isDark
          ? "border-slate-800/80 bg-slate-950/85 text-slate-300"
          : "border-slate-200/90 bg-white/90 text-slate-700"
      }`}
    >
      <div className="mx-auto w-full max-w-7xl px-6">
        <div className="mb-16 grid gap-12 lg:grid-cols-12">
          {/* Brand Col */}
          <div className="flex flex-col lg:col-span-5 space-y-4">
            <div className="flex items-center space-x-3">
              <div className="w-10 h-10 rounded-xl overflow-hidden shadow-md shadow-blue-500/10 border border-white/20 flex items-center justify-center flex-none">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src="/logo.png"
                  alt="Allopal Logo"
                  className="w-full h-full object-cover"
                />
              </div>
              <span
                className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[10px] font-mono font-bold tracking-wide border ${
                  isDark
                    ? "bg-blue-500/10 text-blue-400 border-blue-500/30"
                    : "bg-blue-50 text-blue-700 border-blue-200"
                }`}
              >
                <ShieldCheck className="w-3 h-3 text-blue-400" />
                PAYPAL RUNTIME GATE
              </span>
            </div>

            <p
              className={`text-3xl sm:text-4xl font-bold tracking-tight ${
                isDark ? "text-white" : "text-slate-950"
              }`}
            >
              Allopal<span className="text-[#1f4fe0]">.</span>
            </p>

            <p
              className={`max-w-sm text-sm leading-relaxed font-light ${
                isDark ? "text-slate-300" : "text-slate-600"
              }`}
            >
              Deterministic spending authorization layer for PayPal agentic commerce.
              Autonomous AI agents get a locked mandate, never direct access to your payment credentials.
            </p>

            <div
              className={`pt-1 text-xs font-mono flex items-center gap-2 ${
                isDark ? "text-slate-400" : "text-slate-500"
              }`}
            >
              <span className="w-2 h-2 rounded-full bg-emerald-400 inline-block animate-pulse" />
              <span>Strict Policy Evaluation · Integer-Cents Accuracy</span>
            </div>
          </div>

          {/* Links Columns */}
          <div className="lg:col-span-7">
            <div className="grid grid-cols-2 gap-8 md:grid-cols-3">
              {columns.map((column) => (
                <div key={column.title} className="flex flex-col gap-4">
                  <h3
                    className={`text-xs font-bold uppercase tracking-wider ${
                      isDark ? "text-white" : "text-slate-900"
                    }`}
                  >
                    {column.title}
                  </h3>
                  <ul className="flex flex-col gap-2.5">
                    {column.items.map((item) => (
                      <li key={item.label}>
                        (
                          <a
                            href={item.href}
                            target={item.external ? "_blank" : undefined}
                            rel={item.external ? "noopener noreferrer" : undefined}
                            className={`inline-flex items-center gap-1 text-xs sm:text-sm transition-colors ${
                              isDark
                                ? "text-slate-400 hover:text-white"
                                : "text-slate-600 hover:text-slate-950"
                            }`}
                          >
                            <span>{item.label}</span>
                            {item.external && (
                              <ExternalLink
                                className={`w-3 h-3 inline-block ${
                                  isDark ? "text-slate-500" : "text-slate-400"
                                }`}
                              />
                            )}
                          </a>
                        )}
                        </li>
                    ))}
                  </ul>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Bottom Sub-bar */}
        <div
          className={`flex flex-col items-center justify-between gap-4 border-t pt-6 md:flex-row text-xs ${
            isDark
              ? "border-slate-800 text-slate-400"
              : "border-slate-200 text-slate-500"
          }`}
        >
          <p className="font-light">
            Allopal · Spending Authorization Layer for PayPal Agentic Commerce
          </p>

          <button
            type="button"
            onClick={handleBackToTop}
            className={`group flex items-center gap-2 uppercase tracking-wider text-[11px] font-semibold transition-colors ${
              isDark
                ? "text-slate-400 hover:text-white"
                : "text-slate-600 hover:text-slate-950"
            }`}
          >
            <span>Back to top</span>
            <span
              className={`flex size-6 items-center justify-center rounded-md border transition-all ${
                isDark
                  ? "border-slate-800 bg-slate-900 group-hover:border-slate-600 group-hover:bg-slate-800"
                  : "border-slate-300 bg-slate-100 group-hover:border-slate-400 group-hover:bg-slate-200"
              }`}
            >
              <ArrowUp className="w-3 h-3 transition-colors" />
            </span>
          </button>
        </div>
      </div>
    </footer>
  );
}

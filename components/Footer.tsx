"use client";

import React from "react";
import { ArrowUp, ExternalLink, ShieldCheck } from "lucide-react";

interface FooterLink {
  readonly label: string;
  readonly href: string;
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
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    window.scrollTo({ top: 0, behavior: reduced ? "auto" : "smooth" });
  };

  return (
    <footer className="relative z-20 w-full border-t border-white/10 bg-[#050505] pb-10 pt-16 text-white">
      <div className="mx-auto w-full max-w-7xl px-6">
        <div className="mb-16 grid gap-12 lg:grid-cols-12">
          <div className="flex flex-col space-y-4 lg:col-span-5">
            <div className="flex items-center space-x-3">
              <div className="flex h-10 w-10 flex-none items-center justify-center overflow-hidden rounded-xl border border-white/10 bg-[#111111] shadow-md shadow-black/30">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src="/logo.png" alt="Allopal Logo" className="h-full w-full object-cover" />
              </div>
              <span className="inline-flex items-center gap-1.5 rounded-full border border-blue-400/30 bg-blue-500/10 px-2.5 py-0.5 text-[10px] font-mono font-bold tracking-wide text-blue-300">
                <ShieldCheck className="h-3 w-3 text-blue-300" />
                PAYPAL RUNTIME GATE
              </span>
            </div>

            <p className="text-3xl font-bold tracking-tight text-white sm:text-4xl">
              Allopal<span className="text-[#1f4fe0]">.</span>
            </p>

            <p className="max-w-sm text-sm font-light leading-relaxed text-white/65">
              Deterministic spending authorization layer for PayPal agentic commerce.
              Autonomous AI agents get a locked mandate, never direct access to payment credentials.
            </p>

            <div className="flex items-center gap-2 pt-1 text-xs font-mono text-white/65">
              <span className="inline-block h-2 w-2 animate-pulse rounded-full bg-emerald-400" />
              <span>Strict Policy Evaluation · Integer-Cents Accuracy</span>
            </div>
          </div>

          <div className="lg:col-span-7">
            <div className="grid grid-cols-2 gap-8 md:grid-cols-3">
              {columns.map((column) => (
                <div key={column.title} className="flex flex-col gap-4">
                  <h3 className="text-xs font-bold uppercase tracking-wider text-white">
                    {column.title}
                  </h3>
                  <ul className="flex flex-col gap-2.5">
                    {column.items.map((item) => (
                      <li key={item.label}>
                        <a
                          href={item.href}
                          target={item.external ? "_blank" : undefined}
                          rel={item.external ? "noopener noreferrer" : undefined}
                          className="inline-flex items-center gap-1 text-xs text-slate-600 transition-colors hover:text-white sm:text-sm"
                        >
                          <span>{item.label}</span>
                          {item.external && <ExternalLink className="inline-block h-3 w-3 text-white/45" />}
                        </a>
                      </li>
                    ))}
                  </ul>
                </div>
              ))}
            </div>
          </div>
        </div>

        <div className="flex flex-col items-center justify-between gap-4 border-t border-white/10 pt-6 text-xs text-white/60 md:flex-row">
          <p className="font-light">Allopal · Spending Authorization Layer for PayPal Agentic Commerce</p>
          <button
            type="button"
            onClick={handleBackToTop}
            className="group flex items-center gap-2 text-[11px] font-semibold uppercase tracking-wider text-white/65 transition-colors hover:text-white"
          >
            <span>Back to top</span>
            <span className="flex size-6 items-center justify-center rounded-md border border-white/15 bg-white/5 transition-all group-hover:border-white/30 group-hover:bg-white/10">
              <ArrowUp className="h-3 w-3" />
            </span>
          </button>
        </div>
      </div>
    </footer>
  );
}

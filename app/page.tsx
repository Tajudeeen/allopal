"use client";

import React from "react";
import Link from "next/link";
import {
  ArrowRight,
  Bot,
  FileCheck2,
  ReceiptText,
  ShieldCheck,
  WalletCards,
  Activity,
  LockKeyhole,
} from "lucide-react";
import { ProductShell } from "@/components/ProductShell";
import { useAllopalRuntime } from "@/hooks/useAllopalRuntime";

const screens = [
  {
    href: "/mandate",
    label: "01 / mandate",
    title: "Control the mandate",
    body: "Review the active spending boundary, expiry window, merchants, categories, and create a new AI-drafted mandate that still needs human approval.",
    icon: LockKeyhole,
    stat: "Human-owned authority",
  },
  {
    href: "/console",
    label: "02 / agent console",
    title: "Run commerce",
    body: "Give an agent a natural-language shopping task. It selects a server-side cart, then the policy engine decides whether that action can cross into PayPal.",
    icon: Bot,
    stat: "Interactive payment runtime",
  },
  {
    href: "/policy",
    label: "03 / policy",
    title: "Inspect every check",
    body: "See the ordered policy checks, short-circuit behaviour, failed rules, and exactly why PayPal was or was not called.",
    icon: ShieldCheck,
    stat: "8 deterministic checks",
  },
  {
    href: "/ledger",
    label: "04 / ledger",
    title: "Audit the outcome",
    body: "Follow decisions, PayPal orders, captures, pending payer approval, failures, and budget effects from one dedicated audit screen.",
    icon: ReceiptText,
    stat: "SQLite audit trail",
  },
];

export default function Home() {
  const { mandate, decisions, transactions, loading, notice } = useAllopalRuntime();
  const remaining = mandate ? Math.max(0, mandate.weeklyLimit - mandate.spentAmount) : 0;
  const percent = mandate?.weeklyLimit ? Math.round((mandate.spentAmount / mandate.weeklyLimit) * 100) : 0;

  return (
    <ProductShell>
      <div className="space-y-16">
        <section className="grid gap-8 lg:grid-cols-[1.15fr_.85fr] lg:items-end">
          <div className="space-y-6">
            <span className="inline-flex items-center gap-2 rounded-full border border-blue-200 bg-blue-50 px-3 py-1 text-[10px] font-mono font-bold uppercase tracking-[0.16em] text-blue-700">
              <Activity className="h-3.5 w-3.5 text-emerald-500" />
              Allopal runtime / live state
            </span>
            <div className="space-y-4">
              <p className="text-xs font-bold uppercase tracking-[0.2em] text-slate-600">
                an authorization layer for AI agents using PayPal
              </p>
              <h1 className="max-w-4xl text-5xl font-semibold tracking-[-0.055em] text-slate-950 sm:text-6xl lg:text-7xl">
                agents can shop.
                <span className="block font-serif italic font-normal text-[#1f4fe0]">
                  they cannot rewrite the rules.
                </span>
              </h1>
              <p className="max-w-2xl text-base leading-7 text-slate-600 sm:text-lg">
                Allopal sits between an AI agent and the PayPal payment boundary. The agent can discover and request a purchase, the deterministic policy engine decides whether the mandate allows it, and PayPal executes only after that decision.
              </p>
            </div>
            <div className="flex flex-wrap gap-3">
              <Link href="/console" className="selo-button selo-button-primary">
                Open agent console
                <ArrowRight className="h-4 w-4" />
              </Link>
              <Link href="/mandate" className="selo-button selo-button-secondary">
                Manage mandate
                <ArrowRight className="h-4 w-4" />
              </Link>
            </div>
          </div>

          <div className="selo-card rounded-[28px] border bg-white/90 p-5 shadow-xl">
            <div className="flex items-center justify-between gap-3 border-b border-slate-200 pb-4">
              <div>
                <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-slate-600">current mandate</p>
                <h2 className="mt-1 text-lg font-bold text-slate-950">
                  {mandate?.name || "Loading mandate..."}
                </h2>
              </div>
              <span className="rounded-full border border-emerald-200 bg-emerald-50 px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider text-emerald-700">
                {mandate?.status || "loading"}
              </span>
            </div>

            <div className="grid grid-cols-2 gap-3 pt-4">
              <div className="rounded-2xl border border-slate-200 bg-slate-50 p-3">
                <WalletCards className="mb-3 h-4 w-4 text-blue-600" />
                <p className="text-[10px] uppercase tracking-wider text-slate-600">remaining</p>
                <p className="mt-1 text-2xl font-black text-slate-950">
                  {"$" + (remaining / 100).toFixed(2)}
                </p>
              </div>
              <div className="rounded-2xl border border-slate-200 bg-slate-50 p-3">
                <FileCheck2 className="mb-3 h-4 w-4 text-blue-600" />
                <p className="text-[10px] uppercase tracking-wider text-slate-600">consumed</p>
                <p className="mt-1 text-2xl font-black text-slate-950">{percent}%</p>
              </div>
            </div>

            <div className="mt-3 flex items-center justify-between text-[11px] text-slate-600">
              <span>{decisions.length} decisions recorded</span>
              <span>{transactions.length} PayPal transactions</span>
            </div>

            {notice && (
              <div className="mt-4 rounded-2xl border border-blue-200 bg-blue-50 px-3 py-2.5 text-xs font-medium text-blue-900">
                {notice}
              </div>
            )}

            {loading && (
              <div className="mt-3 text-[11px] font-mono text-slate-600">
                syncing runtime state...
              </div>
            )}
          </div>
        </section>

        <section className="space-y-5">
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.18em] text-slate-600">product map</p>
            <h2 className="mt-2 text-3xl font-semibold tracking-tight text-slate-950 sm:text-4xl">
              four screens. one runtime.
            </h2>
            <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-600">
              Each screen now has a job instead of forcing every capability into one giant landing page.
            </p>
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            {screens.map((screen) => {
              const Icon = screen.icon;
              return (
                <Link
                  key={screen.href}
                  href={screen.href}
                  className="selo-card group rounded-[28px] border bg-white/90 p-6 shadow-xl transition-transform"
                >
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex h-11 w-11 items-center justify-center rounded-2xl border border-slate-200 bg-slate-950 text-white">
                      <Icon className="h-5 w-5" />
                    </div>
                    <span className="text-[10px] font-mono font-bold uppercase tracking-[0.16em] text-slate-600">
                      {screen.label}
                    </span>
                  </div>
                  <div className="mt-8 max-w-xl">
                    <h3 className="text-2xl font-bold tracking-tight text-slate-950 transition-colors group-hover:text-[#1f4fe0]">
                      {screen.title}
                    </h3>
                    <p className="mt-3 text-sm leading-6 text-slate-600">{screen.body}</p>
                  </div>
                  <div className="mt-7 flex items-center justify-between border-t border-slate-200 pt-4">
                    <span className="text-[11px] font-mono font-semibold text-slate-700">{screen.stat}</span>
                    <ArrowRight className="h-4 w-4 text-slate-500 transition-transform group-hover:translate-x-1 group-hover:text-[#1f4fe0]" />
                  </div>
                </Link>
              );
            })}
          </div>
        </section>

        <section className="selo-shell rounded-[30px] border bg-slate-950 p-6 text-white shadow-2xl sm:p-8">
          <div className="grid gap-8 lg:grid-cols-[1fr_.9fr] lg:items-center">
            <div>
              <p className="text-xs font-bold uppercase tracking-[0.18em] text-blue-300">the invariant</p>
              <h2 className="mt-3 max-w-3xl text-3xl font-semibold tracking-tight sm:text-4xl">
                AI proposes → policy authorizes → PayPal executes
              </h2>
              <p className="mt-4 max-w-2xl text-sm leading-6 text-slate-300">
                The agent does not get payment authority. A denied request never crosses the PayPal boundary, while an approved PayPal order still waits for payer approval before capture.
              </p>
            </div>
            <div className="grid gap-2.5 sm:grid-cols-3">
              {[
                ["01", "AI agent", "proposes"],
                ["02", "policy engine", "authorizes"],
                ["03", "PayPal", "executes"],
              ].map(([n, title, value]) => (
                <div key={n} className="rounded-2xl border border-white/10 bg-white/5 p-4">
                  <span className="text-[10px] font-mono text-slate-400">{n}</span>
                  <p className="mt-4 text-sm font-bold text-white">{title}</p>
                  <p className="mt-1 text-[11px] text-slate-300">{value}</p>
                </div>
              ))}
            </div>
          </div>
        </section>
      </div>
    </ProductShell>
  );
}

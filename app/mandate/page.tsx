"use client";

import React, { useEffect, useState } from "react";
import Link from "next/link";
import { ArrowRight, CalendarDays, LockKeyhole, Plus, ShieldCheck, Store, Tag, Timer } from "lucide-react";
import { ProductShell } from "@/components/ProductShell";
import { MandateCard } from "@/components/mandate/MandateCard";
import { AiMandateModal } from "@/components/mandate/AiMandateModal";
import { useAllopalRuntime } from "@/hooks/useAllopalRuntime";

export default function MandatePage() {
  const {
    mandate,
    decisions,
    loading,
    notice,
    handleRevokeMandate,
    loadState,
  } = useAllopalRuntime();
  const [draftOpen, setDraftOpen] = useState(false);

  useEffect(() => {
    if (window.location.hash === "#draft") {
      setDraftOpen(true);
    }
  }, []);

  return (
    <ProductShell>
      <div className="space-y-10">
        <section className="grid gap-6 lg:grid-cols-[1fr_.72fr] lg:items-end">
          <div>
            <span className="inline-flex items-center gap-2 text-[10px] font-mono font-bold uppercase tracking-[0.18em] text-blue-700">
              <LockKeyhole className="h-3.5 w-3.5" />
              mandate control
            </span>
            <h1 className="mt-4 max-w-4xl text-4xl font-semibold tracking-[-0.04em] text-slate-950 sm:text-5xl">
              the rule set that keeps the agent inside the lines.
            </h1>
            <p className="mt-4 max-w-2xl text-sm leading-6 text-slate-600">
              This is the human-owned authority layer. Review the live mandate, revoke it instantly, or draft a new one with AI before explicitly locking it.
            </p>
          </div>

          <div id="draft" className="selo-card rounded-[26px] border bg-white/90 p-5 shadow-xl">
            <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-slate-700">
              <Plus className="h-4 w-4 text-blue-600" />
              create another mandate
            </div>
            <p className="mt-2 text-sm leading-6 text-slate-600">
              AI can structure intent. It cannot activate spending until you review and approve the proposal.
            </p>
            <button
              type="button"
              onClick={() => setDraftOpen(true)}
              className="selo-button selo-button-primary mt-4 w-full"
            >
              Open mandate assistant
              <ArrowRight className="h-4 w-4" />
            </button>
          </div>
        </section>

        {notice && (
          <div className="rounded-2xl border border-blue-200 bg-blue-50 px-4 py-3 text-sm font-medium text-blue-900">
            {notice}
          </div>
        )}

        <section className="grid gap-6 lg:grid-cols-[1.1fr_.9fr]">
          <MandateCard mandate={mandate} onRevoke={handleRevokeMandate} isDark={false} />

          <div className="space-y-4">
            <div className="selo-card rounded-[26px] border bg-white/90 p-6 shadow-xl">
              <div className="flex items-center gap-2">
                <ShieldCheck className="h-5 w-5 text-blue-600" />
                <h2 className="text-lg font-bold text-slate-950">Authority details</h2>
              </div>

              {mandate ? (
                <div className="mt-5 grid gap-3 sm:grid-cols-2">
                  <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                    <CalendarDays className="h-4 w-4 text-blue-600" />
                    <p className="mt-3 text-[10px] uppercase tracking-wider text-slate-600">valid from</p>
                    <p className="mt-1 text-sm font-semibold text-slate-950">{new Date(mandate.validFrom).toLocaleString()}</p>
                  </div>
                  <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                    <Timer className="h-4 w-4 text-blue-600" />
                    <p className="mt-3 text-[10px] uppercase tracking-wider text-slate-600">valid until</p>
                    <p className="mt-1 text-sm font-semibold text-slate-950">{new Date(mandate.validUntil).toLocaleString()}</p>
                  </div>
                  <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                    <Tag className="h-4 w-4 text-blue-600" />
                    <p className="mt-3 text-[10px] uppercase tracking-wider text-slate-600">categories</p>
                    <div className="mt-2 flex flex-wrap gap-1.5">
                      {mandate.allowedCategories.map((item: string) => (
                        <span key={item} className="rounded-full border border-blue-200 bg-blue-50 px-2 py-1 text-[11px] font-semibold text-blue-800">{item}</span>
                      ))}
                    </div>
                  </div>
                  <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                    <Store className="h-4 w-4 text-blue-600" />
                    <p className="mt-3 text-[10px] uppercase tracking-wider text-slate-600">merchants</p>
                    <div className="mt-2 flex flex-wrap gap-1.5">
                      {mandate.allowedMerchants.map((item: string) => (
                        <span key={item} className="rounded-full border border-indigo-200 bg-indigo-50 px-2 py-1 text-[11px] font-semibold text-indigo-900">{item}</span>
                      ))}
                    </div>
                  </div>
                </div>
              ) : (
                <p className="mt-5 text-sm text-slate-600">Loading authoritative mandate state...</p>
              )}
            </div>

            <div className="rounded-[26px] border border-slate-200 bg-slate-950 p-6 text-white shadow-xl">
              <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-blue-300">audit context</p>
              <p className="mt-3 text-3xl font-black">{decisions.length}</p>
              <p className="mt-1 text-sm text-slate-300">policy decisions currently recorded against this runtime.</p>
              <Link href="/ledger" className="mt-5 inline-flex items-center gap-2 text-sm font-semibold text-white hover:text-blue-300">
                Open decision ledger
                <ArrowRight className="h-4 w-4" />
              </Link>
            </div>
          </div>
        </section>

        <section className="grid gap-4 md:grid-cols-3">
          {[
            ["human lock", "AI proposals remain inert until the human explicitly approves them."],
            ["server authority", "Prices, categories, merchants, and mandate status are loaded on the server."],
            ["instant revocation", "A revoked mandate fails the policy gate before PayPal can be called."],
          ].map(([title, body]) => (
            <div key={title} className="selo-card rounded-[24px] border bg-white/80 p-5 shadow-lg">
              <h3 className="text-sm font-bold text-slate-950">{title}</h3>
              <p className="mt-2 text-sm leading-6 text-slate-600">{body}</p>
            </div>
          ))}
        </section>
      </div>

      <AiMandateModal
        isOpen={draftOpen}
        onClose={() => setDraftOpen(false)}
        onMandateLocked={loadState}
        isDark={false}
      />

      {loading && <div className="sr-only">Updating Allopal runtime.</div>}
    </ProductShell>
  );
}

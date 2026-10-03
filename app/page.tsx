"use client";

import React, { useState, useEffect, useCallback } from "react";
import { Navbar } from "@/components/Navbar";
import { MandateCard } from "@/components/mandate/MandateCard";
import { AgentConsole } from "@/components/payment/AgentConsole";
import { VisualPolicyGate, GateEvaluationState } from "@/components/gate/VisualPolicyGate";
import { DecisionLedger } from "@/components/ledger/DecisionLedger";
import { AiMandateModal } from "@/components/mandate/AiMandateModal";
import {
  ShieldCheck,
  Lock,
  ArrowRight,
  Cpu,
  Layers,
  Sparkles,
  ExternalLink,
  CheckCircle2,
  AlertTriangle,
} from "lucide-react";

export default function Home() {
  const [mandate, setMandate] = useState<any>(null);
  const [carts, setCarts] = useState<any[]>([]);
  const [decisions, setDecisions] = useState<any[]>([]);
  const [evaluation, setEvaluation] = useState<GateEvaluationState | null>(null);
  const [loading, setLoading] = useState(false);
  const [isAiModalOpen, setIsAiModalOpen] = useState(false);

  // Load authoritative server state
  const loadState = useCallback(async () => {
    try {
      const res = await fetch("/api/state");
      if (res.ok) {
        const data = await res.json();
        setMandate(data.mandate);
        setCarts(data.carts || []);
        setDecisions(data.decisions || []);
      }
    } catch (e) {
      console.error("Failed to load state", e);
    }
  }, []);

  useEffect(() => {
    loadState();
  }, [loadState]);

  // Demo Reset Handler
  const handleResetDemo = async () => {
    setLoading(true);
    try {
      await fetch("/api/demo/reset", { method: "POST" });
      setEvaluation(null);
      await loadState();
    } finally {
      setLoading(false);
    }
  };

  // Revoke Mandate Handler
  const handleRevokeMandate = async (mandateId: string) => {
    setLoading(true);
    try {
      await fetch("/api/mandates/revoke", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ mandateId }),
      });
      await loadState();
    } finally {
      setLoading(false);
    }
  };

  // Dry-Run Policy Gate
  const handleAuthorize = async (cartId: string) => {
    if (!mandate) return;
    setLoading(true);
    try {
      const res = await fetch("/api/authorize", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          mandateId: mandate.id,
          cartId,
        }),
      });
      const data = await res.json();

      let aiExplanation = "";
      try {
        const explainRes = await fetch("/api/decisions/explain", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            decision: {
              status: data.status,
              reason: data.reason,
              failedCheck: data.failedCheck,
              amount: data.amount,
              merchant: data.merchant,
              category: data.category,
              remainingBudget: data.remainingBudgetBefore,
            },
          }),
        });
        if (explainRes.ok) {
          const explainData = await explainRes.json();
          aiExplanation = explainData.explanation;
        }
      } catch (err) {
        console.error("Explanation error", err);
      }

      setEvaluation({
        status: data.status,
        amount: data.amount,
        merchant: data.merchant,
        category: data.category,
        reason: data.reason,
        failedCheck: data.failedCheck,
        paypalCalled: false,
        paypalOrderId: null,
        checks: data.checks,
        aiExplanation,
      });

      await loadState();
    } finally {
      setLoading(false);
    }
  };

  // Execute Real PayPal Payment
  const handleExecutePayment = async (cartId: string) => {
    if (!mandate) return;
    setLoading(true);
    try {
      const res = await fetch("/api/payments/pay", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          mandateId: mandate.id,
          cartId,
        }),
      });
      const data = await res.json();

      let aiExplanation = "";
      try {
        const explainRes = await fetch("/api/decisions/explain", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            decision: {
              status: data.status === "COMPLETED" ? "ALLOWED" : "DENIED",
              reason: data.reason || (data.status === "COMPLETED" ? "Payment authorized and captured." : "Denied"),
              failedCheck: data.failedCheck || null,
              amount: data.amount,
              merchant: data.merchant || "Campus Books",
              category: data.category || "School Supplies",
              remainingBudget: data.remainingBudget,
            },
          }),
        });
        if (explainRes.ok) {
          const explainData = await explainRes.json();
          aiExplanation = explainData.explanation;
        }
      } catch (err) {
        console.error("Explanation error", err);
      }

      setEvaluation({
        status: data.status,
        amount: data.amount,
        merchant: data.merchant || "Campus Books",
        category: data.category || "School Supplies",
        reason: data.reason || "Payment completed.",
        failedCheck: data.failedCheck || null,
        paypalCalled: data.paypalCalled ?? (data.status === "COMPLETED"),
        paypalOrderId: data.paypalOrderId,
        paypalCaptureId: data.paypalCaptureId,
        checks: data.checks,
        aiExplanation,
      });

      await loadState();
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen relative text-[#1c1c1f] selection:bg-[#1f4fe0]/20 selection:text-[#1c1c1f]">
      {/* Background Soft Sheen Overlay */}
      <div className="fixed inset-0 pointer-events-none bg-gradient-to-b from-white/70 via-transparent to-white/80 z-0" />

      {/* Floating Navbar */}
      <Navbar
        onResetDemo={handleResetDemo}
        onOpenAiModal={() => setIsAiModalOpen(true)}
      />

      {/* Main Content Area */}
      <main className="relative z-10 pt-28 pb-20 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 space-y-16">
        
        {/* ================= HERO SECTION ================= */}
        <section id="hero" className="pt-8 pb-4 text-center sm:text-left">
          <div className="flex flex-col lg:flex-row lg:items-end justify-between gap-8">
            <div className="max-w-3xl space-y-4">
              <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-white/85 backdrop-blur-md border border-white/60 shadow-sm text-xs font-semibold text-[#1f4fe0]">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src="/logo.png" alt="Allopal Logo" className="w-4 h-4 rounded object-cover" />
                <span>Deterministic Spending Gateway</span>
                <span className="text-slate-300">•</span>
                <span className="text-[#6b6b73]">PayPal Agentic Commerce</span>
              </div>

              <h1 className="text-4xl sm:text-6xl lg:text-7xl font-light tracking-tight text-[#1c1c1f] leading-[1.08]">
                Runtime spending controls <br className="hidden sm:inline" />
                for <span className="font-normal italic font-serif text-[#1f4fe0]">AI-agent</span> teams.
              </h1>

              <p className="text-base sm:text-lg text-[#6b6b73] font-light max-w-2xl leading-relaxed">
                Allopal gives autonomous AI agents a locked spending mandate, not access to your PayPal credentials.
                Budget is reserved and deterministically authorized by server policy before any payment occurs.
              </p>

              <div className="pt-2 flex flex-wrap items-center gap-3">
                <a
                  href="#console"
                  className="inline-flex items-center gap-2 px-5 py-3 rounded-xl bg-[#17171a] hover:bg-black text-sm font-medium text-white shadow-md transition-all hover:scale-[1.02] active:scale-[0.98]"
                >
                  <span>Launch Live Console</span>
                  <ArrowRight className="w-4 h-4" />
                </a>

                <button
                  onClick={() => setIsAiModalOpen(true)}
                  className="inline-flex items-center gap-2 px-5 py-3 rounded-xl bg-white/85 hover:bg-white border border-[#d6d6dc] text-sm font-medium text-[#1c1c1f] shadow-sm backdrop-blur-md transition-all hover:scale-[1.02] active:scale-[0.98]"
                >
                  <Sparkles className="w-4 h-4 text-amber-500" />
                  <span>Draft Mandate with AI</span>
                </button>
              </div>
            </div>

            {/* Right Side Stats / Subtext */}
            <div className="lg:text-right space-y-2 lg:max-w-xs">
              <p className="text-xs uppercase tracking-widest text-[#5f5f67] font-semibold">
                Guaranteed Execution Invariant
              </p>
              <p className="font-serif italic text-2xl sm:text-3xl text-[#1f4fe0] leading-tight">
                One mandate. One budget. Across every agent.
              </p>
              <p className="text-xs text-[#6b6b73] font-light">
                Policy engine evaluates 8 checks in order. Denied payments result in zero PayPal API calls.
              </p>
            </div>
          </div>
        </section>

        {/* ================= INVARIANT FORMULA BANNER ================= */}
        <section id="invariant">
          <div className="rounded-3xl bg-gradient-to-br from-white/90 via-white/80 to-[#f0f4fd]/80 backdrop-blur-xl border border-white/80 p-8 sm:p-12 shadow-xl shadow-blue-500/5 grid grid-cols-1 lg:grid-cols-12 gap-8 items-center">
            <div className="lg:col-span-8 space-y-4">
              <span className="text-xs font-bold tracking-widest text-[#1736b8] uppercase">
                Core Deterministic Invariant
              </span>

              <div className="space-y-2 font-mono text-2xl sm:text-4xl font-normal text-[#1c1c1f] tracking-tight">
                <div className="flex items-center gap-3">
                  <span className="text-[#15803d] font-bold">MANDATE PASSES</span>
                  <span className="text-[#6b6b73]">&rarr;</span>
                  <span className="text-[#1f4fe0] font-bold">PAYPAL CAPTURE</span>
                </div>
                <div className="flex items-center gap-3">
                  <span className="text-[#c8201a] font-bold">MANDATE FAILS</span>
                  <span className="text-[#6b6b73]">&rarr;</span>
                  <span className="text-[#8a1511] font-bold">NO PAYPAL CALL</span>
                </div>
              </div>

              <p className="text-sm sm:text-base text-[#6b6b73] font-light max-w-xl leading-relaxed">
                The AI can propose mandates and explain outcomes, but it must never independently authorize money movement.
                Authorization belongs strictly to the server policy engine; execution belongs to PayPal.
              </p>
            </div>

            <div className="lg:col-span-4 border-t lg:border-t-0 lg:border-l border-[#d6d6dc] pt-6 lg:pt-0 lg:pl-8 space-y-3 font-serif italic text-lg sm:text-xl text-[#1c1c1f]">
              <div className="flex items-center gap-2 text-[#1f4fe0]">
                <CheckCircle2 className="w-5 h-5 flex-none" />
                <span>Zero unauthorized money movement</span>
              </div>
              <div className="flex items-center gap-2 text-[#5f5f67]">
                <CheckCircle2 className="w-5 h-5 flex-none text-[#15803d]" />
                <span>Authoritative database reload</span>
              </div>
              <div className="flex items-center gap-2 text-[#5f5f67]">
                <CheckCircle2 className="w-5 h-5 flex-none text-[#15803d]" />
                <span>Atomic double-spend prevention</span>
              </div>
            </div>
          </div>
        </section>

        {/* ================= CONSOLE STAGE APPLICATION WINDOW ================= */}
        <section id="console" className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-2xl font-light text-[#1c1c1f] tracking-tight">
                Agentic <span className="font-serif italic text-[#1f4fe0]">Commerce</span> Console
              </h2>
              <p className="text-xs text-[#6b6b73]">
                Simulate autonomous shopping agent payment requests against the active mandate
              </p>
            </div>
            <div className="flex items-center gap-2 text-xs font-mono text-[#5f5f67]">
              <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
              <span>PAYPAL SANDBOX READY</span>
            </div>
          </div>

          {/* Desktop App Shell Window */}
          <div className="rounded-3xl bg-gradient-to-b from-[#fbfbfd]/95 to-[#f4f4f7]/95 backdrop-blur-2xl border border-white/80 shadow-2xl shadow-black/5 overflow-hidden">
            {/* MacOS Window Top Bar */}
            <div className="h-12 border-b border-[#e7e7ec] bg-white/60 px-5 flex items-center justify-between">
              <div className="flex items-center space-x-2">
                <div className="w-3 h-3 rounded-full bg-[#ff5f56] border border-black/10" />
                <div className="w-3 h-3 rounded-full bg-[#ffbd2e] border border-black/10" />
                <div className="w-3 h-3 rounded-full bg-[#27c93f] border border-black/10" />
                <span className="ml-3 text-xs font-mono text-[#9b9ba3]">
                  allopal-runtime-v1 // paypal-sandbox // policy-gate
                </span>
              </div>
              <div className="flex items-center gap-2">
                <span className="px-2 py-0.5 rounded text-[10px] font-mono font-semibold bg-[#e8eefd] text-[#1736b8]">
                  SQLite dev.db
                </span>
              </div>
            </div>

            {/* Window Content: 2 Columns */}
            <div className="p-6 sm:p-8 grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
              {/* Left Column: Mandate Overview Card */}
              <div className="lg:col-span-6 space-y-6">
                <MandateCard
                  mandate={mandate}
                  onRevoke={handleRevokeMandate}
                />
              </div>

              {/* Right Column: Agent Commerce Simulator */}
              <div className="lg:col-span-6 space-y-6">
                <AgentConsole
                  carts={carts}
                  mandateId={mandate?.id || null}
                  onAuthorize={handleAuthorize}
                  onExecutePayment={handleExecutePayment}
                  loading={loading}
                />
              </div>
            </div>
          </div>
        </section>

        {/* ================= VISUAL POLICY GATE ================= */}
        <section id="gate" className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-2xl font-light text-[#1c1c1f] tracking-tight">
                Deterministic <span className="font-serif italic text-[#1f4fe0]">Policy</span> Gate
              </h2>
              <p className="text-xs text-[#6b6b73]">
                Server-side ordered check evaluation and real-time execution telemetry
              </p>
            </div>
          </div>

          <VisualPolicyGate
            evaluation={evaluation}
            loading={loading}
          />
        </section>

        {/* ================= THREE SPECIFICATION CARDS ================= */}
        <section className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {/* Card 1 */}
            <div className="rounded-3xl bg-white/80 backdrop-blur-xl border border-white/80 p-8 shadow-lg shadow-black/5 flex flex-col justify-between space-y-6">
              <div className="space-y-4">
                <div className="w-14 h-14 rounded-2xl bg-gradient-to-tr from-[#cfdcfb] via-[#eaf0fd] to-[#d3e0fb] flex items-center justify-center text-[#1f4fe0] shadow-md shadow-blue-500/10 border border-white">
                  <Cpu className="w-7 h-7" />
                </div>
                <h3 className="text-xl font-medium text-[#1c1c1f] tracking-tight">
                  Deterministic Authorization
                </h3>
                <p className="text-sm text-[#6b6b73] font-light leading-relaxed">
                  AI models interpret human language, parse natural commands, and explain decisions. They are strictly prohibited from independently authorizing money movement.
                </p>
              </div>
              <div className="pt-2 border-t border-[#d6d6dc]/60 text-xs font-mono text-[#5f5f67]">
                0% LLM authorization hallucination
              </div>
            </div>

            {/* Card 2 */}
            <div className="rounded-3xl bg-white/80 backdrop-blur-xl border border-white/80 p-8 shadow-lg shadow-black/5 flex flex-col justify-between space-y-6">
              <div className="space-y-4">
                <div className="w-14 h-14 rounded-2xl bg-gradient-to-tr from-[#cfdcfb] via-[#eaf0fd] to-[#d3e0fb] flex items-center justify-center text-[#1f4fe0] shadow-md shadow-blue-500/10 border border-white">
                  <ShieldCheck className="w-7 h-7" />
                </div>
                <h3 className="text-xl font-medium text-[#1c1c1f] tracking-tight">
                  Authoritative Server Authority
                </h3>
                <p className="text-sm text-[#6b6b73] font-light leading-relaxed">
                  Client-supplied prices, categories, and merchants are discarded. The server fetches authoritative product data from SQLite, completely neutralizing price-tampering exploits.
                </p>
              </div>
              <div className="pt-2 border-t border-[#d6d6dc]/60 text-xs font-mono text-[#5f5f67]">
                Integer cents monetary precision
              </div>
            </div>

            {/* Card 3 */}
            <div className="rounded-3xl bg-white/80 backdrop-blur-xl border border-white/80 p-8 shadow-lg shadow-black/5 flex flex-col justify-between space-y-6">
              <div className="space-y-4">
                <div className="w-14 h-14 rounded-2xl bg-gradient-to-tr from-[#cfdcfb] via-[#eaf0fd] to-[#d3e0fb] flex items-center justify-center text-[#1f4fe0] shadow-md shadow-blue-500/10 border border-white">
                  <Layers className="w-7 h-7" />
                </div>
                <h3 className="text-xl font-medium text-[#1c1c1f] tracking-tight">
                  Atomic Concurrency & Replay Safety
                </h3>
                <p className="text-sm text-[#6b6b73] font-light leading-relaxed">
                  Atomic transactions guarantee two concurrent $25 requests against a $40 limit never charge $50. Idempotency keys protect against double-captures from network retries.
                </p>
              </div>
              <div className="pt-2 border-t border-[#d6d6dc]/60 text-xs font-mono text-[#5f5f67]">
                Fail-closed rollback protection
              </div>
            </div>
          </div>
        </section>

        {/* ================= DECISION AUDIT LEDGER ================= */}
        <section id="ledger" className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-2xl font-light text-[#1c1c1f] tracking-tight">
                Authoritative <span className="font-serif italic text-[#1f4fe0]">Decision</span> Ledger
              </h2>
              <p className="text-xs text-[#6b6b73]">
                Immutable SQLite record of evaluated payments and real PayPal sandbox Order IDs
              </p>
            </div>
          </div>

          <DecisionLedger decisions={decisions} />
        </section>
      </main>

      {/* ================= FOOTER ================= */}
      <footer className="border-t border-[#d6d6dc]/60 bg-white/70 backdrop-blur-lg py-8 text-xs text-[#6b6b73]">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex items-center space-x-2">
            <span className="font-bold text-[#1c1c1f]">Allopal</span>
            <span>—</span>
            <span>Deterministic spending authorization layer for PayPal agentic commerce</span>
          </div>

          <div className="flex items-center space-x-6 text-[#5f5f67]">
            <a
              href="#hero"
              className="hover:text-[#1c1c1f] transition-colors"
            >
              Back to Top
            </a>
            <a
              href="https://github.com/Tajudeeen/allopal"
              target="_blank"
              rel="noopener noreferrer"
              className="hover:text-[#1c1c1f] transition-colors inline-flex items-center gap-1"
            >
              <span>GitHub</span>
              <ExternalLink className="w-3 h-3" />
            </a>
          </div>
        </div>
      </footer>

      {/* AI Mandate Creation Modal */}
      <AiMandateModal
        isOpen={isAiModalOpen}
        onClose={() => setIsAiModalOpen(false)}
        onMandateLocked={loadState}
      />
    </div>
  );
}

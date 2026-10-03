"use client";

import React, { useState, useEffect, useCallback } from "react";
import { Navbar, AppPalette } from "@/components/Navbar";
import {
  PRESET_BACKGROUND_COLORS,
  getAdaptiveTypography,
  AdaptiveTypography,
} from "@/lib/theme/contrast";
import { MandateCard } from "@/components/mandate/MandateCard";
import { AgentConsole } from "@/components/payment/AgentConsole";
import { VisualPolicyGate, GateEvaluationState } from "@/components/gate/VisualPolicyGate";
import { DecisionLedger } from "@/components/ledger/DecisionLedger";
import { AiMandateModal } from "@/components/mandate/AiMandateModal";
import { Footer } from "@/components/Footer";
import {
  ArrowRight,
  Cpu,
  Layers,
  Sparkles,
  ExternalLink,

  CheckCircle2,
  ShieldCheck,
} from "lucide-react";

export default function Home() {
  const [mandate, setMandate] = useState<any>(null);
  const [carts, setCarts] = useState<any[]>([]);
  const [decisions, setDecisions] = useState<any[]>([]);
  const [evaluation, setEvaluation] = useState<GateEvaluationState | null>(null);
  const [loading, setLoading] = useState(false);
  const [isAiModalOpen, setIsAiModalOpen] = useState(false);

  // Adaptive background color & typography state
  const [bgColorHex, setBgColorHex] = useState<string>("#05070d");
  const [palette, setPalette] = useState<AppPalette>("obsidian");
  const typography: AdaptiveTypography = getAdaptiveTypography(bgColorHex);
  const isDark = typography.isDark;


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

  // Determine background overlay style based on background color
  const getOverlayStyle = () => {
    const matched = PRESET_BACKGROUND_COLORS.find(
      (p) => p.hex.toLowerCase() === bgColorHex.toLowerCase()
    );
    if (matched) {
      return matched.overlayStyle;
    }
    return isDark ? "backdrop-blur-sm" : "backdrop-blur-md";
  };

  const isCustomBg = !PRESET_BACKGROUND_COLORS.some(
    (p) => p.hex.toLowerCase() === bgColorHex.toLowerCase()
  );

  return (
    <div
      style={isCustomBg ? { backgroundColor: bgColorHex } : undefined}
      className={`min-h-screen relative transition-colors duration-500 selection:bg-[#1f4fe0]/30 ${
        isDark ? "text-white selection:text-white" : "text-slate-900 selection:text-slate-900"
      }`}
    >
      {/* Background Soft Sheen Overlay responding to selected background color */}
      <div
        className={`fixed inset-0 pointer-events-none z-0 transition-all duration-700 ${getOverlayStyle()}`}
        style={
          isCustomBg
            ? { backgroundColor: `${bgColorHex}${isDark ? "bf" : "e6"}` }
            : undefined
        }
      />

      {/* Floating Navbar with Background Color & Contrast Controller */}
      <Navbar
        onResetDemo={handleResetDemo}
        onOpenAiModal={() => setIsAiModalOpen(true)}
        palette={palette}
        onSelectPalette={setPalette}
        currentBgColorHex={bgColorHex}
        onSelectBgColorHex={setBgColorHex}
      />


      {/* Main Content Area */}
      <main className="relative z-10 pt-28 pb-20 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 space-y-16">
        
        {/* ================= HERO SECTION ================= */}
        <section id="hero" className="pt-8 pb-4 text-center sm:text-left">
          <div className="flex flex-col lg:flex-row lg:items-end justify-between gap-8">
            <div className="max-w-3xl space-y-4">
              <div
                className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-full border text-xs font-semibold backdrop-blur-md transition-colors ${
                  isDark
                    ? "bg-slate-900/80 border-slate-700/80 text-blue-300 shadow-md"
                    : "bg-white/90 border-slate-200 text-[#1f4fe0] shadow-sm"
                }`}
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src="/logo.png"
                  alt="Allopal Logo"
                  className="w-4 h-4 rounded object-cover shadow-sm"
                />
                <span>Deterministic Spending Gateway</span>
                <span className={isDark ? "text-slate-600" : "text-slate-300"}>•</span>
                <span className={isDark ? "text-slate-300" : "text-slate-600"}>
                  PayPal Agentic Commerce
                </span>
              </div>

              <h1
                className={`text-4xl sm:text-6xl lg:text-7xl font-light tracking-tight leading-[1.08] transition-colors ${
                  isDark
                    ? "text-white drop-shadow-[0_2px_12px_rgba(0,0,0,0.8)]"
                    : "text-slate-950 drop-shadow-sm"
                }`}
              >
                Runtime spending controls <br className="hidden sm:inline" />
                for{" "}
                <span
                  className={`font-normal italic font-serif ${
                    isDark ? "text-blue-400" : "text-[#1f4fe0]"
                  }`}
                >
                  AI-agent
                </span>{" "}
                teams.
              </h1>

              <p
                className={`text-base sm:text-lg font-light max-w-2xl leading-relaxed transition-colors ${
                  isDark
                    ? "text-slate-200 drop-shadow-[0_1px_6px_rgba(0,0,0,0.8)]"
                    : "text-slate-600"
                }`}
              >
                Allopal gives autonomous AI agents a locked spending mandate, not access to your PayPal credentials.
                Budget is reserved and deterministically authorized by server policy before any payment occurs.
              </p>

              <div className="pt-2 flex flex-wrap items-center gap-3">
                <a
                  href="#console"
                  className={`inline-flex items-center gap-2 px-5 py-3 rounded-xl text-sm font-bold shadow-xl transition-all hover:scale-[1.02] active:scale-[0.98] ${
                    isDark
                      ? "bg-white text-slate-950 hover:bg-slate-100 shadow-white/10"
                      : "bg-[#17171a] text-white hover:bg-black shadow-slate-900/20"
                  }`}
                >
                  <span>Launch Live Console</span>
                  <ArrowRight className="w-4 h-4" />
                </a>

                <button
                  onClick={() => setIsAiModalOpen(true)}
                  className={`inline-flex items-center gap-2 px-5 py-3 rounded-xl border text-sm font-semibold shadow-sm backdrop-blur-md transition-all hover:scale-[1.02] active:scale-[0.98] ${
                    isDark
                      ? "bg-slate-900/80 hover:bg-slate-800 border-slate-700/80 text-white"
                      : "bg-white/85 hover:bg-white border-slate-300 text-slate-900"
                  }`}
                >
                  <Sparkles className="w-4 h-4 text-amber-400" />
                  <span>Draft Mandate with AI</span>
                </button>
              </div>
            </div>

            {/* Right Side Stats / Subtext */}
            <div className="lg:text-right space-y-2 lg:max-w-xs">
              <p
                className={`text-xs uppercase tracking-widest font-semibold ${
                  isDark ? "text-slate-400" : "text-slate-500"
                }`}
              >
                Guaranteed Execution Invariant
              </p>
              <p
                className={`font-serif italic text-2xl sm:text-3xl leading-tight ${
                  isDark ? "text-blue-300" : "text-[#1f4fe0]"
                }`}
              >
                One mandate. One budget. Across every agent.
              </p>
              <p
                className={`text-xs font-light ${
                  isDark ? "text-slate-300" : "text-slate-600"
                }`}
              >
                Policy engine evaluates 8 checks in order. Denied payments result in zero PayPal API calls.
              </p>
            </div>
          </div>
        </section>

        {/* ================= INVARIANT FORMULA BANNER ================= */}
        <section id="invariant">
          <div
            className={`rounded-3xl p-8 sm:p-12 border shadow-2xl grid grid-cols-1 lg:grid-cols-12 gap-8 items-center backdrop-blur-2xl transition-all ${
              isDark
                ? "bg-slate-950/85 border-slate-800/80 text-white shadow-black/60"
                : "bg-gradient-to-br from-white/95 via-white/85 to-[#f0f4fd]/90 border-slate-200/90 text-slate-900 shadow-xl"
            }`}
          >
            <div className="lg:col-span-8 space-y-4">
              <span
                className={`text-xs font-bold tracking-widest uppercase ${
                  isDark ? "text-blue-400" : "text-[#1736b8]"
                }`}
              >
                Core Deterministic Invariant
              </span>

              <div className="space-y-2 font-mono text-2xl sm:text-4xl font-normal tracking-tight">
                <div className="flex items-center gap-3">
                  <span className="text-emerald-400 font-bold drop-shadow-sm">
                    MANDATE PASSES
                  </span>
                  <span className={isDark ? "text-slate-500" : "text-slate-400"}>&rarr;</span>
                  <span className="text-blue-400 font-bold drop-shadow-sm">
                    PAYPAL CAPTURE
                  </span>
                </div>
                <div className="flex items-center gap-3">
                  <span className="text-rose-400 font-bold drop-shadow-sm">
                    MANDATE FAILS
                  </span>
                  <span className={isDark ? "text-slate-500" : "text-slate-400"}>&rarr;</span>
                  <span className="text-rose-300 font-bold drop-shadow-sm">
                    NO PAYPAL CALL
                  </span>
                </div>
              </div>

              <p
                className={`text-sm sm:text-base font-light max-w-xl leading-relaxed ${
                  isDark ? "text-slate-300" : "text-slate-600"
                }`}
              >
                The AI can propose mandates and explain outcomes, but it must never independently authorize money movement.
                Authorization belongs strictly to the server policy engine; execution belongs to PayPal.
              </p>
            </div>

            <div
              className={`lg:col-span-4 border-t lg:border-t-0 lg:border-l pt-6 lg:pt-0 lg:pl-8 space-y-3 font-serif italic text-lg sm:text-xl ${
                isDark ? "border-slate-800 text-slate-200" : "border-slate-200 text-slate-800"
              }`}
            >
              <div className="flex items-center gap-2 text-blue-400">
                <CheckCircle2 className="w-5 h-5 flex-none" />
                <span>Zero unauthorized money movement</span>
              </div>
              <div className="flex items-center gap-2">
                <CheckCircle2 className="w-5 h-5 flex-none text-emerald-400" />
                <span>Authoritative database reload</span>
              </div>
              <div className="flex items-center gap-2">
                <CheckCircle2 className="w-5 h-5 flex-none text-emerald-400" />
                <span>Atomic double-spend prevention</span>
              </div>
            </div>
          </div>
        </section>

        {/* ================= CONSOLE STAGE APPLICATION WINDOW ================= */}
        <section id="console" className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h2
                className={`text-2xl font-light tracking-tight ${
                  isDark
                    ? "text-white drop-shadow-[0_1px_4px_rgba(0,0,0,0.6)]"
                    : "text-slate-950"
                }`}
              >
                Agentic{" "}
                <span
                  className={`font-serif italic ${
                    isDark ? "text-blue-400" : "text-[#1f4fe0]"
                  }`}
                >
                  Commerce
                </span>{" "}
                Console
              </h2>
              <p className={`text-xs ${isDark ? "text-slate-300" : "text-slate-600"}`}>
                Simulate autonomous shopping agent payment requests against the active mandate
              </p>
            </div>
            <div
              className={`flex items-center gap-2 text-xs font-mono ${
                isDark ? "text-slate-300" : "text-slate-600"
              }`}
            >
              <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
              <span>PAYPAL SANDBOX READY</span>
            </div>
          </div>

          {/* Desktop App Shell Window */}
          <div
            className={`rounded-3xl border shadow-2xl overflow-hidden backdrop-blur-2xl transition-all ${
              isDark
                ? "bg-slate-950/90 border-slate-800/90 shadow-black/80 text-white"
                : "bg-gradient-to-b from-[#fbfbfd]/95 to-[#f4f4f7]/95 border-slate-200/90 shadow-xl text-slate-900"
            }`}
          >
            {/* MacOS Window Top Bar */}
            <div
              className={`h-12 border-b px-5 flex items-center justify-between transition-colors ${
                isDark
                  ? "bg-slate-900/90 border-slate-800"
                  : "bg-white/70 border-slate-200"
              }`}
            >
              <div className="flex items-center space-x-2">
                <div className="w-3 h-3 rounded-full bg-[#ff5f56] border border-black/10" />
                <div className="w-3 h-3 rounded-full bg-[#ffbd2e] border border-black/10" />
                <div className="w-3 h-3 rounded-full bg-[#27c93f] border border-black/10" />
                <span
                  className={`ml-3 text-xs font-mono ${
                    isDark ? "text-slate-400" : "text-slate-500"
                  }`}
                >
                  allopal-runtime-v1 // paypal-sandbox // policy-gate
                </span>
              </div>
              <div className="flex items-center gap-2">
                <span
                  className={`px-2 py-0.5 rounded text-[10px] font-mono font-semibold border ${
                    isDark
                      ? "bg-blue-950/80 text-blue-300 border-blue-800/60"
                      : "bg-blue-50 text-blue-700 border-blue-200"
                  }`}
                >
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
                  isDark={isDark}
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
                  isDark={isDark}
                />
              </div>
            </div>
          </div>
        </section>

        {/* ================= VISUAL POLICY GATE ================= */}
        <section id="gate" className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h2
                className={`text-2xl font-light tracking-tight ${
                  isDark
                    ? "text-white drop-shadow-[0_1px_4px_rgba(0,0,0,0.6)]"
                    : "text-slate-950"
                }`}
              >
                Deterministic{" "}
                <span
                  className={`font-serif italic ${
                    isDark ? "text-blue-400" : "text-[#1f4fe0]"
                  }`}
                >
                  Policy
                </span>{" "}
                Gate
              </h2>
              <p className={`text-xs ${isDark ? "text-slate-300" : "text-slate-600"}`}>
                Server-side ordered check evaluation and real-time execution telemetry
              </p>
            </div>
          </div>

          <VisualPolicyGate
            evaluation={evaluation}
            loading={loading}
            isDark={isDark}
          />
        </section>

        {/* ================= THREE SPECIFICATION CARDS ================= */}
        <section className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {/* Card 1 */}
            <div
              className={`rounded-3xl p-8 border shadow-2xl flex flex-col justify-between space-y-6 backdrop-blur-2xl transition-all ${
                isDark
                  ? "bg-slate-900/85 border-slate-800/80 text-white shadow-black/50"
                  : "bg-white/90 border-slate-200/90 text-slate-900 shadow-xl"
              }`}
            >
              <div className="space-y-4">
                <div
                  className={`w-14 h-14 rounded-2xl flex items-center justify-center border shadow-md ${
                    isDark
                      ? "bg-gradient-to-tr from-gray-900 via-black to-gray-900 border-slate-800 text-white shadow-black/50"
                      : "bg-gradient-to-tr from-gray-900 via-black to-gray-900 border-slate-800 text-slate-300"
                  }`}
                >
                  <Cpu className="w-7 h-7" />
                </div>
                <h3 className="text-xl font-bold tracking-tight">
                  Deterministic Authorization
                </h3>
                <p
                  className={`text-sm font-light leading-relaxed ${
                    isDark ? "text-slate-300" : "text-slate-600"
                  }`}
                >
                  AI models interpret human language, parse natural commands, and explain decisions. They are strictly prohibited from independently authorizing money movement.
                </p>
              </div>
              <div
                className={`pt-3 border-t text-xs font-mono ${
                  isDark ? "border-slate-800 text-blue-300" : "border-slate-200 text-blue-700"
                }`}
              >
                0% LLM authorization hallucination
              </div>
            </div>

            {/* Card 2 */}
            <div
              className={`rounded-3xl p-8 border shadow-2xl flex flex-col justify-between space-y-6 backdrop-blur-2xl transition-all ${
                isDark
                  ? "bg-slate-900/85 border-slate-800/80 text-white shadow-black/50"
                  : "bg-white/90 border-slate-200/90 text-slate-900 shadow-xl"
              }`}
            >
              <div className="space-y-4">
                <div
                  className={`w-14 h-14 rounded-2xl flex items-center justify-center border shadow-md ${
                    isDark
                      ? "bg-gradient-to-tr from-gray-900 via-black to-gray-900 border-slate-800 text-white shadow-black/50"
                      : "bg-gradient-to-tr from-gray-900 via-black to-gray-900 border-slate-800 text-slate-300"
                  }`}
                >
                  <ShieldCheck className="w-7 h-7" />
                </div>
                <h3 className="text-xl font-bold tracking-tight">
                  Authoritative Server Authority
                </h3>
                <p
                  className={`text-sm font-light leading-relaxed ${
                    isDark ? "text-slate-300" : "text-slate-600"
                  }`}
                >
                  Client-supplied prices, categories, and merchants are discarded. The server fetches authoritative product data from SQLite, completely neutralizing price-tampering exploits.
                </p>
              </div>
              <div
                className={`pt-3 border-t text-xs font-mono ${
                  isDark ? "border-slate-800 text-blue-300" : "border-slate-200 text-blue-700"
                }`}
              >
                Integer cents monetary precision
              </div>
            </div>

            {/* Card 3 */}
            <div
              className={`rounded-3xl p-8 border shadow-2xl flex flex-col justify-between space-y-6 backdrop-blur-2xl transition-all ${
                isDark
                  ? "bg-slate-900/85 border-slate-800/80 text-white shadow-black/50"
                  : "bg-white/90 border-slate-200/90 text-slate-900 shadow-xl"
              }`}
            >
              <div className="space-y-4">
                <div
                  className={`w-14 h-14 rounded-2xl flex items-center justify-center border shadow-md ${
                    isDark
                      ? "bg-gradient-to-tr from-gray-900 via-black to-gray-900 border-slate-800 text-white shadow-black/50"
                      : "bg-gradient-to-tr from-gray-900 via-black to-gray-900 border-slate-800 text-slate-300"
                  }`}
                >
                  <Layers className="w-7 h-7" />
                </div>
                <h3 className="text-xl font-bold tracking-tight">
                  Atomic Concurrency & Replay Safety
                </h3>
                <p
                  className={`text-sm font-light leading-relaxed ${
                    isDark ? "text-slate-300" : "text-slate-600"
                  }`}
                >
                  Atomic transactions guarantee two concurrent $25 requests against a $40 limit never charge $50. Idempotency keys protect against double-captures from network retries.
                </p>
              </div>
              <div
                className={`pt-3 border-t text-xs font-mono ${
                  isDark ? "border-slate-800 text-blue-300" : "border-slate-200 text-blue-700"
                }`}
              >
                Fail-closed rollback protection
              </div>
            </div>
          </div>
        </section>

        {/* ================= DECISION AUDIT LEDGER ================= */}
        <section id="ledger" className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h2
                className={`text-2xl font-light tracking-tight ${
                  isDark
                    ? "text-white drop-shadow-[0_1px_4px_rgba(0,0,0,0.6)]"
                    : "text-slate-950"
                }`}
              >
                Authoritative{" "}
                <span
                  className={`font-serif italic ${
                    isDark ? "text-blue-400" : "text-[#1f4fe0]"
                  }`}
                >
                  Decision
                </span>{" "}
                Ledger
              </h2>
              <p className={`text-xs ${isDark ? "text-slate-300" : "text-slate-600"}`}>
                Immutable SQLite record of evaluated payments and real PayPal sandbox Order IDs
              </p>
            </div>
          </div>

          <DecisionLedger decisions={decisions} isDark={isDark} />
        </section>
      </main>

      {/* ================= FOOTER ================= */}
      <Footer onOpenAiModal={() => setIsAiModalOpen(true)} isDark={isDark} />


      {/* AI Mandate Creation Modal */}
      <AiMandateModal
        isOpen={isAiModalOpen}
        onClose={() => setIsAiModalOpen(false)}
        onMandateLocked={loadState}
        isDark={isDark}
      />
    </div>
  );
}

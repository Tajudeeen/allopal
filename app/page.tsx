"use client";

import React, { useState, useEffect, useCallback } from "react";
import { Navbar } from "@/components/Navbar";
import { MandateCard } from "@/components/mandate/MandateCard";
import { AgentConsole } from "@/components/payment/AgentConsole";
import { VisualPolicyGate, GateEvaluationState } from "@/components/gate/VisualPolicyGate";
import { DecisionLedger } from "@/components/ledger/DecisionLedger";
import { AiMandateModal } from "@/components/mandate/AiMandateModal";

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

      // Fetch AI explanation
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

      // Fetch AI explanation
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
    <div className="min-h-screen flex flex-col bg-slate-100 selection:bg-paypal-blue selection:text-white">
      {/* Top Navbar */}
      <Navbar
        onResetDemo={handleResetDemo}
        onOpenAiModal={() => setIsAiModalOpen(true)}
      />

      {/* Main Interactive Grid */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-6">
        {/* Top Row: Mandate Status + Agent Simulator */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
          <div className="lg:col-span-6 space-y-6">
            <MandateCard
              mandate={mandate}
              onRevoke={handleRevokeMandate}
            />
          </div>

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

        {/* Middle Row: Visual Policy Gate */}
        <VisualPolicyGate
          evaluation={evaluation}
          loading={loading}
        />

        {/* Bottom Row: Real-time Authoritative Decision Ledger */}
        <DecisionLedger decisions={decisions} />
      </main>

      {/* AI Mandate Creation Modal */}
      <AiMandateModal
        isOpen={isAiModalOpen}
        onClose={() => setIsAiModalOpen(false)}
        onMandateLocked={loadState}
      />
    </div>
  );
}

"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { GateEvaluationState } from "@/components/gate/VisualPolicyGate";

interface RuntimeState {
  paypalMode: "PAYPAL_SANDBOX" | "PAYPAL";
  mandate: any;
  carts: any[];
  decisions: any[];
  transactions: any[];
}

export interface AgentRunState {
  task: string;
  mode: "DRY_RUN" | "EXECUTE";
  selectedCartId: string;
  productName: string;
  amount: number;
  merchant: string;
  category: string;
  reasoning: string;
  finalDecision: string;
  paypalCalled: boolean;
}

export function useAllopalRuntime() {
  const [paypalMode, setPaypalMode] = useState<RuntimeState["paypalMode"]>("PAYPAL_SANDBOX");
  const [mandate, setMandate] = useState<any>(null);
  const [carts, setCarts] = useState<any[]>([]);
  const [decisions, setDecisions] = useState<any[]>([]);
  const [transactions, setTransactions] = useState<any[]>([]);
  const [evaluation, setEvaluation] = useState<GateEvaluationState | null>(null);
  const [loading, setLoading] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const [agentRun, setAgentRun] = useState<AgentRunState | null>(null);
  const paymentKeyRef = useRef<string | null>(null);

  const loadState = useCallback(async () => {
    const res = await fetch("/api/state", { cache: "no-store" });
    if (!res.ok) throw new Error("Unable to load Allopal state.");
    const data: RuntimeState = await res.json();
    setPaypalMode(data.paypalMode || "PAYPAL_SANDBOX");
    setMandate(data.mandate);
    setCarts(data.carts || []);
    setDecisions(data.decisions || []);
    setTransactions(data.transactions || []);
    return data;
  }, []);

  useEffect(() => {
    loadState().catch((error) => {
      console.error(error);
      setNotice(error instanceof Error ? error.message : "Unable to load application state.");
    });
  }, [loadState]);

  useEffect(() => {
    const payment = new URLSearchParams(window.location.search).get("payment");
    if (!payment) return;

    const messages: Record<string, string> = {
      completed: "PayPal payment captured successfully.",
      cancelled: "PayPal checkout was cancelled. Reserved budget has been released.",
      failed: "PayPal rejected the payment. Reserved budget has been released.",
      pending: "PayPal returned an unresolved payment state. The transaction remains pending for reconciliation.",
    };

    setNotice(messages[payment] || `Payment state: ${payment}`);
    window.history.replaceState(null, "", window.location.pathname);
  }, []);

  const handleAgentRequest = useCallback(async (
    task: string,
    mode: "DRY_RUN" | "EXECUTE"
  ) => {
    setLoading(true);
    setNotice(null);

    try {
      const idempotencyKey = mode === "EXECUTE" ? crypto.randomUUID() : undefined;
      const res = await fetch("/api/agent/act", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(idempotencyKey ? { "Idempotency-Key": idempotencyKey } : {}),
        },
        body: JSON.stringify({
          task,
          mode,
          ...(idempotencyKey ? { idempotencyKey } : {}),
        }),
      });

      const data = await res.json();

      if (!res.ok && !data.agent) {
        throw new Error(data.message || data.error || "Agent request failed.");
      }

      const result = data.result || {};
      const finalDecision = result.status || data.authority?.finalDecision || "UNKNOWN";

      setAgentRun({
        task: data.agent.task,
        mode,
        selectedCartId: data.agent.selectedCartId,
        productName: data.agent.productName,
        amount: data.agent.amount,
        merchant: data.agent.merchant,
        category: data.agent.category,
        reasoning: data.agent.reasoning,
        finalDecision,
        paypalCalled: Boolean(result.paypalCalled),
      });

      if (result.status === "PENDING_APPROVAL" && result.approvalUrl) {
        setNotice("Agent selected the cart and Allopal authorized it. Continue to PayPal for payer approval.");
        window.location.assign(result.approvalUrl);
        return;
      }

      if (!res.ok && result.status !== "DENIED") {
        setEvaluation({
          status: "FAILED",
          amount: result.amount || data.agent.amount || 0,
          merchant: result.merchant || data.agent.merchant,
          category: result.category || data.agent.category,
          reason: result.message || result.error || "Agent payment failed.",
          failedCheck: result.failedCheck || null,
          paypalCalled: Boolean(result.paypalCalled),
          paypalOrderId: result.paypalOrderId || null,
          paypalCaptureId: result.paypalCaptureId || null,
          checks: result.checks,
        });
      } else {
        setEvaluation({
          status: finalDecision,
          amount: result.amount || data.agent.amount,
          merchant: result.merchant || data.agent.merchant,
          category: result.category || data.agent.category,
          reason: result.reason || data.agent.reasoning,
          failedCheck: result.failedCheck || null,
          paypalCalled: Boolean(result.paypalCalled),
          paypalOrderId: result.paypalOrderId || null,
          paypalCaptureId: result.paypalCaptureId || null,
          approvalUrl: result.approvalUrl || null,
          checks: result.checks,
        });
      }

      await loadState();
    } catch (error) {
      setNotice(error instanceof Error ? error.message : "Agent request failed.");
    } finally {
      setLoading(false);
    }
  }, [loadState]);

  const handleRevokeMandate = useCallback(async (mandateId: string) => {
    setLoading(true);
    try {
      const res = await fetch("/api/mandates/revoke", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ mandateId }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || data.error || "Failed to revoke mandate.");
      setNotice("Mandate revoked. New spending requests are now blocked.");
      await loadState();
    } finally {
      setLoading(false);
    }
  }, [loadState]);

  const handleAuthorize = useCallback(async (cartId: string) => {
    if (!mandate) return;
    setLoading(true);
    setNotice(null);
    try {
      const res = await fetch("/api/authorize", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ mandateId: mandate.id, cartId }),
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
              paypalCalled: false,
              paymentStatus: null,
            },
          }),
        });
        if (explainRes.ok) aiExplanation = (await explainRes.json()).explanation;
      } catch (error) {
        console.error("Explanation error", error);
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
    } catch (error) {
      setNotice(error instanceof Error ? error.message : "Authorization request failed.");
    } finally {
      setLoading(false);
    }
  }, [loadState, mandate]);

  const handleExecutePayment = useCallback(async (cartId: string) => {
    if (!mandate) return;
    const idempotencyKey = paymentKeyRef.current ?? crypto.randomUUID();
    paymentKeyRef.current = idempotencyKey;
    setLoading(true);
    setNotice(null);

    try {
      const res = await fetch("/api/payments/pay", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Idempotency-Key": idempotencyKey,
        },
        body: JSON.stringify({
          mandateId: mandate.id,
          cartId,
          idempotencyKey,
        }),
      });
      const data = await res.json();

      if (data.status === "PENDING_APPROVAL" && data.approvalUrl) {
        window.location.assign(data.approvalUrl);
        return;
      }

      if (!res.ok && data.status !== "DENIED") {
        setEvaluation({
          status: "FAILED",
          amount: data.amount || 0,
          merchant: data.merchant || "Unknown merchant",
          category: data.category || "Unknown category",
          reason: data.message || data.error || "Payment request failed.",
          failedCheck: data.failedCheck || null,
          paypalCalled: Boolean(data.paypalCalled),
          paypalOrderId: data.paypalOrderId || null,
          paypalCaptureId: data.paypalCaptureId || null,
          checks: data.checks,
        });
        await loadState();
        return;
      }

      let aiExplanation = "";
      try {
        const explainRes = await fetch("/api/decisions/explain", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            decision: {
              status: data.status === "COMPLETED" || data.status === "ALLOWED" ? "ALLOWED" : "DENIED",
              reason: data.reason || (data.status === "COMPLETED" ? "Payment authorized and captured." : "Denied"),
              failedCheck: data.failedCheck || null,
              amount: data.amount,
              merchant: data.merchant || "Unknown merchant",
              category: data.category || "Unknown category",
              remainingBudget: data.remainingBudget,
              paypalCalled: Boolean(data.paypalCalled),
              paymentStatus: data.paymentStatus || (data.status === "COMPLETED" ? "COMPLETED" : null),
            },
          }),
        });
        if (explainRes.ok) aiExplanation = (await explainRes.json()).explanation;
      } catch (error) {
        console.error("Explanation error", error);
      }

      setEvaluation({
        status: data.status,
        amount: data.amount,
        merchant: data.merchant || "Unknown merchant",
        category: data.category || "Unknown category",
        reason: data.reason || "Payment completed.",
        failedCheck: data.failedCheck || null,
        paypalCalled: data.paypalCalled ?? (data.status === "COMPLETED"),
        paypalOrderId: data.paypalOrderId || null,
        paypalCaptureId: data.paypalCaptureId || null,
        approvalUrl: data.approvalUrl || null,
        checks: data.checks,
        aiExplanation,
      });

      await loadState();
    } catch (error) {
      setNotice(error instanceof Error ? error.message : "Payment request failed.");
    } finally {
      paymentKeyRef.current = null;
      setLoading(false);
    }
  }, [loadState, mandate]);

  return {
    paypalMode,
    mandate,
    carts,
    decisions,
    transactions,
    evaluation,
    loading,
    notice,
    setNotice,
    loadState,
    handleRevokeMandate,
    handleAuthorize,
    handleExecutePayment,
    handleAgentRequest,
    agentRun,
  };
}

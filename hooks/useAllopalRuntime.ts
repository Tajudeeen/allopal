"use client";

import {
  operationKey,
  rememberOperation,
  clearSettledOperations,
} from "@/lib/payments/client-operation";
import { verifiedPaymentMessage } from "@/lib/payments/presentation";

import { useCallback, useEffect, useState } from "react";
import type { GateEvaluationState } from "@/components/gate/VisualPolicyGate";
import { useTransactionPolling } from "./useTransactionPolling";

interface MandateData {
  id: string;
  name: string;
  status: string;
  weeklyLimit: number;
  spentAmount: number;
  validFrom: string;
  validUntil: string;
  allowedCategories: string[];
  allowedMerchants: string[];
  workspaceId: string;
}

interface CartData {
  id: string;
  merchant: string;
  totalAmount: number;
  items: CartItemData[];
}

interface CartItemData {
  id: string;
  productId: string;
  quantity: number;
  price: number;
  product: ProductData;
}

interface ProductData {
  id: string;
  name: string;
  price: number;
  merchant: string;
  category: string;
}

interface TransactionData {
  id: string;
  status: string;
  orderId?: string | null;
  captureId?: string | null;
  mandateId?: string;
  decisionId?: string;
  amount: number;
  currency: string;
  createdAt: string;
  updatedAt?: string;
  errorCode?: string | null;
  approvalUrl?: string | null;
}

interface DecisionData {
  id: string;
  mandateId: string;
  cartId: string;
  status: string;
  amount: number;
  merchant: string;
  category: string;
  reason: string;
  paypalOrderId: string | null;
  paymentStatus?: string | null;
  paypalCaptureId?: string | null;
  paypalCalled?: boolean;
  checks?: Record<string, unknown>;
  createdAt: string;
}

interface RuntimeState {
  paypalMode: "PAYPAL_SANDBOX" | "PAYPAL";
  paypalConfigured: boolean;
  aiConfigured: boolean;
  mandate: MandateData | null;
  carts: CartData[];
  decisions: DecisionData[];
  transactions: TransactionData[];
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
  paypalOrderId: string | null;
  approvalToken?: string | null;
  attemptId?: string;
}

export function useAllopalRuntime() {
  const [paypalMode, setPaypalMode] =
    useState<RuntimeState["paypalMode"]>("PAYPAL_SANDBOX");
  const [paypalConfigured, setPaypalConfigured] = useState(false);
  const [aiConfigured, setAiConfigured] = useState(false);
  const [mandate, setMandate] = useState<MandateData | null>(null);
  const [carts, setCarts] = useState<CartData[]>([]);
  const [decisions, setDecisions] = useState<DecisionData[]>([]);
  const [transactions, setTransactions] = useState<TransactionData[]>([]);
  const [evaluation, setEvaluation] = useState<GateEvaluationState | null>(
    null,
  );
  const [loading, setLoading] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const [agentRun, setAgentRun] = useState<AgentRunState | null>(null);

  const loadState = useCallback(async () => {
    const res = await fetch("/api/state", { cache: "no-store" });
    if (!res.ok) throw new Error("Unable to load Allopal state.");
    const data: RuntimeState = await res.json();
    setPaypalMode(data.paypalMode || "PAYPAL_SANDBOX");
    setPaypalConfigured(Boolean(data.paypalConfigured));
    setAiConfigured(Boolean(data.aiConfigured));
    setMandate(data.mandate);
    setCarts(data.carts || []);
    setDecisions(data.decisions || []);
    setTransactions(data.transactions || []);
    clearSettledOperations(data.transactions || []);
    return data;
  }, []);

  useEffect(() => {
    loadState().catch((error) => {
      console.error(error);
      setNotice(
        error instanceof Error
          ? error.message
          : "Unable to load application state.",
      );
    });
  }, [loadState]);

  const evaluationAttemptId = evaluation?.attemptId;
  const agentAttemptId = agentRun?.attemptId;

  useEffect(() => {
    const tracked = transactions.find(
      (item) => item.id === evaluationAttemptId || item.id === agentAttemptId,
    );
    const order =
      new URLSearchParams(window.location.search).get("order") ||
      tracked?.orderId;
    if (!order) return;
    let disposed = false;
    async function verify() {
      try {
        const response = await fetch(
          `/api/payments/status?order=${encodeURIComponent(order!)}`,
          { cache: "no-store" },
        );
        if (!response.ok)
          throw new Error("Payment could not be verified. Check your ledger.");
        const result = await response.json();
        if (!disposed) {
          setNotice(verifiedPaymentMessage(result));
          setEvaluation(result);
          setAgentRun((previous) =>
            previous && previous.attemptId === result.attemptId
              ? {
                  ...previous,
                  finalDecision: result.status,
                  paypalOrderId: result.paypalOrderId,
                  approvalToken: result.approvalToken,
                }
              : previous,
          );
          window.history.replaceState(null, "", window.location.pathname);
        }
      } catch (error) {
        if (!disposed)
          setNotice(
            error instanceof Error
              ? error.message
              : "Payment verification unavailable.",
          );
      }
    }
    void verify();
    return () => {
      disposed = true;
    };
  }, [transactions, evaluationAttemptId, agentAttemptId]);

  useTransactionPolling(
    transactions,
    async () => { await loadState(); },
    (msg) => setNotice(msg),
  );

  const handleAgentRequest = useCallback(
    async (task: string, mode: "DRY_RUN" | "EXECUTE") => {
      setLoading(true);
      setNotice(null);

      try {
        const scope = `agent:${task.trim()}`;
        const idempotencyKey =
          mode === "EXECUTE" ? operationKey(scope) : undefined;
        const res = await fetch("/api/agent/act", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            ...(idempotencyKey ? { "Idempotency-Key": idempotencyKey } : {}),
          },
          body: JSON.stringify({
            task,
            mode,
          }),
        });

        const data = await res.json();

        if (!res.ok && !data.agent) {
          throw new Error(
            data.message || data.error || "Agent request failed.",
          );
        }

        const result = data.result || {};
        if (mode === "EXECUTE") rememberOperation(scope, result);
        const finalDecision =
          result.status || data.authority?.finalDecision || "UNKNOWN";

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
          attemptId: result.attemptId,
          paypalOrderId: result.paypalOrderId || null,
          approvalToken: result.approvalToken || null,
        });

        if (result.status === "PENDING_APPROVAL") {
          setNotice(
            "Agent selected the cart and Allopal authorized it. Approve the order with PayPal below.",
          );
        }

        if (!res.ok && !["DENIED", "PENDING"].includes(result.status)) {
          setEvaluation({
            status: "FAILED",
            amount: result.amount || data.agent.amount || 0,
            merchant: result.merchant || data.agent.merchant,
            category: result.category || data.agent.category,
            reason: result.message || result.error || "Agent payment failed.",
            failedCheck: result.failedCheck || null,
            paypalCalled: Boolean(result.paypalCalled),
            attemptId: result.attemptId,
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
            attemptId: result.attemptId,
            paypalOrderId: result.paypalOrderId || null,
            paypalCaptureId: result.paypalCaptureId || null,
            approvalUrl: result.approvalUrl || null,
            checks: result.checks,
          });
        }

        await loadState();
      } catch (error) {
        setNotice(
          error instanceof Error ? error.message : "Agent request failed.",
        );
      } finally {
        setLoading(false);
      }
    },
    [loadState],
  );

  const handleRevokeMandate = useCallback(
    async (mandateId: string) => {
      setLoading(true);
      try {
        const res = await fetch("/api/mandates/revoke", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ mandateId }),
        });
        const data = await res.json();
        if (!res.ok)
          throw new Error(
            data.message || data.error || "Failed to revoke mandate.",
          );
        setNotice("Mandate revoked. New spending requests are now blocked.");
        await loadState();
      } finally {
        setLoading(false);
      }
    },
    [loadState],
  );

  const handleAuthorize = useCallback(
    async (cartId: string) => {
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
          if (aiConfigured) {
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
            if (explainRes.ok)
              aiExplanation = (await explainRes.json()).explanation;
          }
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
        setNotice(
          error instanceof Error
            ? error.message
            : "Authorization request failed.",
        );
      } finally {
        setLoading(false);
      }
    },
    [loadState, mandate, aiConfigured],
  );

  const handleExecutePayment = useCallback(
    async (cartId: string) => {
      if (!mandate) return;
      const scope = `cart:${mandate.id}:${cartId}`;
      const idempotencyKey = operationKey(scope);
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
          }),
        });
        const data = await res.json();
        rememberOperation(scope, data);

        if (data.status === "PENDING_APPROVAL" && data.approvalUrl) {
          window.location.assign(data.approvalUrl);
          return;
        }

        if (!res.ok && !["DENIED", "PENDING"].includes(data.status)) {
          setEvaluation({
            status: "FAILED",
            amount: data.amount || 0,
            merchant: data.merchant || "Unknown merchant",
            category: data.category || "Unknown category",
            reason: data.message || data.error || "Payment request failed.",
            failedCheck: data.failedCheck || null,
            paypalCalled: Boolean(data.paypalCalled),
            attemptId: data.attemptId,
            paypalOrderId: data.paypalOrderId || null,
            paypalCaptureId: data.paypalCaptureId || null,
            checks: data.checks,
          });
          await loadState();
          return;
        }

        let aiExplanation = "";
        try {
          if (aiConfigured && ["COMPLETED", "DENIED"].includes(data.status)) {
            const explainRes = await fetch("/api/decisions/explain", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                decision: {
                  status:
                    data.status === "COMPLETED" || data.status === "ALLOWED"
                      ? "ALLOWED"
                      : "DENIED",
                  reason:
                    data.reason ||
                    (data.status === "COMPLETED"
                      ? "Payment authorized and captured."
                      : "Denied"),
                  failedCheck: data.failedCheck || null,
                  amount: data.amount,
                  merchant: data.merchant || "Unknown merchant",
                  category: data.category || "Unknown category",
                  remainingBudget: data.remainingBudget,
                  paypalCalled: Boolean(data.paypalCalled),
                  paymentStatus:
                    data.paymentStatus ||
                    (data.status === "COMPLETED" ? "COMPLETED" : null),
                },
              }),
            });
            if (explainRes.ok)
              aiExplanation = (await explainRes.json()).explanation;
          }
        } catch (error) {
          console.error("Explanation error", error);
        }

        setEvaluation({
          status: data.status,
          amount: data.amount,
          merchant: data.merchant || "Unknown merchant",
          category: data.category || "Unknown category",
          reason:
            data.reason ||
            (data.status === "COMPLETED"
              ? "Payment completed."
              : "Payment remains pending."),
          failedCheck: data.failedCheck || null,
          paypalCalled: data.paypalCalled ?? data.status === "COMPLETED",
          attemptId: data.attemptId,
          paypalOrderId: data.paypalOrderId || null,
          paypalCaptureId: data.paypalCaptureId || null,
          approvalUrl: data.approvalUrl || null,
          checks: data.checks,
          aiExplanation,
        });

        await loadState();
      } catch (error) {
        setNotice(
          error instanceof Error ? error.message : "Payment request failed.",
        );
      } finally {
        setLoading(false);
      }
    },
    [loadState, mandate, aiConfigured],
  );

  return {
    paypalMode,
    paypalConfigured,
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

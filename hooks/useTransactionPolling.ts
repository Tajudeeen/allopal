"use client";
import { useEffect } from "react";

interface Transaction {
  id: string;
  status: string;
  orderId?: string | null;
}

const TERMINAL = ["COMPLETED", "FAILED", "CANCELLED", "REFUNDED", "REVERSED", "REVIEW_REQUIRED"];

export function useTransactionPolling(
  transactions: Transaction[],
  onRefresh: () => Promise<void>,
  onError: (msg: string) => void,
) {
  const hasUnresolved = transactions.some((t) => !TERMINAL.includes(t.status));

  useEffect(() => {
    if (!hasUnresolved) return;
    const timer = window.setInterval(async () => {
      try {
        await fetch("/api/payments/reconcile", { method: "POST" });
        await onRefresh();
      } catch {
        onError("Status refresh unavailable. Your pending payment remains reserved.");
      }
    }, 15000);
    return () => window.clearInterval(timer);
  }, [hasUnresolved, onRefresh, onError]);
}

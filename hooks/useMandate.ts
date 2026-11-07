"use client";
import { useCallback, useState } from "react";

export interface MandateState {
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

export function useMandate() {
  const [mandate, setMandate] = useState<MandateState | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const refreshMandate = useCallback(async (workspaceData?: { mandate: MandateState | null }) => {
    if (workspaceData) {
      setMandate(workspaceData.mandate);
      return;
    }
  }, []);

  const revokeMandate = useCallback(async (mandateId: string) => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/mandates/revoke", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ mandateId }),
      });
      const data = await res.json();
      if (!res.ok)
        throw new Error(data.message || data.error || "Failed to revoke mandate.");
      return true;
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to revoke mandate.");
      return false;
    } finally {
      setLoading(false);
    }
  }, []);

  return { mandate, setMandate, loading, error, setError, refreshMandate, revokeMandate };
}

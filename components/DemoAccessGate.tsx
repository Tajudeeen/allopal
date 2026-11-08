"use client";
import { ReactNode, useEffect } from "react";

/**
 * DemoAccessGate - Bypassed to view the build directly.
 * Automatically initializes demo session in the background so all APIs work.
 */
export function DemoAccessGate({ children }: { children: ReactNode }) {
  useEffect(() => {
    fetch("/api/demo/session", { cache: "no-store" })
      .then(async (res) => {
        if (!res.ok) {
          await fetch("/api/demo/session", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({}),
          });
        }
      })
      .catch(() => {});
  }, []);

  return <>{children}</>;
}

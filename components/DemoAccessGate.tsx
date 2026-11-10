"use client";

import { ReactNode, useEffect, useState } from "react";

async function ensureDemoSession() {
  const check = await fetch("/api/demo/session", {
    method: "GET",
    cache: "no-store",
    credentials: "same-origin",
  });

  if (check.ok) return;

  if (check.status !== 401) {
    const payload = await check.json().catch(() => ({}));
    throw new Error(payload.message || payload.error || "Unable to verify demo session.");
  }

  const create = await fetch("/api/demo/session", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({}),
    cache: "no-store",
    credentials: "same-origin",
  });

  if (!create.ok) {
    const payload = await create.json().catch(() => ({}));
    throw new Error(payload.message || payload.error || "Unable to start demo session.");
  }

  // Confirm the browser accepted and now sends the HttpOnly session cookie.
  const verify = await fetch("/api/demo/session", {
    method: "GET",
    cache: "no-store",
    credentials: "same-origin",
  });
  if (!verify.ok) {
    const payload = await verify.json().catch(() => ({}));
    throw new Error(payload.message || payload.error || "Demo session cookie was not persisted.");
  }
}

export function DemoAccessGate({ children }: { children: ReactNode }) {
  const [ready, setReady] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    let active = true;
    ensureDemoSession()
      .then(() => {
        if (active) {
          setError(null);
          setReady(true);
        }
      })
      .catch((cause: unknown) => {
        if (active) {
          setError(cause instanceof Error ? cause.message : "Demo session initialization failed.");
        }
      });
    return () => {
      active = false;
    };
  }, [attempt]);

  if (!ready) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-slate-950 px-6 text-white">
        <div className="w-full max-w-md rounded-2xl border border-white/10 bg-white/[0.04] p-6 text-center">
          <p className="text-xs font-mono uppercase tracking-[0.18em] text-blue-300">
            allopal / secure demo
          </p>
          <h1 className="mt-3 text-xl font-semibold">
            {error ? "Session could not start" : "Preparing your secure session"}
          </h1>
          <p className="mt-2 text-sm leading-6 text-slate-300">
            {error || "Your workspace is being initialized before the app loads."}
          </p>
          {error && (
            <button
              type="button"
              onClick={() => {
                setReady(false);
                setError(null);
                setAttempt((value) => value + 1);
              }}
              className="mt-5 rounded-xl bg-blue-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-blue-500"
            >
              Retry session
            </button>
          )}
        </div>
      </main>
    );
  }

  return <>{children}</>;
}

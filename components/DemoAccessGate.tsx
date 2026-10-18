"use client";
import { FormEvent, ReactNode, useEffect, useState } from "react";
import { LockKeyhole, LoaderCircle } from "lucide-react";
export function DemoAccessGate({ children }: { children: ReactNode }) {
  const [state, setState] = useState<"checking" | "locked" | "ready">(
    "checking",
  );
  const [accessKey, setAccessKey] = useState("");
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    let disposed = false;
    fetch("/api/demo/session", { cache: "no-store" })
      .then((res) => {
        if (!disposed) setState(res.ok ? "ready" : "locked");
      })
      .catch(() => {
        if (!disposed) {
          setState("locked");
          setMessage("Unable to reach Allopal. Try again.");
        }
      });
    return () => {
      disposed = true;
    };
  }, []);
  async function open(event: FormEvent) {
    event.preventDefault();
    setBusy(true);
    setMessage("");
    try {
      const response = await fetch("/api/demo/session", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ accessKey }),
      });
      if (!response.ok) {
        const data = await response.json();
        setMessage(
          data.error === "DEMO_ACCESS_NOT_CONFIGURED"
            ? "The builder needs to configure demo access before this deployment can open."
            : "Couldn't open the workspace. Check the access key and try again.",
        );
        return;
      }
      setAccessKey("");
      setState("ready");
    } catch {
      setMessage("Unable to reach Allopal. Try again.");
    } finally {
      setBusy(false);
    }
  }
  if (state === "ready") return children;
  return (
    <main className="relative z-20 flex min-h-screen items-center justify-center px-5 py-16">
      <section className="w-full max-w-md rounded-3xl border border-white/15 bg-slate-950/95 p-8 text-white shadow-2xl">
        <LockKeyhole
          className="mb-5 h-8 w-8 text-blue-300"
          aria-hidden="true"
        />
        <p className="text-xs font-semibold uppercase tracking-widest text-blue-300">
          Allopal demo
        </p>
        <h1 className="mt-3 text-3xl font-semibold">
          Your own spending workspace.
        </h1>
        <p className="mt-4 text-sm leading-6 text-slate-300">
          Review mandates, test guarded purchases, and inspect your ledger. Each
          demo session keeps its records separate.
        </p>
        {state === "checking" ? (
          <p role="status" className="mt-6 flex items-center gap-2 text-sm">
            <LoaderCircle className="h-4 w-4 animate-spin" />
            Checking your session...
          </p>
        ) : (
          <form onSubmit={open} className="mt-7 space-y-4">
            <label className="block text-sm font-medium" htmlFor="demo-key">
              Demo access key
            </label>
            <input
              id="demo-key"
              type="password"
              autoComplete="current-password"
              value={accessKey}
              onChange={(event) => setAccessKey(event.target.value)}
              className="w-full rounded-xl border border-slate-600 bg-slate-900 p-3 text-white outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-400/30"
            />
            <p className="text-xs leading-5 text-slate-400">
              Use the key provided by the builder. Local development can leave
              this blank.
            </p>
            {message && (
              <p role="alert" className="text-sm leading-5 text-amber-200">
                {message}
              </p>
            )}
            <button
              disabled={busy}
              className="w-full rounded-xl bg-blue-600 px-4 py-3 text-sm font-semibold text-white transition hover:bg-blue-500 disabled:opacity-60"
            >
              {busy ? "Opening workspace..." : "Open demo workspace"}
            </button>
          </form>
        )}
      </section>
    </main>
  );
}

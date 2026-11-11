"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { ProductShell } from "@/components/ProductShell";
import type { AnalyticsResponse } from "@/lib/analytics/types";

const steps = [
  {
    title: "Review the human boundary",
    detail:
      "Open the $40 school-supplies mandate. AI may draft a proposal, but a person must review and lock it.",
    href: "/mandate",
  },
  {
    title: "Try the blocked purchase",
    detail:
      "Ask for the $90 gaming headset in policy-only mode. Inspect the category denial and confirm no PayPal order was created.",
    href: "/console",
  },
  {
    title: "Complete a permitted Sandbox purchase",
    detail:
      "Ask for school supplies under $20, execute the $18 notebook bundle, then approve using a Sandbox personal buyer account. Return to Allopal and inspect the capture ID. This step requires configured providers.",
    href: "/console",
  },
  {
    title: "Inspect the remaining authority",
    detail:
      "After the $18 capture, the original $40 mandate should show $22 remaining. A $25 request must fail the budget check. Revoke the mandate and try the $8 cart.",
    href: "/policy",
  },
  {
    title: "Inspect evidence and analysis",
    detail:
      "Compare the ledger with Insights. Customize the dashboard, ask why a purchase was blocked, and inspect its cited record. Dashboard changes and analysis cannot authorize money.",
    href: "/insights",
  },
  {
    title: "Export your own session",
    detail:
      "Download sanitized evidence. It contains your policy and payment records without payer payloads or callback secrets. Other browser sessions have separate records.",
    href: "/ledger",
  },
];
export default function JudgePage() {
  const [report, setReport] = useState<AnalyticsResponse | null>(null);
  const [error, setError] = useState(false);
  useEffect(() => {
    const controller = new AbortController();
    fetch("/api/analytics", { cache: "no-store", signal: controller.signal })
      .then(async (r) => {
        if (!r.ok) throw new Error();
        setReport(await r.json());
      })
      .catch(() => {
        if (!controller.signal.aborted) setError(true);
      });
    return () => controller.abort();
  }, []);
  const availability = report?.availability;
  return (
    <ProductShell className="analytics-shell">
      <div className="mx-auto max-w-4xl space-y-8">
        <section>
          <p className="text-xs font-semibold uppercase tracking-widest text-blue-700">
            Reviewer guide
          </p>
          <h1 className="mt-4 text-4xl font-semibold tracking-tight sm:text-5xl">
            Follow the money boundary.
          </h1>
          <p className="mt-4 text-sm leading-7 text-slate-600">
            Allopal lets an AI suggest a purchase while server policy checks a
            human-locked spending mandate before PayPal execution. This guide
            shows the expected behavior and the evidence to inspect.
          </p>
        </section>
        <section className="rounded-3xl border border-slate-200 bg-white/95 p-6">
          <h2 className="text-xl font-semibold">This demo environment</h2>
          <p className="mt-2 text-sm text-slate-600">
            Configuration indicates availability, not successful external
            verification.
          </p>
          {error && (
            <p role="alert" className="mt-4 text-sm text-rose-800">
              Configuration status could not be loaded. Reopen your demo
              session.
            </p>
          )}
          {!availability && !error && (
            <p className="mt-4 text-sm">Checking configuration…</p>
          )}
          {availability && (
            <ul className="mt-4 space-y-2 text-sm">
              <li>
                PayPal credentials:{" "}
                {availability.paypal ? "configured" : "missing"}
              </li>
              <li>
                Payment environment:{" "}
                {availability.sandbox
                  ? "Sandbox"
                  : "live provider configured, use Sandbox for judging"}
              </li>
              <li>Groq AI: {availability.ai ? "configured" : "missing"}</li>
              <li>
                Webhook ID:{" "}
                {availability.webhook
                  ? "configured, delivery still needs verification"
                  : "missing"}
              </li>
              <li>
                Recorded captures in your current table snapshot:{" "}
                {report.payments.filter((p) => p.captured).length}
              </li>
              <li>
                AG Studio license:{" "}
                {process.env.NEXT_PUBLIC_AG_STUDIO_LICENSE_KEY
                  ? "key configured, confirm sponsor coverage through judging"
                  : "no app key configured, AG Grid says hackathon judging is sponsor-covered"}
              </li>
            </ul>
          )}
        </section>
        <ol className="space-y-4">
          {steps.map((step, i) => (
            <li
              key={step.title}
              className="rounded-3xl border border-slate-200 bg-white/95 p-6"
            >
              <p className="text-xs font-semibold text-blue-700">
                Step {i + 1}
              </p>
              <h2 className="mt-2 text-xl font-semibold">{step.title}</h2>
              <p className="mt-3 text-sm leading-7 text-slate-600">
                {step.detail}
              </p>
              <Link
                href={step.href}
                className="mt-4 inline-block text-sm font-semibold text-blue-700"
              >
                Open this step →
              </Link>
            </li>
          ))}
        </ol>
        <section className="rounded-3xl border border-amber-200 bg-amber-50 p-6">
          <h2 className="font-semibold">What the demo proves</h2>
          <p className="mt-3 text-sm leading-7">
            A denied request stops at the policy boundary. An allowed request
            reserves authority and still needs PayPal buyer approval. A payment
            is complete only after its captured state is recorded. A timeout
            keeps funds reserved until provider reconciliation establishes the
            outcome.
          </p>
          <p className="mt-3 text-sm leading-7">
            This is a session-isolated Sandbox demonstration with a controlled
            catalog. It does not purchase from arbitrary retailers, fulfill
            orders, or establish a production financial identity.
          </p>
        </section>
        <p className="text-sm leading-7 text-slate-600">
          The public judging demo creates an isolated workspace automatically
          for each browser. Sessions last 24 hours. After a session expires,
          reload the app to start a fresh workspace. No shared access key is
          needed for this public demo.
        </p>
      </div>
    </ProductShell>
  );
}

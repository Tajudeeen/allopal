"use client";

import React from "react";
import Link from "next/link";
import { ArrowRight, Bot, LockKeyhole, ShieldCheck } from "lucide-react";
import { useRouter } from "next/navigation";

const points = [
  {
    icon: LockKeyhole,
    title: "you set the boundary",
    body: "A human-owned mandate controls what the agent can spend, where, and for how much.",
  },
  {
    icon: ShieldCheck,
    title: "rules decide",
    body: "Every request passes through deterministic checks before payment can cross the PayPal boundary.",
  },
  {
    icon: Bot,
    title: "agents can act",
    body: "The agent can shop inside the approved boundary without receiving direct access to payment credentials.",
  },
];

export default function WelcomePage() {
  const router = useRouter();

  const enterApp = () => {
    window.localStorage.setItem("allopal-intro-seen", "true");
    router.push("/");
  };

  return (
    <main className="relative min-h-screen overflow-hidden bg-[#08090c] text-white">
      <div className="absolute inset-0 bg-[url('/bg.jpg')] bg-cover bg-center opacity-70" />
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_12%_12%,rgba(31,79,224,0.28),transparent_28%),radial-gradient(circle_at_88%_15%,rgba(117,88,255,0.20),transparent_26%),linear-gradient(180deg,rgba(5,6,9,0.2),rgba(5,6,9,0.86))]" />
      <div className="absolute inset-0 bg-[linear-gradient(rgba(255,255,255,0.028)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.028)_1px,transparent_1px)] bg-[size:42px_42px] opacity-45" />

      <div className="relative z-10 mx-auto flex min-h-screen w-full max-w-6xl flex-col px-5 py-7 sm:px-8 sm:py-10">
        <header className="flex items-center justify-between">
          <Link href="/" className="group flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center overflow-hidden rounded-xl border border-black/10 bg-white/60 shadow-sm backdrop-blur-xl transition-transform group-hover:scale-[1.04]">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src="/logo.png" alt="Allopal" className="h-full w-full object-contain p-1" />
            </div>
            <span className="text-sm font-bold tracking-tight">Allopal<span className="text-[#4e79ff]">.</span></span>
          </Link>

          <span className="rounded-full border border-white/10 bg-white/5 px-3 py-1.5 text-[9px] font-mono font-semibold uppercase tracking-[0.18em] text-white/55">
            PayPal Runtime Gate
          </span>
        </header>

        <section className="flex flex-1 items-center py-16">
          <div className="grid w-full gap-12 lg:grid-cols-[1.05fr_.95fr] lg:items-center">
            <div className="max-w-2xl">
              <p className="text-[10px] font-mono font-bold uppercase tracking-[0.22em] text-blue-300">
                welcome to allopal
              </p>

              <h1 className="mt-5 text-5xl font-semibold leading-[0.98] tracking-[-0.06em] sm:text-6xl lg:text-7xl">
                let the agent shop.
                <span className="mt-2 block font-serif italic font-normal text-[#6b8cff]">
                  keep the money under rules.
                </span>
              </h1>

              <p className="mt-6 max-w-xl text-base leading-7 text-white/66 sm:text-lg">
                Allopal puts a deterministic spending authorization layer between an AI agent and PayPal.
                You define the boundary. The rules enforce it. The ledger remembers what happened.
              </p>

              <div className="mt-8 flex flex-wrap items-center gap-3">
                <button
                  type="button"
                  onClick={enterApp}
                  className="selo-button !min-h-[46px] !rounded-[14px] !bg-white !px-5 !text-[#101114] shadow-2xl"
                >
                  Enter Allopal
                  <ArrowRight className="h-4 w-4" />
                </button>
                <Link
                  href="/policy"
                  onClick={() => window.localStorage.setItem("allopal-intro-seen", "true")}
                  className="inline-flex min-h-[46px] items-center rounded-[14px] border border-white/15 bg-white/5 px-4 text-xs font-semibold text-white/80 backdrop-blur-xl transition hover:bg-white/10 hover:text-white"
                >
                  Inspect the policy
                </Link>
              </div>

              <p className="mt-4 text-[10px] font-mono uppercase tracking-[0.14em] text-white/38">
                human intent → deterministic policy → PayPal execution
              </p>
            </div>

            <div className="relative">
              <div className="absolute -inset-10 rounded-full bg-blue-500/15 blur-3xl" />
              <div className="relative overflow-hidden rounded-[30px] border border-white/12 bg-[#101217]/88 p-5 shadow-[0_35px_100px_rgba(0,0,0,0.45)] backdrop-blur-xl sm:p-6">
                <div className="flex items-center justify-between border-b border-white/10 pb-4">
                  <div>
                    <p className="text-[9px] font-mono font-bold uppercase tracking-[0.18em] text-blue-300">runtime boundary</p>
                    <p className="mt-1 text-lg font-bold tracking-tight">one controlled path</p>
                  </div>
                  <span className="rounded-full border border-emerald-400/20 bg-emerald-400/10 px-2.5 py-1 text-[9px] font-bold uppercase tracking-wider text-emerald-300">
                    protected
                  </span>
                </div>

                <div className="mt-5 space-y-3">
                  {[
                    ["01", "Human mandate", "defines what can be spent"],
                    ["02", "Policy engine", "checks every request"],
                    ["03", "PayPal", "executes only after approval"],
                  ].map(([n, title, body]) => (
                    <div key={n} className="rounded-2xl border border-white/10 bg-white/[0.035] p-4">
                      <div className="flex items-start gap-3">
                        <span className="text-[10px] font-mono font-bold text-white/35">{n}</span>
                        <div className="min-w-0">
                          <p className="text-sm font-bold">{title}</p>
                          <p className="mt-1 text-xs leading-5 text-white/48">{body}</p>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>

                <div className="mt-5 rounded-2xl border border-blue-400/15 bg-blue-500/[0.06] p-4">
                  <p className="text-[9px] font-mono font-bold uppercase tracking-[0.16em] text-[#1f4fe0]">core invariant</p>
                  <p className="mt-2 text-sm font-semibold leading-6 text-white/88">
                    a denied request never crosses the PayPal execution boundary.
                  </p>
                </div>
              </div>
            </div>
          </div>
        </section>

        <section className="grid gap-3 pb-2 sm:grid-cols-3">
          {points.map((point) => {
            const Icon = point.icon;
            return (
              <div key={point.title} className="rounded-2xl border border-white/10 bg-black/20 p-4 backdrop-blur-md">
                <Icon className="h-4 w-4 text-[#1f4fe0]" />
                <p className="mt-3 text-sm font-bold">{point.title}</p>
                <p className="mt-1 text-xs leading-5 text-white/48">{point.body}</p>
              </div>
            );
          })}
        </section>

        <footer className="border-t border-white/10 pt-4 text-[9px] font-mono uppercase tracking-[0.14em] text-white/30">
          allopal · spending authorization layer for paypal agentic commerce
        </footer>
      </div>
    </main>
  );
}

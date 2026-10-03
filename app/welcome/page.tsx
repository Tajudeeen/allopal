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
    <main className="launch-surface relative min-h-screen overflow-hidden text-[#17181b]">
      <div className="launch-surface__image absolute inset-0" />
      <div className="launch-surface__wash absolute inset-0" />
      <div className="launch-surface__grid absolute inset-0" />

      <div className="relative z-10 mx-auto flex min-h-screen w-full max-w-6xl flex-col px-5 py-7 sm:px-8 sm:py-10">
        <header className="flex items-center justify-between">
          <Link href="/" className="group flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center overflow-hidden rounded-xl border border-black/10 bg-white/60 shadow-sm backdrop-blur-xl transition-transform group-hover:scale-[1.04]">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src="/logo.png" alt="Allopal" className="h-full w-full object-contain p-1" />
            </div>
            <span className="text-sm font-bold tracking-tight text-[#17181b]">Allopal<span className="text-[#4e79ff]">.</span></span>
          </Link>

          <span className="rounded-full border border-black/10 bg-white/55 px-3 py-1.5 text-[9px] font-mono font-semibold uppercase tracking-[0.18em] text-[#5f626a] shadow-sm backdrop-blur-xl">
            PayPal Runtime Gate
          </span>
        </header>

        <section className="flex flex-1 items-center py-16">
          <div className="grid w-full gap-12 lg:grid-cols-[1.05fr_.95fr] lg:items-center">
            <div className="max-w-2xl">
              <p className="text-[10px] font-mono font-bold uppercase tracking-[0.22em] text-[#1f4fe0]">
                welcome to allopal
              </p>

              <h1 className="mt-5 text-5xl font-semibold leading-[0.98] tracking-[-0.06em] text-[#17181b] sm:text-6xl lg:text-7xl">
                let the agent shop.
                <span className="mt-2 block font-serif italic font-normal text-[#1f4fe0]">
                  keep the money under rules.
                </span>
              </h1>

              <p className="mt-6 max-w-xl text-base leading-7 text-[#3f4147]/80 sm:text-lg">
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
                  className="inline-flex min-h-[46px] items-center rounded-[14px] border border-black/10 bg-white/55 px-4 text-xs font-semibold text-[#3f4147] shadow-sm backdrop-blur-xl transition hover:bg-white/80 hover:text-[#17181b]"
                >
                  Inspect the policy
                </Link>
              </div>

              <p className="mt-4 text-[10px] font-mono uppercase tracking-[0.14em] text-[#5f626a]/75">
                human intent → deterministic policy → PayPal execution
              </p>
            </div>

            <div className="relative">
              <div className="absolute -inset-10 rounded-full bg-[#1f4fe0]/10 blur-3xl" />
              <div className="relative overflow-hidden rounded-[30px] selo-shell border border-black/10 bg-white/72 p-5 shadow-[0_35px_100px_rgba(27,28,31,0.14)] backdrop-blur-xl sm:p-6">
                <div className="flex items-center justify-between border-b border-black/10 pb-4">
                  <div>
                    <p className="text-[9px] font-mono font-bold uppercase tracking-[0.18em] text-blue-300">runtime boundary</p>
                    <p className="mt-1 text-lg font-bold tracking-tight">one controlled path</p>
                  </div>
                  <span className="rounded-full border border-emerald-600/15 bg-emerald-500/10 px-2.5 py-1 text-[9px] font-bold uppercase tracking-wider text-emerald-700">
                    protected
                  </span>
                </div>

                <div className="mt-5 space-y-3">
                  {[
                    ["01", "Human mandate", "defines what can be spent"],
                    ["02", "Policy engine", "checks every request"],
                    ["03", "PayPal", "executes only after approval"],
                  ].map(([n, title, body]) => (
                    <div key={n} className="rounded-2xl border border-black/10 bg-black/[0.025] p-4">
                      <div className="flex items-start gap-3">
                        <span className="text-[10px] font-mono font-bold text-[#5f626a]/70">{n}</span>
                        <div className="min-w-0">
                          <p className="text-sm font-bold">{title}</p>
                          <p className="mt-1 text-xs leading-5 text-[#5f626a]/80">{body}</p>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>

                <div className="mt-5 rounded-2xl border border-blue-600/15 bg-blue-500/[0.055] p-4">
                  <p className="text-[9px] font-mono font-bold uppercase tracking-[0.16em] text-[#1f4fe0]">core invariant</p>
                  <p className="mt-2 text-sm font-semibold leading-6 text-[#17181b]">
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
              <div key={point.title} className="rounded-2xl border border-black/10 bg-white/48 p-4 shadow-sm backdrop-blur-md">
                <Icon className="h-4 w-4 text-[#1f4fe0]" />
                <p className="mt-3 text-sm font-bold">{point.title}</p>
                <p className="mt-1 text-xs leading-5 text-white/48">{point.body}</p>
              </div>
            );
          })}
        </section>

        <footer className="border-t border-black/10 pt-4 text-[9px] font-mono uppercase tracking-[0.14em] text-[#5f626a]/65">
          allopal · spending authorization layer for paypal agentic commerce
        </footer>
      </div>
    </main>
  );
}

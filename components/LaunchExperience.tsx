"use client";

import React, { ReactNode, useEffect, useState } from "react";
import { ArrowRight, Bot, LockKeyhole, ShieldCheck } from "lucide-react";

interface LaunchExperienceProps {
  children: ReactNode;
}

const walkthrough = [
  {
    step: "01",
    icon: LockKeyhole,
    eyebrow: "human-owned boundary",
    title: "you set the spending rule.",
    body: "Choose the amount, merchants, categories, and validity. The agent can only operate inside the mandate you lock.",
  },
  {
    step: "02",
    icon: ShieldCheck,
    eyebrow: "deterministic authorization",
    title: "the rules decide first.",
    body: "Every cart is checked server-side before PayPal is touched. A failed check records a denial and stops the payment path.",
  },
  {
    step: "03",
    icon: Bot,
    eyebrow: "controlled execution",
    title: "the agent can act safely.",
    body: "When a request passes, Allopal reserves the budget and moves into the PayPal approval flow. AI can propose and explain, but never authorize money.",
  },
] as const;

export function LaunchExperience({ children }: LaunchExperienceProps) {
  const [showSplash, setShowSplash] = useState(true);
  const [showWalkthrough, setShowWalkthrough] = useState(false);
  const [walkthroughStep, setWalkthroughStep] = useState(0);

  useEffect(() => {
    const introSeen = window.localStorage.getItem("allopal-intro-seen") === "true";

    const timer = window.setTimeout(() => {
      setShowSplash(false);

      if (!introSeen) {
        setShowWalkthrough(true);
      }
    }, 1250);

    return () => window.clearTimeout(timer);
  }, []);

  const finishWalkthrough = () => {
    window.localStorage.setItem("allopal-intro-seen", "true");
    setShowWalkthrough(false);
    setWalkthroughStep(0);
  };

  const handleNext = () => {
    if (walkthroughStep === walkthrough.length - 1) {
      finishWalkthrough();
      return;
    }

    setWalkthroughStep((step) => step + 1);
  };

  const current = walkthrough[walkthroughStep];
  const Icon = current.icon;

  return (
    <>
      <div className="relative z-10">
        {children}
      </div>

      {showSplash && (
        <div className="launch-surface fixed inset-0 z-[100] flex min-h-screen items-center justify-center overflow-hidden text-[#17181b]">
          <div className="launch-surface__image absolute inset-0" />

          <div className="launch-content relative z-10 flex flex-col items-center px-6 text-center">
            <div className="flex h-20 w-20 items-center justify-center overflow-hidden rounded-[24px] launch-logo-card launch-card border border-white/10 bg-[linear-gradient(145deg,#181a1e,#0d0f12)] shadow-[0_24px_70px_rgba(0,0,0,0.28)] backdrop-blur-xl sm:h-24 sm:w-24">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src="/logo.png" alt="Allopal" className="h-full w-full object-contain p-2.5" />
            </div>

            <div className="mt-7 flex items-center gap-2 text-[10px] font-mono font-semibold uppercase tracking-[0.24em] text-[#1f4fe0]">
              <ShieldCheck className="h-3.5 w-3.5" />
              PayPal Runtime Gate
            </div>

            <h1 className="mt-4 text-4xl font-semibold tracking-[-0.05em] text-[#17181b] sm:text-5xl">
              Allopal<span className="text-[#4e79ff]">.</span>
            </h1>

            <p className="mt-3 text-xs text-[#3f4147]/70 sm:text-sm">
              Spending authorization for AI-agent commerce
            </p>

            <div className="mt-8 h-1 w-32 overflow-hidden rounded-full bg-black/10">
              <div className="h-full w-1/2 rounded-full bg-[#1f4fe0] animate-[launch-progress_1.1s_ease-in-out_infinite]" />
            </div>
          </div>
        </div>
      )}

      {showWalkthrough && (
        <div className="launch-walkthrough fixed inset-0 z-[110] flex items-center justify-center overflow-y-auto px-4 py-6 sm:px-6">
          <button
            type="button"
            aria-label="Skip Allopal walkthrough"
            onClick={finishWalkthrough}
            className="absolute inset-0 cursor-default bg-black/35 backdrop-blur-[6px]"
          />

          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="allopal-walkthrough-title"
            className="launch-walkthrough__modal selo-shell relative z-10 w-full max-w-2xl rounded-[30px] border border-white/10 p-5 text-white shadow-[0_36px_120px_rgba(0,0,0,0.42)] sm:p-7"
          >
            <div className="flex items-center justify-between gap-4">
              <div>
                <p className="text-[9px] font-mono font-bold uppercase tracking-[0.2em] text-[#7f9cff]">first run</p>
                <p className="mt-1 text-xs text-white/55">a 30-second walkthrough of the payment boundary</p>
              </div>

              <button
                type="button"
                onClick={finishWalkthrough}
                className="selo-button selo-button-secondary !min-h-[34px] !rounded-[10px] !px-3 !text-[10px]"
              >
                Skip
              </button>
            </div>

            <div className="mt-7 grid gap-6 sm:grid-cols-[0.32fr_0.68fr] sm:items-center">
              <div className="launch-walkthrough__rail rounded-[24px] border border-white/10 p-4 sm:p-5">
                <div className="flex items-center justify-between">
                  <span className="text-[9px] font-mono font-bold uppercase tracking-[0.18em] text-white/45">walkthrough</span>
                  <span className="text-[10px] font-mono font-bold text-white/45">{current.step} / 03</span>
                </div>

                <div className="mt-5 space-y-2">
                  {walkthrough.map((item, index) => {
                    const StepIcon = item.icon;
                    const active = index === walkthroughStep;
                    const complete = index < walkthroughStep;

                    return (
                      <button
                        key={item.step}
                        type="button"
                        onClick={() => setWalkthroughStep(index)}
                        className={"flex w-full items-center gap-3 rounded-2xl border p-3 text-left transition " +
                          (active
                            ? "border-white/18 bg-white/[0.08]"
                            : "border-transparent bg-transparent hover:border-white/10 hover:bg-white/[0.04]")}
                      >
                        <span
                          className={"flex h-8 w-8 shrink-0 items-center justify-center rounded-xl border " +
                            (active || complete
                              ? "border-blue-300/20 bg-blue-400/10 text-blue-200"
                              : "border-white/10 bg-white/[0.03] text-white/35")}
                        >
                          <StepIcon className="h-3.5 w-3.5" />
                        </span>
                        <span className="min-w-0">
                          <span className="block text-[10px] font-mono font-bold uppercase tracking-[0.12em] text-white/40">step {item.step}</span>
                          <span
                            className={"mt-0.5 block truncate text-xs font-semibold " +
                              (active ? "text-white" : "text-white/55")}
                          >
                            {item.title.replace(".", "")}
                          </span>
                        </span>
                      </button>
                    );
                  })}
                </div>
              </div>

              <div className="min-w-0">
                <div className="flex h-14 w-14 items-center justify-center rounded-2xl border border-blue-300/15 bg-blue-400/10 text-blue-200 shadow-[0_16px_40px_rgba(31,79,224,0.12)]">
                  <Icon className="h-6 w-6" />
                </div>

                <p className="mt-5 text-[10px] font-mono font-bold uppercase tracking-[0.18em] text-[#7f9cff]">{current.eyebrow}</p>

                <h2 id="allopal-walkthrough-title" className="mt-3 text-3xl font-semibold leading-[1.02] tracking-[-0.05em] text-white sm:text-4xl">
                  {current.title}
                </h2>

                <p className="mt-4 max-w-lg text-sm leading-6 text-slate-300/75 sm:text-[15px]">{current.body}</p>

                <div className="mt-7 flex items-center justify-between gap-4">
                  <div className="flex items-center gap-1.5" aria-label={"Step " + (walkthroughStep + 1) + " of " + walkthrough.length}>
                    {walkthrough.map((item, index) => (
                      <button
                        key={item.step}
                        type="button"
                        aria-label={"Go to step " + (index + 1)}
                        onClick={() => setWalkthroughStep(index)}
                        className={"h-1.5 rounded-full transition-all " +
                          (index === walkthroughStep ? "w-7 bg-white" : "w-1.5 bg-white/20 hover:bg-white/40")}
                      />
                    ))}
                  </div>

                  <button
                    type="button"
                    onClick={handleNext}
                    className="selo-button selo-button-primary !min-h-[42px] !rounded-[12px] !bg-white !px-4 !text-[#101114]"
                  >
                    {walkthroughStep === walkthrough.length - 1 ? "Enter Allopal" : "Next"}
                    <ArrowRight className="h-4 w-4" />
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

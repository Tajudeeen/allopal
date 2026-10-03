"use client";

import React, { ReactNode, useEffect, useState } from "react";
import { ShieldCheck } from "lucide-react";
import { usePathname, useRouter } from "next/navigation";

interface LaunchExperienceProps {
  children: ReactNode;
}

export function LaunchExperience({ children }: LaunchExperienceProps) {
  const pathname = usePathname();
  const router = useRouter();
  const [showSplash, setShowSplash] = useState(true);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      setShowSplash(false);

      const introSeen = window.localStorage.getItem("allopal-intro-seen") === "true";
      if (!introSeen && pathname !== "/welcome") {
        router.replace("/welcome");
      }
    }, 1250);

    return () => window.clearTimeout(timer);
  }, [pathname, router]);

  return (
    <>
      {children}

      {showSplash && (
        <div className="launch-surface fixed inset-0 z-[100] flex min-h-screen items-center justify-center overflow-hidden text-[#17181b]">
          <div className="launch-surface__image absolute inset-0" />
          <div className="launch-surface__wash absolute inset-0" />
          <div className="launch-surface__grid absolute inset-0" />

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
    </>
  );
}

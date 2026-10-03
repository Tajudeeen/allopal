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
        <div className="fixed inset-0 z-[100] flex min-h-screen items-center justify-center overflow-hidden bg-[#06070a] text-white">
          <div className="absolute inset-0 bg-[url('/bg.jpg')] bg-cover bg-center opacity-30" />
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_42%,rgba(31,79,224,0.35),transparent_32%),linear-gradient(180deg,rgba(4,5,8,0.42),rgba(4,5,8,0.9))]" />

          <div className="relative z-10 flex flex-col items-center px-6 text-center">
            <div className="flex h-20 w-20 items-center justify-center overflow-hidden rounded-[24px] border border-white/15 bg-white/10 shadow-[0_20px_70px_rgba(0,0,0,0.4)] backdrop-blur-xl sm:h-24 sm:w-24">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src="/logo.png" alt="Allopal" className="h-full w-full object-contain p-2.5" />
            </div>

            <div className="mt-7 flex items-center gap-2 text-[10px] font-mono font-semibold uppercase tracking-[0.24em] text-blue-200">
              <ShieldCheck className="h-3.5 w-3.5" />
              PayPal Runtime Gate
            </div>

            <h1 className="mt-4 text-4xl font-semibold tracking-[-0.05em] sm:text-5xl">
              Allopal<span className="text-[#4e79ff]">.</span>
            </h1>

            <p className="mt-3 text-xs text-white/55 sm:text-sm">
              Spending authorization for AI-agent commerce
            </p>

            <div className="mt-8 h-1 w-32 overflow-hidden rounded-full bg-white/10">
              <div className="h-full w-1/2 rounded-full bg-[#4e79ff] animate-[launch-progress_1.1s_ease-in-out_infinite]" />
            </div>
          </div>
        </div>
      )}
    </>
  );
}

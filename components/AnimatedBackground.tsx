"use client";
import React from "react";

export function AnimatedBackground() {
  return (
    <div className="fixed inset-0 pointer-events-none z-[-1] overflow-hidden opacity-30 mix-blend-screen">
      <div className="absolute inset-0 flex items-center justify-center fx-shield">
        <svg className="w-[800px] h-[800px]" viewBox="0 0 100 100" preserveAspectRatio="xMidYMid meet">
          <circle className="ring" cx="50" cy="50" r="40" />
          <circle className="ring" cx="50" cy="50" r="40" />
          <circle className="ring" cx="50" cy="50" r="40" />
        </svg>
      </div>
      <div className="absolute inset-0 flex items-center justify-center fx-orbit">
        <svg className="w-[1000px] h-[1000px] o" viewBox="0 0 100 100" preserveAspectRatio="xMidYMid meet">
          <circle cx="50" cy="50" r="45" fill="none" stroke="rgba(255,255,255,0.05)" strokeWidth="0.5" strokeDasharray="2, 4" />
          <circle cx="8" cy="22" r="1.5" fill="#fff" className="shadow-[0_0_8px_#fff]" />
          <circle cx="92" cy="78" r="1" fill="#4ade80" className="shadow-[0_0_8px_#4ade80]" />
        </svg>
        <svg className="absolute w-[1200px] h-[1200px] o b" viewBox="0 0 100 100" preserveAspectRatio="xMidYMid meet">
          <circle cx="50" cy="50" r="45" fill="none" stroke="rgba(255,255,255,0.03)" strokeWidth="0.5" />
          <circle cx="5" cy="50" r="1.2" fill="#60a5fa" className="shadow-[0_0_8px_#60a5fa]" />
        </svg>
      </div>
    </div>
  );
}

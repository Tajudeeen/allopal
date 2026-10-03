"use client";
import React from "react";

export function AnimatedBackground() {
  return (
    <div
      aria-hidden="true"
      className="fixed inset-0 pointer-events-none z-0 overflow-hidden opacity-[0.18] mix-blend-screen"
    >
      <div className="fx-ambient__orb fx-ambient__orb-a absolute left-[12%] top-[18%] h-48 w-48 rounded-full blur-3xl" />
      <div className="fx-ambient__orb fx-ambient__orb-b absolute right-[8%] top-[42%] h-64 w-64 rounded-full blur-3xl" />
      <div className="fx-ambient__orb fx-ambient__orb-c absolute bottom-[8%] left-[34%] h-56 w-56 rounded-full blur-3xl" />

      <div className="absolute inset-0 flex items-center justify-center fx-shield">
        <svg
          className="h-[760px] w-[760px] max-w-[88vw] max-h-[88vw]"
          viewBox="0 0 100 100"
          preserveAspectRatio="xMidYMid meet"
        >
          <circle className="ring" cx="50" cy="50" r="40" />
          <circle className="ring" cx="50" cy="50" r="40" />
          <circle className="ring" cx="50" cy="50" r="40" />
        </svg>
      </div>

      <div className="absolute inset-0 flex items-center justify-center fx-orbit">
        <svg
          className="h-[980px] w-[980px] max-w-[116vw] max-h-[116vw] o"
          viewBox="0 0 100 100"
          preserveAspectRatio="xMidYMid meet"
        >
          <circle
            cx="50"
            cy="50"
            r="45"
            fill="none"
            stroke="rgba(255,255,255,0.07)"
            strokeWidth="0.45"
            strokeDasharray="2, 4"
          />
          <circle cx="8" cy="22" r="1.35" fill="#fff" />
          <circle cx="92" cy="78" r="1" fill="#7f9cff" />
        </svg>

        <svg
          className="absolute h-[1180px] w-[1180px] max-w-[138vw] max-h-[138vw] o b"
          viewBox="0 0 100 100"
          preserveAspectRatio="xMidYMid meet"
        >
          <circle
            cx="50"
            cy="50"
            r="45"
            fill="none"
            stroke="rgba(255,255,255,0.045)"
            strokeWidth="0.45"
          />
          <circle cx="5" cy="50" r="1.15" fill="#60a5fa" />
        </svg>
      </div>
    </div>
  );
}

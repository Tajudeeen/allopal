import React, { ReactNode } from "react";
import { Navbar } from "@/components/Navbar";
import { Footer } from "@/components/Footer";

interface ProductShellProps {
  children: ReactNode;
  className?: string;
}

export function ProductShell({ children, className = "" }: ProductShellProps) {
  return (
    <div className={`selo-page relative min-h-screen overflow-x-hidden text-slate-950 ${className}`}>
      <Navbar />
      <main className="relative z-10 mx-auto w-full max-w-7xl px-4 pb-20 pt-28 sm:px-6 lg:px-8">
        {children}
      </main>
      <Footer />
    </div>
  );
}

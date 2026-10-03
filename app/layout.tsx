import type { Metadata } from "next";
import "./globals.css";
import { AnimatedBackground } from "@/components/AnimatedBackground";
import { LaunchExperience } from "@/components/LaunchExperience";

export const metadata: Metadata = {
  title: "Allopal | Spending Authorization Layer for PayPal Agentic Commerce",
  description: "Deterministic spending authorization policy gate for AI agent PayPal commerce.",
  icons: {
    icon: "/logo.png",
    shortcut: "/favicon.ico",
    apple: "/logo.png",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className="antialiased font-sans">
        <AnimatedBackground />
        <LaunchExperience>{children}</LaunchExperience>
      </body>
    </html>
  );
}

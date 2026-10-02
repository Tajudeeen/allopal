import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Allopal | Spending Authorization Layer for PayPal Agentic Commerce",
  description: "Deterministic spending authorization policy gate for AI agent PayPal commerce.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className="antialiased font-sans">{children}</body>
    </html>
  );
}

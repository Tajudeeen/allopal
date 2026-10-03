"use client";

import React, { useState } from "react";
import { Bot, ShoppingCart, Zap, ArrowRight } from "lucide-react";

interface Product {
  id: string;
  name: string;
  price: number;
  merchant: string;
  category: string;
}

interface CartItem {
  id: string;
  productId: string;
  quantity: number;
  price: number;
  product: Product;
}

interface Cart {
  id: string;
  merchant: string;
  totalAmount: number;
  items: CartItem[];
}

interface AgentConsoleProps {
  carts: Cart[];
  mandateId: string | null;
  onAuthorize: (cartId: string) => Promise<void>;
  onExecutePayment: (cartId: string) => Promise<void>;
  loading: boolean;
  isDark?: boolean;
}

export function AgentConsole({
  carts,
  mandateId,
  onAuthorize,
  onExecutePayment,
  loading,
  isDark = true,
}: AgentConsoleProps) {
  const [selectedCartId, setSelectedCartId] = useState<string>(
    carts[0]?.id || "cart-case-a"
  );

  const selectedCart = carts.find((c) => c.id === selectedCartId) || carts[0];

  // Map carts to canonical demo test cases
  const caseMap: Record<string, { label: string; badge: string; desc: string }> = {
    "cart-case-a": {
      label: "Case A: Notebook Bundle",
      badge: "$18.00 (Pass)",
      desc: "Campus Books • School Supplies • Within Budget",
    },
    "cart-case-b": {
      label: "Case B: Gaming Headset",
      badge: "$90.00 (Blocked)",
      desc: "Campus Books • Electronics (Disallowed Category)",
    },
    "cart-case-c": {
      label: "Case C: Deluxe Notebook",
      badge: "$25.00 (Blocked after Case A)",
      desc: "Campus Books • School Supplies • Exceeds Remaining",
    },
    "cart-case-d": {
      label: "Case D: Pocket Notebook",
      badge: "$8.00 (Blocked if Revoked)",
      desc: "Campus Books • School Supplies • Revocation Test",
    },
  };

  return (
    <div
      className={`selo-card selo-dark-card rounded-[26px] p-6 border shadow-2xl transition-all backdrop-blur-2xl ${
        isDark
          ? "bg-slate-900/85 border-slate-700/80 text-white shadow-black/50"
          : "bg-white/95 border-slate-200/90 text-slate-900 shadow-xl"
      }`}
    >
      {/* Header */}
      <div className="flex items-center space-x-3 mb-5">
        <div
          className={`w-10 h-10 rounded-xl flex items-center justify-center shadow-sm flex-none border ${
            isDark
              ? "bg-purple-950/80 border-purple-800 text-purple-300"
              : "bg-purple-100 border-purple-200 text-purple-700"
          }`}
        >
          <Bot className="w-5 h-5" />
        </div>
        <div>
          <h2
            className={`text-lg font-bold tracking-tight ${
              isDark ? "text-white" : "text-slate-900"
            }`}
          >
            AI Agent Payment Console
          </h2>
          <p
            className={`text-xs ${
              isDark ? "text-slate-400" : "text-slate-500"
            }`}
          >
            Autonomous agent proposes a purchase; authorization engine enforces locked mandate
          </p>
        </div>
      </div>

      {/* Primary Scenario Selectors */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 mb-5">
        {carts.map((cart) => {
          const meta = caseMap[cart.id] || {
            label: cart.id,
            badge: `$${(cart.totalAmount / 100).toFixed(2)}`,
            desc: `${cart.merchant} • ${cart.items[0]?.product?.category || ""}`,
          };
          const isSelected = selectedCart?.id === cart.id;

          return (
            <button
              key={cart.id}
              onClick={() => setSelectedCartId(cart.id)}
              className={`p-3 rounded-[18px] text-left border transition-all ${
                isSelected
                  ? isDark
                    ? "bg-blue-950/80 border-blue-500 ring-2 ring-blue-500/30 shadow-md shadow-blue-500/10"
                    : "bg-blue-50/90 border-[#003087] ring-2 ring-[#003087]/20 shadow-md"
                  : isDark
                  ? "bg-slate-950/60 border-slate-800 hover:bg-slate-800/60"
                  : "bg-slate-50/70 border-slate-200 hover:bg-slate-100/80"
              }`}
            >
              <div className="flex justify-between items-start mb-1">
                <span
                  className={`text-xs font-bold ${
                    isSelected
                      ? isDark
                        ? "text-blue-300"
                        : "text-[#003087]"
                      : isDark
                      ? "text-white"
                      : "text-slate-900"
                  }`}
                >
                  {meta.label}
                </span>
                <span
                  className={`text-[10px] font-bold px-1.5 py-0.5 rounded border ${
                    meta.badge.includes("Pass")
                      ? isDark
                        ? "bg-emerald-950/80 text-emerald-300 border-emerald-700/60"
                        : "bg-emerald-100 text-emerald-800 border-emerald-300"
                      : isDark
                      ? "bg-rose-950/80 text-rose-300 border-rose-700/60"
                      : "bg-rose-100 text-rose-800 border-rose-300"
                  }`}
                >
                  {meta.badge}
                </span>
              </div>
              <p
                className={`text-[11px] line-clamp-1 ${
                  isDark ? "text-slate-400" : "text-slate-500"
                }`}
              >
                {meta.desc}
              </p>
            </button>
          );
        })}
      </div>

      {/* Selected Cart Inspector */}
      {selectedCart && (
        <div
          className={`p-4 rounded-[20px] border mb-5 bg-white/[0.015] ${
            isDark
              ? "bg-slate-950/60 border-slate-800/80"
              : "bg-slate-50 border-slate-200/80"
          }`}
        >
          <div
            className={`flex items-center justify-between mb-3 pb-2 border-b ${
              isDark ? "border-slate-800" : "border-slate-200/80"
            }`}
          >
            <div className="flex items-center space-x-2">
              <ShoppingCart
                className={`w-4 h-4 ${
                  isDark ? "text-slate-400" : "text-slate-600"
                }`}
              />
              <span
                className={`text-xs font-bold ${
                  isDark ? "text-white" : "text-slate-800"
                }`}
              >
                Cart Items ({selectedCart.items.length})
              </span>
            </div>
            <span
              className={`text-xs font-mono font-bold ${
                isDark ? "text-blue-300" : "text-slate-900"
              }`}
            >
              Total: ${(selectedCart.totalAmount / 100).toFixed(2)} USD
            </span>
          </div>

          <div className="space-y-2">
            {selectedCart.items.map((item) => (
              <div
                key={item.id}
                className="flex items-center justify-between text-xs py-1"
              >
                <div>
                  <span
                    className={`font-semibold ${
                      isDark ? "text-white" : "text-slate-800"
                    }`}
                  >
                    {item.product.name}
                  </span>
                  <div
                    className={`text-[11px] ${
                      isDark ? "text-slate-400" : "text-slate-500"
                    }`}
                  >
                    Merchant: {item.product.merchant} • Category: {item.product.category}
                  </div>
                </div>
                <div
                  className={`font-mono font-semibold ${
                    isDark ? "text-slate-200" : "text-slate-900"
                  }`}
                >
                  ${(item.price / 100).toFixed(2)}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Execution Buttons */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <button
          onClick={() => selectedCart && onAuthorize(selectedCart.id)}
          disabled={loading || !mandateId}
          className={`selo-button selo-button-secondary w-full disabled:opacity-50 ${
            isDark
              ? "bg-slate-800 hover:bg-slate-700 border-slate-700 text-white"
              : "bg-white hover:bg-slate-50 border-slate-300 text-slate-800"
          }`}
        >
          <Zap className="w-4 h-4 text-amber-400" />
          <span>Dry-Run Policy Gate</span>
        </button>

        <button
          onClick={() => selectedCart && onExecutePayment(selectedCart.id)}
          disabled={loading || !mandateId}
          className="selo-button selo-button-paypal w-full disabled:opacity-50"
        >
          <span>Execute PayPal Payment</span>
          <ArrowRight className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
}

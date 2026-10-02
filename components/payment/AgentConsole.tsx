"use client";

import React, { useState } from "react";
import { Bot, ShoppingCart, Zap, CheckCircle2, XCircle, ArrowRight, ShieldAlert } from "lucide-react";

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
}

export function AgentConsole({
  carts,
  mandateId,
  onAuthorize,
  onExecutePayment,
  loading,
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
    <div className="bg-white/95 backdrop-blur-md rounded-2xl p-6 border border-slate-200/80 shadow-xl transition-all">
      {/* Header */}
      <div className="flex items-center space-x-3 mb-5">
        <div className="w-10 h-10 rounded-xl bg-purple-100 border border-purple-200 text-purple-700 flex items-center justify-center shadow-sm">
          <Bot className="w-5 h-5" />
        </div>
        <div>
          <h2 className="text-lg font-black text-slate-900 tracking-tight">AI Agent Payment Console</h2>
          <p className="text-xs text-slate-500">
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
              className={`p-3 rounded-xl text-left border transition-all ${
                isSelected
                  ? "bg-blue-50/80 border-paypal-blue ring-2 ring-paypal-blue/20 shadow-md"
                  : "bg-slate-50/60 border-slate-200 hover:bg-slate-100/70"
              }`}
            >
              <div className="flex justify-between items-start mb-1">
                <span className="text-xs font-bold text-slate-900">{meta.label}</span>
                <span
                  className={`text-[10px] font-bold px-1.5 py-0.5 rounded ${
                    meta.badge.includes("Pass")
                      ? "bg-emerald-100 text-emerald-800"
                      : "bg-rose-100 text-rose-800"
                  }`}
                >
                  {meta.badge}
                </span>
              </div>
              <p className="text-[11px] text-slate-500 line-clamp-1">{meta.desc}</p>
            </button>
          );
        })}
      </div>

      {/* Selected Cart Inspector */}
      {selectedCart && (
        <div className="p-4 rounded-xl bg-slate-50 border border-slate-200/80 mb-5">
          <div className="flex items-center justify-between mb-3 pb-2 border-b border-slate-200/80">
            <div className="flex items-center space-x-2">
              <ShoppingCart className="w-4 h-4 text-slate-600" />
              <span className="text-xs font-bold text-slate-800">
                Cart Items ({selectedCart.items.length})
              </span>
            </div>
            <span className="text-xs font-mono font-bold text-slate-900">
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
                  <span className="font-semibold text-slate-800">{item.product.name}</span>
                  <div className="text-[11px] text-slate-500">
                    Merchant: {item.product.merchant} • Category: {item.product.category}
                  </div>
                </div>
                <div className="font-mono font-semibold text-slate-900">
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
          className="flex items-center justify-center space-x-2 px-4 py-2.5 rounded-xl bg-white hover:bg-slate-50 border border-slate-300 text-slate-800 text-xs font-bold shadow-sm transition-all hover:scale-[1.02] active:scale-[0.98] disabled:opacity-50"
        >
          <Zap className="w-4 h-4 text-amber-500" />
          <span>Dry-Run Policy Gate</span>
        </button>

        <button
          onClick={() => selectedCart && onExecutePayment(selectedCart.id)}
          disabled={loading || !mandateId}
          className="flex items-center justify-center space-x-2 px-4 py-2.5 rounded-xl bg-gradient-to-r from-[#003087] via-[#0070BA] to-[#003087] hover:from-[#002766] hover:to-[#005ea6] text-white text-xs font-extrabold shadow-lg shadow-blue-500/20 transition-all hover:scale-[1.02] active:scale-[0.98] disabled:opacity-50"
        >
          <span>Execute PayPal Payment</span>
          <ArrowRight className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
}

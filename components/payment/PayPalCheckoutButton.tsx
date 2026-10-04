"use client";

import { useEffect, useRef, useState } from "react";
import { LoaderCircle, ShieldCheck } from "lucide-react";

interface PayPalCheckoutButtonProps {
  orderId: string;
  amount: number;
}

interface PayPalSdkInstance {
  findEligibleMethods(options?: {
    currencyCode?: string;
    amount?: string;
  }): Promise<{
    isEligible(method: string): boolean;
  }>;
  createPayPalOneTimePaymentSession(options: {
    onApprove(data: { orderId: string }): Promise<void>;
    onCancel(): void;
    onError(error: { code?: string; message?: string }): void;
  }): {
    start(
      options: { presentationMode: "auto" | "popup" | "redirect" },
      order: Promise<{ orderId: string }>
    ): Promise<void>;
  };
}

interface PayPalSdkNamespace {
  createInstance(options: {
    clientId: string;
    components: string[];
    pageType?: string;
    locale?: string;
    clientMetadataId?: string;
  }): Promise<PayPalSdkInstance>;
}

declare global {
  interface Window {
    paypal?: PayPalSdkNamespace;
  }
}

let sdkLoadPromise: Promise<PayPalSdkNamespace> | null = null;

function loadPayPalSdk(sdkUrl: string): Promise<PayPalSdkNamespace> {
  if (window.paypal) return Promise.resolve(window.paypal);
  if (sdkLoadPromise) return sdkLoadPromise;

  sdkLoadPromise = new Promise((resolve, reject) => {
    const existing = document.querySelector<HTMLScriptElement>(
      'script[data-allopal-paypal-v6="true"]'
    );

    if (existing) {
      existing.addEventListener("load", () => {
        if (window.paypal) resolve(window.paypal);
        else reject(new Error("PayPal SDK loaded without a browser API."));
      });
      existing.addEventListener("error", () =>
        reject(new Error("PayPal SDK failed to load."))
      );
      return;
    }

    const script = document.createElement("script");
    script.src = sdkUrl;
    script.async = true;
    script.dataset.allopalPaypalV6 = "true";
    script.onload = () => {
      if (window.paypal) resolve(window.paypal);
      else reject(new Error("PayPal SDK loaded without a browser API."));
    };
    script.onerror = () => reject(new Error("PayPal SDK failed to load."));
    document.head.appendChild(script);
  });

  return sdkLoadPromise;
}

export function PayPalCheckoutButton({
  orderId,
  amount,
}: PayPalCheckoutButtonProps) {
  const hostRef = useRef<HTMLDivElement>(null);
  const [status, setStatus] = useState<
    "loading" | "ready" | "unavailable" | "error"
  >("loading");
  const [message, setMessage] = useState("");

  useEffect(() => {
    let cancelled = false;
    let paypalElement: HTMLElement | null = null;

    async function setup() {
      try {
        const configResponse = await fetch("/api/paypal/config", {
          cache: "no-store",
        });

        const config = await configResponse.json();

        if (!configResponse.ok) {
          throw new Error(config.message || "PayPal is not configured.");
        }

        const paypal = await loadPayPalSdk(config.sdkUrl);
        const sdk = await paypal.createInstance({
          clientId: config.clientId,
          components: ["paypal-payments"],
          pageType: "checkout",
          locale: "en-US",
          clientMetadataId: crypto.randomUUID(),
        });

        const eligibility = await sdk.findEligibleMethods({
          currencyCode: "USD",
          amount: (amount / 100).toFixed(2),
        });

        if (cancelled) return;

        if (!eligibility.isEligible("paypal")) {
          setStatus("unavailable");
          setMessage("PayPal checkout is not eligible in this browser.");
          return;
        }

        const session = sdk.createPayPalOneTimePaymentSession({
          onApprove: async (data) => {
            window.location.assign(
              `/api/payments/paypal/return?token=${encodeURIComponent(
                data.orderId
              )}`
            );
          },
          onCancel: () => {
            window.location.assign(
              `/api/payments/paypal/cancel?token=${encodeURIComponent(orderId)}`
            );
          },
          onError: (error) => {
            setStatus("error");
            setMessage(
              error.message || error.code || "PayPal checkout encountered an error."
            );
          },
        });

        const button = document.createElement("paypal-button");
        button.setAttribute("type", "checkout");
        button.style.display = "block";
        button.style.width = "100%";

        const host = hostRef.current;
        if (!host || cancelled) return;

        host.innerHTML = "";
        host.appendChild(button);
        paypalElement = button;

        button.addEventListener("click", async () => {
          try {
            setStatus("loading");
            await session.start(
              { presentationMode: "auto" },
              Promise.resolve({ orderId })
            );
          } catch (error) {
            setStatus("error");
            setMessage(
              error instanceof Error
                ? error.message
                : "Unable to start PayPal checkout."
            );
          } finally {
            if (!cancelled) setStatus("ready");
          }
        });

        setStatus("ready");
      } catch (error) {
        if (cancelled) return;
        setStatus("error");
        setMessage(
          error instanceof Error
            ? error.message
            : "Unable to initialize PayPal checkout."
        );
      }
    }

    void setup();

    return () => {
      cancelled = true;
      paypalElement?.remove();
    };
  }, [amount, orderId]);

  return (
    <div className="rounded-2xl border border-blue-400/15 bg-blue-400/[0.045] p-4">
      <div className="mb-3 flex items-center justify-between gap-3">
        <div>
          <p className="text-[9px] font-mono font-bold uppercase tracking-wider text-blue-300/70">
            payer approval
          </p>
          <p className="mt-1 text-sm font-bold text-white">
            approve {"$"}{(amount / 100).toFixed(2)} with PayPal
          </p>
        </div>
        <ShieldCheck className="h-4 w-4 text-blue-300" />
      </div>

      <div ref={hostRef} className="min-h-[46px]" />

      {status === "loading" && (
        <div className="flex items-center gap-2 text-xs text-slate-300">
          <LoaderCircle className="h-4 w-4 animate-spin" />
          loading secure PayPal checkout...
        </div>
      )}

      {status === "unavailable" && (
        <p className="text-xs text-amber-300">{message}</p>
      )}

      {status === "error" && (
        <p className="text-xs leading-5 text-rose-300">{message}</p>
      )}

      {status === "ready" && (
        <p className="mt-2 text-[10px] leading-4 text-slate-400">
          Allopal already authorized this order. PayPal handles the buyer approval.
        </p>
      )}
    </div>
  );
}

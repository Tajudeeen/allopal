# Allopal Security Policy & Technical Audit

## Executive Security Model

Allopal enforces a deterministic authorization layer between autonomous AI agents and PayPal payment execution. The security architecture is designed under the principle of **defense-in-depth**, ensuring that even if an AI agent is compromised, manipulated via prompt injection, or behaves erratically, it can **never** exceed the locked financial boundaries established by the human account owner.

---

### Core Security Invariants

1. **Deterministic Execution Gate (Zero-Bypass Invariant)**
   * PayPal Order Creation and Capture APIs are **only** accessible from the server-side payment handler (`app/api/payments/pay/route.ts`).
   * No PayPal API call can be initiated without first passing all 8 ordered checks in the deterministic policy engine (`lib/policy/engine.ts`).
   * Every failed policy check results in zero money movement and **0 calls** to PayPal.

2. **Server-Authoritative Data Lookup**
   * The client only transmits resource identifiers (`mandateId`, `cartId`).
   * Product prices, categories, merchants, and available mandate budgets are loaded exclusively from authoritative database records on the server.
   * Any client-supplied prices, categories, merchants, or status parameters are strictly stripped and discarded via Zod schema parsers.

3. **Strict Monetary Precision (Integer Cents)**
   * All monetary limits, expenditures, product prices, and cart totals are represented as non-negative integer cents (`4000 = $40.00`).
   * Floating-point arithmetic is forbidden in the core domain to eliminate rounding drift and precision exploits.

4. **Zero AI Financial Authority**
   * AI models (Gemini) are strictly isolated to **interpretation** (drafting proposals) and **read-only explanation**.
   * AI cannot authorize money movement, activate mandates, modify locked parameters, increase limits, or bypass policy checks.
   * All proposed mandates are emitted in a `PROPOSED` state and require explicit human review and locking via `/api/mandates/lock`.

5. **Concurrency & Race Condition Hardening**
   * Parallel payment requests against the same mandate are serialized using atomic database transactions.
   * Budget reservation is validated in real time before PayPal API execution; if remaining budget is insufficient, the second request fails closed (`BUDGET_SUFFICIENT` failure).
   * Double-spend and parallel exhaustion attacks are impossible.

6. **Replay & Idempotency Protection**
   * Every payment request supports an `Idempotency-Key` header or payload attribute.
   * Duplicate requests or repeated button clicks return the cached transaction response without initiating redundant PayPal charges.

7. **Server-Side Secret Isolation**
   * `PAYPAL_CLIENT_SECRET`, `PAYPAL_CLIENT_ID`, and `AI_API_KEY` are isolated to server environments.
   * No API credentials, tokens, or database connection strings are exposed in client bundles or public endpoints.
   * Sensitive responses from PayPal are sanitized before persistence.

---

### Audit Verification Checklist

| Risk Area | Mitigation | Verification Test |
|:---|:---|:---|
| **Client Price Tampering** | Server loads authoritative products from DB | `tests/api/authorize.test.ts` |
| **Category Bypass** | Deterministic whitelist evaluation | `tests/policy/engine.test.ts` |
| **Over-Budget Exploit** | Exact cent boundary verification | `tests/payments/security_boundary.test.ts` |
| **PayPal API Bypass** | Spied 0-call proof on all denials | `tests/payments/security_boundary.test.ts` |
| **Race Conditions** | Atomic transaction budget reservation | `tests/payments/concurrency.test.ts` |
| **Replay Attacks** | Idempotency key tracking table | `tests/payments/concurrency.test.ts` |
| **Prompt Injection** | Zod schema validation on AI output | `tests/ai/proposal.test.ts` |
| **Mandate Tampering** | Human locking gate required | `tests/ai/proposal.test.ts` |

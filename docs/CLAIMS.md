# Allopal Claims Ledger

This file separates what Allopal claims from what the repository can currently demonstrate.

A claim is only marked PROVEN when there is a concrete, reproducible artifact behind it. Source code and test coverage are useful evidence, but they are not the same as a live external verification run.

## Status key

| Status | Meaning |
|:---|:---|
| **PROVEN** | Backed by a captured runtime artifact that can be independently inspected. |
| **TEST-COVERED** | Explicit automated tests exist for the behavior. A fresh test run should be captured before treating it as a current green result. |
| **CODE-VERIFIED** | The implementation/source structure directly enforces the behavior. |
| **NOT LIVE-VERIFIED** | The capability exists, but a live external artifact has not been captured. |

## Claims

| Claim | Status | Evidence |
|:---|:---|:---|
| A locked human mandate is required before spending | **CODE-VERIFIED** | app/api/payments/pay/route.ts, app/api/mandates/lock/route.ts, tests/ai/proposal.test.ts |
| AI mandate drafting cannot directly activate spending | **TEST-COVERED** | tests/ai/proposal.test.ts; proposal and lock are separate routes |
| Payment requests are evaluated by a deterministic server-side policy engine | **TEST-COVERED** | lib/policy/engine.ts, tests/policy/engine.test.ts, tests/api/authorize.test.ts |
| Client-supplied price/category data is not trusted for payment authorization | **TEST-COVERED** | app/api/payments/pay/route.ts, tests/security/security_audit.test.ts |
| A denied request does not call PayPal | **TEST-COVERED** | tests/payments/security_boundary.test.ts, tests/payments/paypal.test.ts |
| Revoked mandates remain blocked | **TEST-COVERED** | tests/policy/engine.test.ts, tests/payments/security_boundary.test.ts |
| Spending is represented as integer cents | **TEST-COVERED** | prisma/schema.prisma, tests/database_seed.test.ts |
| Concurrent payment attempts cannot overspend the remaining mandate budget | **TEST-COVERED** | tests/payments/concurrency.test.ts |
| Payment requests are protected against idempotent replay | **TEST-COVERED** | tests/payments/concurrency.test.ts, app/api/payments/pay/route.ts |
| Real PayPal mode uses payer approval before capture | **CODE-VERIFIED** | app/api/payments/paypal/return/route.ts, app/api/payments/paypal/cancel/route.ts, PayPal integration tests |
| AI decision explanations are read-only | **TEST-COVERED** | app/api/decisions/explain/route.ts, tests/ai/explainer.test.ts |
| Canonical demo cases cover pass, category denial, budget denial, and revocation denial | **TEST-COVERED** | Seed data plus tests/e2e/allopal_full_flow.test.ts |
| Splash and first-time intro are part of the product launch flow | **CODE-VERIFIED** | components/LaunchExperience.tsx, app/welcome/page.tsx |
| The visual system preserves public/bg.jpg and uses shared dark-gradient cards | **CODE-VERIFIED** | app/globals.css, launch screens, product screens |
| Allopal has been independently verified on a live public PayPal deployment | **NOT LIVE-VERIFIED** | No external runtime evidence artifact is currently stored |
| Allopal has processed real-money production payments for external users | **NOT LIVE-VERIFIED** | No external production transaction evidence is currently stored |

## How a claim becomes PROVEN

1. Run the smallest reproducible verification command.
2. Capture the relevant output or sanitized runtime artifact under docs/evidence.
3. Link that artifact in this file.
4. Record the date and environment.
5. If a later run contradicts the evidence, downgrade the claim until fresh evidence is captured.

Do not turn source inspection, a code comment, or a planned test into a PROVEN claim.

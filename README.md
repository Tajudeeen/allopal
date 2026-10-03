# Allopal

<p align="center">
  <img src="public/logo.png" width="130" alt="Allopal Logo - Transparent Standalone Monochrome Emblem" />
</p>

> **Deterministic Spending Authorization Layer for PayPal Agentic Commerce**

[![TypeScript](https://img.shields.io/badge/TypeScript-5.6-blue?logo=typescript)](https://www.typescriptlang.org/)
[![Next.js](https://img.shields.io/badge/Next.js-14.2-black?logo=next.js)](https://nextjs.org/)
[![Prisma](https://img.shields.io/badge/Prisma-5.22-teal?logo=prisma)](https://www.prisma.io/)
[![PayPal](https://img.shields.io/badge/PayPal-Sandbox%20API-003087?logo=paypal)](https://developer.paypal.com/)
[![Vitest](https://img.shields.io/badge/Tested%20with-Vitest-yellow?logo=vitest)](https://vitest.dev/)

---

##  Overview

**Allopal** is a security-first authorization gateway designed for autonomous AI agents participating in commerce.

When autonomous agents are empowered to shop or pay for goods on behalf of humans, granting them direct access to financial credentials presents an unacceptable risk. Allopal solves this by decoupling **intent** from **authorization** and **execution**:

1. **Human Intent & Mandate Locking**: A human creates and explicitly locks a spending mandate with strict boundaries (spending limits, allowed merchants, permitted categories, expiration windows).
2. **Deterministic Authorization**: The payment request is strictly evaluated by an authoritative, deterministic policy engine on the server. AI models are **never** permitted to independently authorize money movement.
3. **PayPal Execution**: PayPal order creation and capture are only invoked if and only if the locked mandate's policy checks evaluate to `ALLOWED`.

---

##  Core Invariant

```
MANDATE PASSES (ALLOWED)  ──▶  RESERVE BUDGET ──▶ CREATE PAYPAL ORDER ──▶ PAYER APPROVAL ──▶ CAPTURE
MANDATE FAILS  (DENIED)   ──▶  NO PAYPAL CALL ──▶ ZERO MONEY MOVEMENT
```

* **Zero-Bypass Policy**: Under no circumstances can client code or AI prompts trigger a PayPal transaction without satisfying an active, non-revoked mandate with sufficient remaining budget.
* **Denial Audit Record**: Every denial persists a structured `Decision` audit log detailing the exact check failed, with `paypalOrderId = null`.

---

##  Architecture

```
                  ┌──────────────────────────────────────────────┐
                  │            Client / AI Agent                 │
                  └──────────────────────┬───────────────────────┘
                                         │ POST /api/payments/pay
                                         │ { mandateId, cartId }
                                         ▼
                  ┌──────────────────────────────────────────────┐
                  │       Authoritative Payment Gateway          │
                  │        (Next.js Route Handler)               │
                  └──────────────────────┬───────────────────────┘
                                         │
                   Fetch authoritative   │ Server-side database lookup
                   Mandate, Cart & Items │ (Client prices/categories ignored)
                                         ▼
                  ┌──────────────────────────────────────────────┐
                  │          Deterministic Policy Engine         │
                  │           (lib/policy/engine.ts)             │
                  └──────────────┬───────────────────────────────┘
                                 │
                 ┌───────────────┴───────────────┐
                 │                               │
        [Policy Check FAILS]            [Policy Check PASSES]
                 │                               │
                 ▼                               ▼
       ┌───────────────────┐           ┌─────────────────────────┐
       │ Persist Decision  │           │      PayPal Client       │
       │ (DENIED audit log)│           │       (Orders API)       │
       └─────────┬─────────┘           └────────────┬────────────┘
                 │                                  │ 1. Create Order
                 ▼                                  │ 2. Payer Approval
          Return 403 /                              │ 3. Capture Order
          Policy Denied                             ▼
          (No PayPal call)                  ┌───────────────────┐
          Policy Denied                  │ Persist Decision  │
          (No PayPal call)               │ (COMPLETED + IDs) │
                                         │ Update Mandate    │
                                         │ Remaining Budget  │
                                         └─────────┬─────────┘
                                                   │
                                                   ▼
                                           Return 200 OK
```

### Key Architectural Boundaries

* **Untrusted Client Inputs**: The client supplies only `mandateId` and `cartId`. The server reloads authoritative prices, categories, and merchant metadata from the database to defeat client-side tampering.
* **Exact Integer Cents**: Monetary values are stored and calculated as integers in cents (e.g., `$18.00 = 1800 cents`) to prevent floating-point rounding errors.
* **Server-Side Secret Isolation**: PayPal Client ID, Secret, and AI keys are strictly kept server-side and never exposed to client bundles.

---

##  Deterministic Policy Engine

The policy engine (`lib/policy/engine.ts`) runs an ordered sequence of deterministic checks:

| Step | Check Name | Description | Failure Reason |
|:---:|:---|:---|:---|
| **1** | **Mandate Exists** | Verifies the referenced mandate exists in database | `Mandate not found` |
| **2** | **Not Revoked** | Rejects an explicitly revoked mandate before any execution | `Mandate has been revoked by the account holder` |
| **3** | **Mandate Active** | Requires `ACTIVE` status and a currently valid time window | `Mandate is expired, premature, or not ACTIVE` |
| **4** | **Cart Exists** | Requires an existing cart with at least one item | `Cart is empty or does not exist` |
| **5** | **Merchant Allowed** | Verifies the cart merchant and every product merchant are authorized | `Merchant is not permitted under this mandate` |
| **6** | **Category Allowed** | Requires every cart item category to be authorized | `Category is not permitted under this mandate` |
| **7** | **Amount Valid** | Requires a positive integer cents total and authoritative item-price reconciliation | `Invalid amount or authoritative price mismatch` |
| **8** | **Budget Remaining** | Requires the purchase to fit inside remaining mandate budget | `Purchase exceeds remaining mandate budget` |

---

##  Primary Demo Scenarios

The test suite and seed data deterministically verify the canonical primary scenarios:

* **Mandate**: `School Shopping`
* **Limit**: `$40.00` (4000 cents)
* **Allowed Category**: `School Supplies`
* **Allowed Merchants**: `Campus Books`, `Paper & Pencil`

### Scenarios Table

| Scenario | Cart Item | Cost | Category | Merchant | Mandate State | Result | PayPal Call |
|:---|:---|:---:|:---:|:---:|:---:|:---:|:---:|
| **Case A** | Notebook Bundle | `$18.00` | School Supplies | Campus Books | Active ($40 remaining) |  **PASS** | **Mock: Created & Captured / Real: Approval → Capture** |
| **Case B** | Gaming Headset | `$90.00` | Electronics | Campus Books | Active ($40 remaining) |  **DENIED** | **Zero Calls** |
| **Case C** | Heavy Notebook Bundle | `$25.00` | School Supplies | Campus Books | Active ($22 remaining) |  **DENIED** | **Zero Calls** |
| **Case D** | Supplementary Pens | `$8.00` | School Supplies | Campus Books | **Revoked** |  **DENIED** | **Zero Calls** |
| **Case E** | Natural Language Prompt | - | - | - | Proposed by AI |  **PENDING** | **Requires Explicit Human Lock** |

##  Product Screens

The application is intentionally split into separate working screens rather than forcing every capability into the landing page:

| Screen | Route | Purpose |
|:---|:---|:---|
| Overview | `/` | Live runtime summary and navigation into the product workflows |
| Mandate | `/mandate` | Full mandate details, revoke control, and AI mandate proposal + human lock |
| Agent Console | `/console` | Canonical cart scenarios, dry-run authorization, and PayPal execution |
| Policy | `/policy` | Full deterministic check inspection and PayPal boundary details |
| Ledger | `/ledger` | Decision history plus PayPal transaction lifecycle and refresh controls |

The navigation collapses into a mobile menu below the desktop breakpoint. Muted labels on light surfaces use stronger slate tones, while muted text inside black session cards remains bright enough to read.


---

##  API Reference

### 1. `POST /api/authorize`
Dry-run policy evaluation. Verifies if a mandate allows a cart purchase without charging PayPal.

* **Request Body**:
  ```json
  {
    "mandateId": "mandate-school-shopping",
    "cartId": "cart-case-a"
  }
  ```
* **Response (Allowed)**:
  ```json
  {
    "decisionId": "dec-...",
    "status": "ALLOWED",
    "amount": 1800,
    "merchant": "Campus Books",
    "category": "School Supplies",
    "remainingBudgetBefore": 4000,
    "remainingBudgetAfter": 2200,
    "paypalOrderId": null,
    "checks": { ... }
  }
  ```

---

### 2. `POST /api/payments/pay`
Authoritative payment execution route. Evaluates policy, reserves mandate budget, and executes PayPal sandbox payment. In mock/test mode it completes deterministically. With real PayPal credentials it creates an order and returns a payer approval URL; capture occurs only after the payer returns from PayPal.

* **Request Body**:
  ```json
  {
    "mandateId": "mandate-school-shopping",
    "cartId": "cart-case-a"
  }
  ```
* **Response (Payer Approval Required)**:
  ```json
  {
    "status": "PENDING_APPROVAL",
    "paypalCalled": true,
    "paypalOrderId": "ORDER-123",
    "approvalUrl": "https://www.sandbox.paypal.com/checkoutnow?token=ORDER-123",
    "paypalCaptureId": null
  }
  ```

* **Response (Completed)**:
  ```json
  {
    "success": true,
    "status": "COMPLETED",
    "decisionId": "dec-...",
    "paypalOrderId": "SANDBOX-ORDER-...",
    "paypalCaptureId": "SANDBOX-CAPTURE-...",
    "amount": 1800,
    "spentAmount": 1800,
    "remainingBudget": 2200,
    "paypalCalled": true
  }
  ```
* **Response (Denied)**:
  ```json
  {
    "error": "Payment authorization denied by mandate policy",
    "reason": "Category 'Electronics' is not allowed by this mandate",
    "status": "DENIED",
    "paypalCalled": false
  }
  ```

---

### 3. `GET /api/payments/paypal/return?token=<orderId>`
PayPal return endpoint. Re-checks that the mandate is still active before capture, captures the approved order with a PayPal idempotency key, updates the PayPal transaction ledger, and redirects back to the app with the payment outcome.

### 4. `GET /api/payments/paypal/cancel?token=<orderId>`
PayPal cancellation endpoint. Marks the pending transaction as failed and releases the reserved mandate budget before redirecting back to the app.

---

### 5. `GET /api/health`
Health check and database ping.

* **Response**:
  ```json
  {
    "status": "healthy",
    "timestamp": "2026-10-02T22:20:00.000Z",
    "database": "connected"
  }
  ```

---

##  Database Schema

Managed via Prisma (`prisma/schema.prisma`):

* **`Mandate`**: Human-configured spending rule.
  * Fields: `id`, `name`, `weeklyLimit` (cents), `spentAmount` (cents), `validFrom`, `validUntil`, `status` (`ACTIVE`, `PENDING`, `EXPIRED`, `REVOKED`), `allowedCategories` (JSON string array), `allowedMerchants` (JSON string array).
* **`Product`**: Catalog item with server-authoritative `price` (cents), `category`, and `merchant`.
* **`Cart`** & **`CartItem`**: Authoritative cart contents referenced by `cartId`.
* **`Decision`**: Immutable audit record for every payment evaluation. Stores result (`APPROVED` / `DENIED`), failed reason, policy checks breakdown, and `paypalOrderId`.
* **`PayPalTransaction`**: Detailed ledger of PayPal sandbox responses.

---

##  Getting Started

### Prerequisites

* Node.js 18.x or 20.x
* npm or pnpm

### 1. Installation

```bash
git clone https://github.com/Tajudeeen/allopal.git
cd allopal
npm install
```

### 2. Environment Configuration

Copy the example environment file:

```bash
cp .env.example .env
```

Ensure `.env` contains:
```env
DATABASE_URL="file:./prisma/dev.db"
NODE_ENV="development"
PORT=3000
PAYPAL_CLIENT_ID="mock_client_id"
PAYPAL_CLIENT_SECRET="mock_client_secret"
PAYPAL_API_BASE_URL="https://api-m.sandbox.paypal.com"
```

### 3. Database Migration & Seed

Run migrations and seed the canonical test data:

```bash
npm run prisma:generate
npm run prisma:migrate
npm run prisma:seed
```

### 4. Running the Application

```bash
npm run dev
```

Visit [http://localhost:3000](http://localhost:3000). The frontend layout is modeled after the design direction of [useselo.xyz](https://useselo.xyz/), featuring:
* **WCAG Contrast Utilities**: `lib/theme/contrast.ts` provides tested relative-luminance, contrast-ratio, background classification, and typography-token helpers. The utility is covered by automated tests, but there is no end-user theme/color-picker control in the current UI.
* **Route Navigation**: Translucent backdrop-filtered navbar with dedicated Overview, Mandate, Agent Console, Policy, and Ledger screens. On smaller breakpoints the navigation collapses into an accessible menu bar.
* **Editorial Hero & Invariant Banner**: Bold typography, italic serif accents, and high-contrast formula presentation (`MANDATE PASSES → PAYPAL CAPTURE`).
* **Desktop Console Stage**: MacOS-style application container (`allopal-runtime-v1 // paypal-sandbox // policy-gate`) framing the live Mandate and Agent Commerce simulators.
* **Responsive product UI**: Inner session cards, policy checks, ledger views, controls, and action surfaces adapt down to mobile layouts instead of simply shrinking the desktop interface.
* **Smooth interaction system**: In-page anchor scrolling, intersection-based section reveals, tactile card/button motion, and reduced-motion support.
* **Interactive Runtime Screens**: The product no longer depends on one long landing page. Each workflow has its own screen and the shared runtime state keeps mandate, policy, payment, and ledger views synchronized.

---

##  Testing & Verification

Allopal maintains a comprehensive automated test suite testing every boundary, policy rule, PayPal integration invariant, concurrency protection, theme contrast engine, and AI flow:

```bash
npm test
```

The automated suite covers policy evaluation, database invariants, PayPal boundaries, idempotency, concurrency, AI proposal/lock flow, explanation fallback, failure recovery, end-to-end flow, security checks, and WCAG contrast math.

### Test Coverage Highlights

* `tests/foundation.test.ts`: Environment validation and schema structure.
* `tests/theme/contrast.test.ts`: WCAG relative luminance math, contrast ratios, and adaptive typography token guarantees.
* `tests/database_seed.test.ts`: Exact cents representation, timestamps, and seed data integrity.
* `tests/policy/engine.test.ts`: Comprehensive policy engine tests (12 tests covering invalid merchant, disallowed category, boundary conditions, revoked mandates, zero amount).
* `tests/api/authorize.test.ts`: Server-side authorization endpoint security and client-tamper resistance.

* `tests/payments/paypal.test.ts`: Real PayPal sandbox abstraction, order creation, capture, budget decrementing, and the critical **zero-call failure boundary proof**.
* `tests/payments/security_boundary.test.ts`: Dedicated tests proving 0 PayPal API calls for disallowed categories, over-budget purchases, and revoked mandates.
* `tests/payments/concurrency.test.ts`: Prevents race conditions (e.g. two concurrent $25 purchases against a $40 limit will never charge $50) and handles idempotent request replays.
* `tests/ai/proposal.test.ts`: Verifies natural-language mandate parsing, validation bounds, and strict human approval gating.
* `tests/ai/explainer.test.ts`: Evaluates structured AI decision explanations for allowed and denied payment decisions.
* `tests/e2e/allopal_full_flow.test.ts`: End-to-end specification test executing the canonical primary demo across Cases A, B, C, and D.
* `tests/security/security_audit.test.ts`: Multi-vector security audit testing price tampering, category injection, and credential leak prevention.
* `tests/failures/failure_recovery.test.ts`: Fail-closed rollback invariants guaranteeing reserved budgets release if PayPal or network fails.

---

##  Visual Identity & Branding

* **Monochrome Standalone Emblem**: The Allopal emblem seamlessly fuses the iconic overlapping PayPal double-`P` monogram geometry with an authoritative allow verification checkmark / shield emblem. Rendered with a fully transparent background (`alpha = 0`) and with bottom logotype text removed for maximum icon clarity and versatility.
* **Dual-Surface High Contrast**: An integrated subtle crisp white outer keyline guarantees razor-sharp definition against pitch-dark canvases and GitHub dark mode, while blending seamlessly on pure white and light surfaces.
* **Multi-Resolution App Icon & Favicon**:
  * `public/logo.png` & `app/icon.png`: High-resolution (1024×1024) lossless transparent RGBA PNGs for navbar brand headers, hero identity badges, and manifest configurations.
  * `public/favicon.ico` & `app/favicon.ico`: Multi-layer transparent ICO assets bundling 16×16, 32×32, and 48×48 dimensions for browser tab clarity across light and dark OS chrome.
* **Surface Adaptability**: High-contrast dark-mode and light-mode readability across all card surfaces, visual policy gates, and audit ledgers against the preserved `bg.jpg` canvas.

---

##  Security Best Practices

1. **Client Price Tampering Defeated**: Prices sent in client payloads are strictly ignored. Product prices are looked up directly from the database using authoritative product IDs.
2. **Revocation Immutability**: Once a mandate status is set to `REVOKED`, no evaluation can pass regardless of limit or remaining balance.
3. **PayPal approval boundary**: In real PayPal mode, order creation does not imply capture. Capture requires payer approval and the return handler re-checks the mandate before money movement.
4. **Exact Boundary Compliance**: A mandate with `$22.00` remaining allows an exact `$22.00` purchase and rejects a `$22.01` purchase.
5. **Isolated Credentials**: All PayPal sandbox credentials and AI API keys remain exclusively on the server runtime.
6. **Demo-scope limitation**: The current hackathon build has no multi-user authentication/session binding. The mandate and reset endpoints should be protected by account authentication before production deployment.

---

##  Updating Documentation

> **Note for Contributors & Agents**:
> Whenever new features, routes, database models, or policy rules are implemented:
> 1. Keep the README up to date immediately.
> 2. Ensure all 4 canonical scenarios and their outcomes are documented.
> 3. Document new API parameters and responses.
> 4. Ensure `npm test`, `npm run typecheck`, and `npm run lint` pass before committing.

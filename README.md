# Allopal

[![verify](https://github.com/Tajudeeen/allopal/actions/workflows/ci.yml/badge.svg?branch=main)](https://github.com/Tajudeeen/allopal/actions/workflows/ci.yml)

<p align="center"><img src="public/logo.png" width="130" alt="Allopal logo" /></p>

Spending mandates before PayPal capture.

Allopal lets an AI agent suggest a purchase while a deterministic server policy controls spending. A person reviews and locks the mandate. The server checks the catalog, merchant, category, validity, revocation, and remaining budget before reserving funds or calling PayPal.

This is a protected, session-isolated hackathon demo. It is not a production account or financial identity system.

## What works in the code

- Natural-language mandate proposals with explicit review and lock.
- Agent selection from a server-owned catalog, with policy-only and execution modes.
- Integer-cent spending checks and atomic budget reservation.
- Durable payment attempts created before external calls.
- PayPal Orders API, payer approval, SDK v6 checkout, capture, and cancellation.
- Exclusive capture/cancel transitions and stable provider idempotency IDs.
- Recovery of uncertain results, abandoned approvals, and expired worker leases.
- Signature-verified webhooks and a background recovery worker.
- Isolated demo workspaces, server-side ownership checks, protected reset, and same-origin mutation checks.
- Ledger, verified payment notices, and sanitized evidence export.
- Session-owned spending insights through AG Studio, including mandate health, policy visualization, interactive tables, and dashboard customization.
- Read-only Groq analysis grounded in workspace-owned records, with checked evidence references and no payment tools.
- An in-app judge guide at `/judge` and release configuration preflight via `npm run release:check`.

Implementation is not the same as a live verification result. See [the evidence index](docs/evidence/README.md) and [claims ledger](docs/CLAIMS.md).

## Run locally

Use Node.js 22, npm, and a writable SQLite path. The lockfile resolves Next.js 14.2.35.

```bash
npm ci
cp .env.example .env
npm run prisma:generate
npm run db:deploy
npm run dev
```

Open http://localhost:3000. Local development can leave `ALLOPAL_DEMO_ACCESS_KEY` and `APP_BASE_URL` empty. Opening the demo creates an isolated workspace and its catalog-backed school-shopping mandate. The CLI seed is for the legacy local `demo` workspace, not a substitute for opening a browser session.

Configure these server variables for the external flows:

| Variable | Purpose |
| --- | --- |
| `DATABASE_URL` | SQLite file on durable storage |
| `APP_BASE_URL` | Public HTTPS origin, required for production payment callbacks |
| `ALLOPAL_DEMO_ACCESS_KEY` | Random access key of at least 32 characters, required in production |
| `PAYPAL_CLIENT_ID` / `PAYPAL_CLIENT_SECRET` | PayPal Sandbox application credentials |
| `PAYPAL_API_BASE_URL` | Defaults to `https://api-m.sandbox.paypal.com` |
| `PAYPAL_WEBHOOK_ID` | Registered webhook ID from the same PayPal app and environment |
| `GROQ_API_KEY` | Server-side Groq API key for drafting, cart selection, analysis, and explanations |
| `GROQ_MODEL` | Groq model ID, defaults to `openai/gpt-oss-120b` |
| `RECONCILE_TOKEN` | Optional bearer secret for the HTTP scheduler endpoint |
| `NEXT_PUBLIC_AG_STUDIO_LICENSE_KEY` | Browser-visible AG Studio sponsor/commercial license, set before build |

Generate access and scheduler keys locally with `node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"`. Never commit `.env` or provider credentials.

AG Studio 3.0.0 is commercial. Obtain a sponsor trial or commercial license from the [official sponsor page](https://paypalaihackathon.devpost.com/details/aggrid) and ensure it covers judging. Without a license, its evaluation watermark remains visible. The application source is MIT, while dependencies retain their own licenses.

Manual catalog authorization works without AI credentials. External features return configuration errors when their provider is missing. Do not use real-money credentials for a shared hackathon demo.

## Verification

```bash
npm test
npm run typecheck
npm run lint
npm run build
npm run release:check
```

`npm test` creates and migrates a disposable database, uses synthetic provider credentials, blocks unmocked fetch calls, runs Vitest, and removes the database. It does not reset your application database or require internet access after dependencies are installed. `npm run test:watch` uses the same isolated setup.

Tests cover policy denials, authoritative pricing, concurrent reservations, capture/cancel races, unknown provider outcomes, replay, session ownership, callback state, webhook authenticity, and legacy database migration. Analytics tests cover report calculations and migration behavior. Current results and browser checks are recorded under `docs/evidence`.

## Payment behavior

A passing request atomically reserves budget and saves its decision, payment attempt, and operation key before contacting PayPal. `spentAmount` includes both captured money and unresolved reservations, so the UI cannot spend a pending reservation twice.

| Internal state | Meaning |
| --- | --- |
| `CREATING` / `UNKNOWN_CREATE` | Order creation is in flight or its result is uncertain |
| `CREATED` | Order exists and awaits payer approval |
| `CAPTURING` / `UNKNOWN_CAPTURE` | Capture is in flight or its result needs reconciliation |
| `CANCELLING` | Cancellation owns the transaction while provider state is checked |
| `COMPLETED` | Capture is confirmed |
| `FAILED` / `CANCELLED` | Failure or cancellation is established and the reservation was released |
| `REVIEW_REQUIRED` | Automated recovery cannot safely decide. Keep the reservation for operator review |
| `REFUNDED` / `REVERSED` | Provider reported a later change. The demo does not automatically replenish spending authority |

Capture and cancellation claim mutually exclusive database states. Revocation blocks a capture that has not been claimed. A capture already in progress cannot be undone by revocation or a browser cancellation.

A timeout does not prove that a payment failed. Unknown results keep their reservation. Creation recovery reuses the same provider request ID and original payload within a conservative six-hour window. Unknown creation beyond that window requires review instead of a new provider order. A capture HTTP 422 is reconciled against PayPal, including already-captured responses.

Payment operations require an `Idempotency-Key`. Replays return the current transaction state. Agent retries reuse the original cart and reject the same key with a different task. The browser retains unresolved operation keys in session storage.

## Recovery and hosting

Use durable SQLite on a single host with a persistent volume. Do not deploy this SQLite configuration to an ephemeral serverless filesystem or multiple hosts with independent files.

The included `Dockerfile` and `compose.yml` define a web process and recovery worker sharing one named volume. Put an HTTPS reverse proxy in front, configure `.env`, then run:

```bash
docker compose up --build -d
```

The CI pipeline builds the image and runs a health-check smoke test against the container. Check the verification badge above for the latest result.

For a process manager on a persistent host:

```bash
npm run db:deploy
npm run build
npm start
# Separate managed process, same DATABASE_URL:
npm run worker
```

The worker checks up to ten unresolved attempts per batch every thirty seconds. A single pass is available with `npm run worker:once`. Alternatively, schedule authenticated `POST /api/internal/reconcile` requests using `Authorization: Bearer <RECONCILE_TOKEN>`. Schedule it at least every minute. Browser polling is an additional convenience, not the recovery service.

Configure PayPal webhooks at `https://your-domain/api/paypal/webhook`. Subscribe to relevant checkout-order and capture events, including approved/completed orders and completed, pending, denied, refunded, or reversed captures. The handler verifies the signature with PayPal and reads authenticated order state before changing accounting. Failed verification or unavailable reconciliation produces a retryable response. Duplicate events are safe.

### Upgrade an existing database

Stop the old web process and worker, and make a database backup first. Existing installs created with `prisma db push` have no migration history. If the database matches the original `c70fa27` schema exactly, baseline it once:

```bash
npx prisma migrate resolve --applied 202610180001_initial
npm run db:deploy
```

For a new database, run only `npm run db:deploy`. Do not baseline an unrelated schema.

The upgrade preserves existing financial records and budget. Legacy pending orders become `REVIEW_REQUIRED` because their old callbacks lack the new session/state binding. Inspect those orders in PayPal before deciding their outcome. Legacy records remain in workspace `demo`; new browser sessions do not inherit them.

## API

Browser-facing APIs require the HttpOnly demo-session cookie. Mutating browser requests must be same-origin. Pass an `Origin` header when using Postman or another HTTP client. The PayPal webhook uses provider signature verification instead of a browser session. The internal scheduler uses its separate bearer secret.

| Route | Method | Purpose |
| --- | --- | --- |
| `/api/demo/session` | GET / POST | Check or open a protected session |
| `/api/state` | GET | Current workspace, catalog, decisions, transactions |
| `/api/mandates/propose` | POST | AI draft, never activates authority |
| `/api/mandates/lock` | POST | Review/lock in the caller's workspace |
| `/api/mandates/revoke` | POST | Revoke an owned mandate |
| `/api/authorize` | POST | Policy-only evaluation, no PayPal call |
| `/api/agent/act` | POST | AI cart selection, then dry-run or guarded execution |
| `/api/payments/pay` | POST | Start/resume an idempotent payment operation |
| `/api/payments/paypal/return` | GET | Validate per-order callback state, then claim capture |
| `/api/payments/paypal/cancel` | GET | Validate per-order callback state and request cancellation |
| `/api/payments/status?order=...` | GET | Verified stored payment state for its owner |
| `/api/payments/reconcile` | POST | Refresh the caller's unresolved payments |
| `/api/paypal/webhook` | POST | Verify a provider event and reconcile |
| `/api/internal/reconcile` | POST | Bearer-protected scheduler entry point |
| `/api/decisions/explain` | POST | Read-only AI explanation |
| `/api/evidence` | GET | Download sanitized session evidence |
| `/api/analytics` | GET | Session-owned totals, capped detail records, provider availability |
| `/api/analytics/ask` | POST | Read-only Groq analysis grounded in server-selected records |
| `/api/demo/reset` | POST | Reset only the caller's workspace, blocked by unresolved payments |
| `/api/health` | GET | Database availability without internal error details |

The Postman collection in `docs/postman` includes session setup. Use the returned state to set your current mandate ID rather than assuming the old shared seed ID.

## Judge walkthrough

Open `/judge` for the in-app steps and configuration status. See [submission and sponsor evidence](docs/SUBMISSION.md) for the official requirements, tools statement draft, and recording outline. Provider configuration is not proof of a successful external run.

1. Open a demo session and review its $40 school-supplies mandate.
2. Ask the agent for the $90 gaming headset. Show the category denial and zero PayPal execution.
3. Ask for school supplies under $20. Show the selected $18 notebook bundle and policy checks.
4. Approve the real Sandbox order, return, and show its capture ID and $22 remaining budget.
5. Attempt the $25 cart and show the budget denial.
6. Revoke the mandate and attempt the $8 cart.
7. Open the ledger and export sanitized evidence.
8. Open Insights, customize the dashboard, and inspect a read-only AI answer with its cited records.

See [sandbox verification](docs/SANDBOX_VERIFICATION.md) for the remaining external checks. The repository is public. A public demo video and the final submission remain release tasks.

## Production Path

Allopal's architecture cleanly separates the authorization gateway from storage and infrastructure concerns. The deliberate demo constraints (SQLite, demo access key, in-memory rate limiting) have direct production upgrade paths:

- **PostgreSQL & Horizontal Persistence**: Replace SQLite with PostgreSQL by switching Prisma's datasource provider (`provider = "postgresql"`). In production, state transitions (`beginPayment`, `claimCapture`, `recordAttempt`) run inside SERIALIZABLE or `SELECT FOR UPDATE` database transactions behind PgBouncer or Prisma Accelerate for zero-lock contention under heavy concurrent checkout loads. Read-heavy analytics (the `/insights` engine) point to read replicas, isolating operational payments from analytical queries.
- **Per-Agent Identity & Machine Authentication**: Move from the shared demo access key to machine-to-machine identity using OAuth 2.0 Client Credentials (RFC 6749) with short-lived, cryptographically signed JWT tokens (RFC 9068) or mutual TLS (mTLS). Each autonomous agent receives a unique cryptographic principal (`agent_id`) mapped directly to its assigned mandate in the policy engine, enabling non-repudiable audit logging of every proposal and checkout attempt.
- **Distributed Rate Limiting & Multi-Instance Lock Coordination**: Replace in-memory sliding-window maps with Redis-backed rate limiting (`rate-limiter-flexible` / Upstash Redis) keyed on `(agent_id, mandate_id, ip)`. High-throughput multi-region serverless instances use Redlock distributed primitives for millisecond-level atomic budget reservation and cross-instance webhook delivery deduplication.

## Release Security Baseline

The current hardening branch adds the following release controls:

- Gitleaks runs before dependency installation and build steps.
- CI blocks high and critical vulnerabilities in production dependencies.
- Dependabot checks npm packages and GitHub Actions weekly.
- Vercel sends `X-Frame-Options`, `X-Content-Type-Options`, `Referrer-Policy`, and `Permissions-Policy` on application responses.
- The Content Security Policy is currently report-only. It must remain report-only until browser testing confirms PayPal checkout, Next.js scripts, and required external requests work under the policy.

The dependency baseline is Next.js 15.5.29, Zod 4.6.7, and PostCSS 8.5.32. Existing Zod 3 schema behavior is retained through the `zod/v3` compatibility entrypoint while application schemas are migrated deliberately.

The deployed health endpoint currently confirms database connectivity. That response does not prove durable storage across serverless instances or redeployments. The demo still uses SQLite. Treat PostgreSQL migration, data transfer, and production persistence as open release work until a separate database is provisioned and verified.

## Limits

Public Vercel demo sessions are created automatically and last 24 hours. Each browser gets an isolated workspace. This isolates demonstrations but does not establish real customer identity or production account recovery. The catalog is fixed. There is no fulfillment, tax/shipping calculation, refund initiation, subscription management, or automatic operator resolution of `REVIEW_REQUIRED` payments.

Groq structures intent, selects catalog candidates, and explains recorded outcomes. It never receives PayPal credentials or an authorization tool. Insights totals cover all records in the current workspace, separated by currency. Detail tables show the latest 500 records per type, while the analyst sees summary totals and the latest 50 of each type. AI answers are advisory text, and evidence IDs are checked rather than independently proving every claim. Production payment operations need a separate identity, compliance, operational, and fulfillment design.

MIT licensed. Reporting details are in [SECURITY.md](SECURITY.md).

# Security posture

Allopal is a session-isolated Sandbox demonstration, not a production financial identity platform.

## Trust boundaries

- The public Vercel demo automatically creates an isolated 24-hour workspace per browser. Private self-hosted deployments can require a high-entropy `ALLOPAL_DEMO_ACCESS_KEY`.
- Session tokens are random, HttpOnly, SameSite=Lax, Secure in production, and stored only as hashes in SQLite.
- Browser mutations require the current session and same-origin requests. Mandates and financial records are loaded with workspace ownership filters.
- PayPal return/cancel requests validate a per-attempt random state token scoped to the exact PayPal order. They do not require the browser session cookie, because PayPal may redirect after that session expires.
- Reset affects only the caller's workspace and is rejected while payments are unresolved.
- The agent receives catalog data, not provider credentials or mandate-management tools. Its selection is untrusted until the deterministic policy checks it.
- Payment attempts, policy decisions, operation keys, and budget reservations are persisted before provider execution.
- Capture and cancellation have exclusive state claims. Revocation blocks unclaimed captures. In-flight captures may still settle.
- Unknown provider results retain reservations until reconciliation. An HTTP error alone is not proof that money did not move.
- Webhooks are verified by PayPal and reconciled against authenticated provider state. The scheduler uses its own server-side bearer secret.
- State and evidence responses omit raw payer responses and callback secrets. Runtime evidence is private and uncached.

## Operations

For self-hosting, use HTTPS, a persistent single-host SQLite volume, backups, and a supervised recovery worker. Vercel serverless deployments need external PostgreSQL for durable shared persistence. The current health endpoint confirms connectivity, not persistence across redeployments. Keep `.env`, database files, cookies, provider tokens, and access keys out of Git. Rotate any self-hosted demo key if it is shared beyond its intended audience. Existing sessions remain valid until expiry unless their session row is removed by an operator.

Tests create an isolated disposable database and block unmocked network access. Never run the old demo-reset seed against a customer database.

Legacy pending orders require operator review after migration. `REVIEW_REQUIRED` is a deliberate hold, not a successful payment or an instruction to refund budget. Compare the provider order/capture status before correcting a reservation. Do not replay an unknown operation with a fresh provider request ID.

A runtime snapshot is not signed proof. It contains inspectable financial identifiers and must be reviewed before publication.

## Limits

The public demo session does not establish legal identity, provide durable account recovery, or replace customer authentication. A visitor can create a new isolated session and use provider quota. A self-hosted access key is only an access gate, not customer authentication. The app has no production fraud detection, fulfillment, settlement ledger, refund initiation, or operational case-management system. Keep it on Sandbox until those requirements are designed and independently reviewed.

## Reporting

Report a suspected issue privately to the repository owner through the contact on their GitHub profile. Include the affected commit, a minimal reproduction using synthetic data, expected/actual behavior, and impact. Do not include live credentials, payer personal information, cookies, or private financial data in public issues.

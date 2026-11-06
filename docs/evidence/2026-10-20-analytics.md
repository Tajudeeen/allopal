# Spending insights and submission preparation, 20 October 2026

Base: `ef872a21da1c12f0285e6a13da195c2372504aeb`, the merged payment-recovery release. This evidence accompanies the analytics/submission pull request.

## Automated checks

- `npm test`: 117 tests passed across 22 files. Synthetic credentials, explicitly mocked providers, blocked unmocked network, disposable migrated SQLite database.
- `npm run typecheck`: passed.
- `npm run lint`: passed without warnings.
- `npm run build`: Next.js 14.2.35 production build passed. `/insights` first-load output is about 105 kB with Studio in a separate dynamically loaded chunk.
- `git diff --check`: passed.
- Added analytics tests for separate currencies and payment states, cross-session isolation, redaction, full totals with capped tables, origin enforcement, server-owned model evidence, unchanged financial records, invalid model citations/output, provider failure, rate limits, and the tool-free Studio runner.
- Fresh deployment command creates an absent nested SQLite file. A second deployment preserves a test database record. Existing populated legacy migration also passes.

The new fresh-file test reproduced a setup problem that the previous test runner masked by pre-creating its database. `db:deploy` now prepares the SQLite path before Prisma migrations without truncating existing files. The default SQLite URL now agrees with `.env.example`.

## Production browser observations

Used Chromium 153 with Playwright against the production build over a temporary local HTTPS reverse proxy. Browser requests to external hosts were blocked. Used a disposable local database and synthetic local demo entry key. These are local observations, not a hosted deployment.

Desktop: 1440 × 1000. Mobile: 390 × 844.

- Protected entry opened a new isolated workspace.
- A real request through `/api/authorize` denied the $90 gaming headset and created no payment. Refreshing Insights showed one denial, zero payment attempts, and zero captured/reserved money.
- The custom mandate-health widget rendered the current $40 remaining authority. The policy chart and grids received the owned records, and the policy grid rendered DENIED.
- View/customize modes opened successfully. The default Studio widget catalogue is retained alongside the custom Allopal widget.
- The AI form was disabled while Gemini was unconfigured.
- A separate unauthenticated HTTP client received 401 from `/api/analytics`.
- The exported session snapshot omitted raw payer payloads, callback state, and session token hashes.
- No horizontal page overflow on either viewport. The compact Studio layout stacks its widgets.
- `/judge` rendered the walkthrough and correctly showed missing PayPal/Gemini configuration.
- Corrected inherited heading and navigation contrast on the new pages and inspected desktop/mobile screenshots.
- No application JavaScript page exceptions or unexpected browser console errors in the completed run. Expected diagnostics were the initial unauthenticated session check and the retained AG Studio evaluation-license warnings.

## Explicitly fixture-backed browser checks

An intercepted analytics response enabled the client AI controls, and an intercepted `/api/analytics/ask` response supplied a known answer with the ID of the actual local denied decision. This verified:

- The accessible question form renders an answer and lets the reader inspect its cited source record.
- The Studio AI module displays the AI Assistant and prompt starters.
- Clicking Explain my budget executes the custom runner and renders the response, evidence IDs, read-only note, and snapshot time inside Studio chat.

The separate API tests exercise the server's Gemini request mapping, output parsing, citation validation, and failure handling with explicit provider fixtures. Neither set of tests establishes a live Gemini response.

## Configuration preflight and release limits

`npm run release:check` correctly exits nonzero in this unconfigured checkout and identifies the missing HTTPS origin, durable database path, strong demo entry key, Sandbox credentials/webhook, Gemini key, and AG Studio license. It prints no secret values. The license and configuration checks establish presence only. They do not verify validity, billing, or external service operation.

Not performed:

- A real PayPal Sandbox approval/capture or delivered webhook.
- A real Gemini provider request.
- Hosting provisioning, restart persistence or supervised recovery on a deployed host.
- Docker execution. The Docker/Compose build now forwards the browser-visible Studio license setting, but the recipe remains unexecuted here.
- Issuing an AG Studio license. The key must cover its AI module and remain valid through judging. The evaluation watermark is retained.
- Changing private repository visibility, submitting to Devpost, or uploading a public YouTube demo.

See `../SUBMISSION.md` and `../SANDBOX_VERIFICATION.md` for the remaining account and evidence steps. No APIMatic, Channel3, or Render usage is claimed.

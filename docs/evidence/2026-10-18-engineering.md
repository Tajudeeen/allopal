# Engineering verification, 2026-10-18

Base: `c70fa274c6987a0789fb46f4cc32960c4b33a764`. Work: payment recovery and isolated demo sessions.

## Automated checks

- 108 tests pass across 21 Vitest files.
- Tests use a newly migrated, disposable SQLite database and synthetic provider credentials.
- Unmocked fetch calls are blocked before tests run.
- TypeScript and ESLint pass.
- Next.js 14.2.35 production build passes.

The suite covers the policy boundary, concurrent reservations, duplicate operations/callbacks, capture/cancel races, revocation, unknown create/capture outcomes, provider amount validation, recovery after lost browser return, signature verification, session ownership, callback state, retry storage, and legacy migration.

## Database and worker

Fresh migration deployment completed. A populated old-schema migration test preserves mandate budget and financial identifiers, generates callback secrets, preserves foreign keys, and places legacy pending orders in `REVIEW_REQUIRED`.

`npm run worker:once` completed against a freshly migrated local database with zero pending attempts. Provider recovery behavior was verified with fixtures, not a live provider call.

## Production browser flow

A local production build was served through a temporary HTTPS proxy and inspected with Chromium at desktop 1440x1000 and mobile 390x844. External browser requests were blocked. No PayPal or Gemini credentials were configured.

Passed:

1. Wrong access key is rejected and a valid key opens a session.
2. The first-run walkthrough can be skipped.
3. A manual $90 headset request is denied by category, with no provider order.
4. A manual $18 notebook dry run is allowed without money movement.
5. `?payment=completed` does not manufacture payment success.
6. An unknown order produces an unverified-payment notice, not success.
7. Two browser contexts receive different mandates and separate decision histories.
8. The current session can export evidence without raw responses, session hashes, or callback secrets.
9. Mobile content does not overflow horizontally.
10. No JavaScript page exceptions occurred.

The browser check exposed a local Origin mismatch between `localhost` and `127.0.0.1`. The guard now uses the browser Host for development when no canonical origin is configured. Production callbacks use `APP_BASE_URL`. A regression test covers the mismatch.

## External checks still required

No independent PayPal Sandbox capture, deployed SDK v6 buyer approval, configured Gemini response, or real webhook delivery was performed. Follow `docs/SANDBOX_VERIFICATION.md` and export the resulting session evidence. Docker is unavailable here, so the container recipe is not execution-verified. Public hosting and final submission media are not claimed complete.

## Provider references checked

- https://developer.paypal.com/v5-v6
- https://developer.paypal.com/sdk/orders/v2/orders-create/
- https://developer.paypal.com/api/rest/integration/orders-api/api-use-cases/advanced/
- https://developer.paypal.com/api/rest/webhooks/rest/

These references informed the adapter contracts. They do not establish that a configured external account works.

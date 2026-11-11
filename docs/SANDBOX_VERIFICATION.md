# Sandbox verification and evidence

Status: external verification still required. Automated fixtures do not establish that a PayPal account, webhook, or Groq credential works.

## Configure

1. Configure the server-side PayPal Sandbox and Gemini credentials described in README.
2. Set the public HTTPS `APP_BASE_URL` and a strong `ALLOPAL_DEMO_ACCESS_KEY`.
3. Use durable SQLite storage, apply migrations, and start the web process and recovery worker.
4. Register `/api/paypal/webhook` in the same Sandbox app. Set its real `PAYPAL_WEBHOOK_ID`.
5. Open a private demo session in a browser. Use a Sandbox buyer account separate from the merchant app account.

## Record

Run the README judge walkthrough. Capture the problem, reviewed mandate, denied headset, permitted notebook, buyer approval, stored capture ID, over-budget rejection, revocation rejection, and ledger.

From the ledger, choose **Export sanitized evidence**. Keep the resulting JSON with the recording. Inspect the order and capture IDs independently in PayPal Sandbox. Confirm that blocked decisions have no provider order and that the captured notebook leaves $22.

The export contains financial identifiers and policy results for the current workspace. It omits credentials, cookies, callback secrets, and raw payer responses. Review the file before publishing it.

## Recover

- Start an order and close the browser before approval. After the local 30-minute approval window, the worker should reconcile and close it without capturing. Budget remains held until cancellation is established.
- Exercise duplicate callbacks and lost-response paths using the automated tests. Do not simulate a real outage by editing accounting rows in a working database.
- Confirm real webhook delivery and signature verification in the PayPal dashboard. Repeated event deliveries must not change the budget twice.
- An unresolved capture must remain visibly pending, never reported as success or refunded budget.

## Promote a claim

Add a dated, sanitized runtime artifact under `docs/evidence`, identify environment and commit, and link it in `docs/CLAIMS.md`. A successful build, a fixture, or a database snapshot alone is not independent external verification. Real-money production transactions are not needed for the Sandbox demo.

## Submission checklist

- Fresh tests, typecheck, lint, and build pass.
- The configured public demo can complete buyer approval and capture.
- Sanitized Sandbox order/capture artifact and webhook-delivery evidence are captured.
- Public source access and MIT license are available to judges.
- Record a public demo under three minutes and disclose the tools actually used.
- Review the current contest rules and eligibility before submitting. This document is not a replacement for those rules.

# Allopal submission and sponsor evidence

Official sources, checked 20 October 2026:
- https://paypalaihackathon.devpost.com/rules
- https://paypalaihackathon.devpost.com/details/aggrid
- https://paypalaihackathon.devpost.com/details/faqs

Deadline: 12 November 2026, 12:00 PST, which is 21:00 in Lagos. Judging access must remain available through 15 December 2026, 08:00 PST.

## Required submission gates

- [ ] Register and complete the Devpost submission fields in English.
- [ ] Show meaningful PayPal Sandbox and AI functionality in a working build.
- [ ] Make the source repository public with the existing detectable MIT license. Audit the repository and its history for secrets before changing visibility. Never publish `.env` or provider secrets.
- [ ] Provide either a hosted working demo or complete setup/run instructions. Hosting is optional under the rules.
- [ ] Provide clear demo and Sandbox buyer instructions. The public Vercel demo creates an isolated browser session automatically, so no shared entry key is required. Keep provider secrets on the server and do not make judges wait for a manual access request.
- [ ] Identify the AI models/services and development tools actually used and explain their roles.
- [ ] Upload a public YouTube video under 3 minutes showing the build functioning and include its link.
- [ ] Keep access free and usable through judging. Confirm third-party trial licenses remain valid through that period.

Do not tick a gate merely because code exists. Store dated sanitized observations under `docs/evidence`, linked to the tested commit.

## Core award positioning

Best Use of Agentic Commerce and Best Use of PayPal + AI fit the product: AI proposes a purchase, a person locks spending authority, deterministic policy decides, and PayPal executes only within that boundary. These are positioning choices, not eligibility certification or a prediction of winning.

## AG Studio integration

The `/insights` route dynamically loads AG Studio 3.0.0. It includes:

- A custom Allopal mandate-health widget with remaining authority and committed budget.
- A policy-outcome chart and interactive payment/decision grids.
- A themed dashboard with editable layout, separate from financial authority.
- A custom Studio Agent Framework runner backed by `/api/analytics/ask`. Its only operation is a same-origin read-only analysis request. It has no payment, mandate, refund, or budget-write tools.
- A separate accessible question form with inspectable evidence IDs and explicit snapshot times.

Dashboard layout and Studio chat state are kept in memory for the current visit. Reloading the page or switching between compact and wide screen layouts resets the Studio view. Financial records remain in the database.

The broad prize table accepts AG Grid tools, but the sponsor's detailed brief asks for polished AG Studio dashboards, custom widgets/theming/layout, and agent integration. This implementation addresses those areas. Eligibility and judging remain the organizers' decision.

AG Studio is commercially licensed. Our application source remains MIT, while dependencies retain their own licenses. AG Grid's 6 November PayPal hackathon blog says entries do not need a separate license and that AG Grid will cover the judging-period key. The current deployment has no `NEXT_PUBLIC_AG_STUDIO_LICENSE_KEY` configured, so confirm sponsor coverage through the AG Grid team or PayPal Discord. A missing key may leave the evaluation watermark visible. Do not suppress it or claim a key is installed. See the [AG Studio hackathon guidance](https://www.ag-grid.com/blog/build-a-payments-dashboard-without-building-a-dashboard/) and [AG Grid sponsor page](https://paypalaihackathon.devpost.com/details/aggrid).

Evidence to record:

1. Open Insights after making actual policy checks and a verified Sandbox capture.
2. Compare its captured/reserved totals against the ledger. Totals cover the workspace, tables show at most the latest 500 records each, and the latest mandate card can coexist with historical activity.
3. Customize the dashboard layout and show that the financial records are unchanged.
4. Ask why a purchase was denied. Inspect its cited source record. The server sends summary totals and the latest 50 records of each type, without provider credentials, payer payloads, or callback tokens.
5. Demonstrate honest provider failure handling. No AI answer should appear if Groq is unavailable.

The AI answer is advisory generated text. Evidence IDs are validated against the supplied records, but this does not independently prove every sentence true. Inspect the deterministic totals and source records. The per-workspace AI rate limiter is an in-memory single-host demo guard and resets on process restart.

## Tools statement draft

- PayPal Orders API and JavaScript SDK v6: Sandbox order creation, buyer approval, capture, and cancellation.
- PayPal webhook verification API: authenticate events before re-reading provider state.
- Groq API with the configured `GROQ_MODEL` (currently `openai/gpt-oss-120b`): mandate drafts, catalog cart selection, decision explanations, and read-only spending analysis. Provider configuration is visible in the deployed judge guide, but live request and buyer-flow verification still need dated evidence.
- AG Studio 3.0.0 and AG Studio React: spending dashboard, custom mandate widget, editable layout, and custom analyst runner. Sponsor license setup remains required.
- Postman collection: reproducible API walkthrough with session, origin, and idempotency requirements.
- ChatGPT/Codex: implementation assistance and test/documentation work. Review and amend this statement to include other tools actually used.

Do not claim APIMatic, Channel3, Render, or other sponsor usage merely from mentioning them. They are not implemented in this submission iteration.

## Suggested 2:45 recording

| Time | Show | Point |
| --- | --- | --- |
| 0:00–0:20 | Mandate and product | An AI shopping assistant needs a human-owned spending boundary. |
| 0:20–0:50 | $90 gaming-headset denial | Policy refuses a disallowed category before PayPal execution. |
| 0:50–1:35 | $18 notebook purchase and Sandbox approval | Show actual captured state and the $22 remaining budget. |
| 1:35–2:00 | Over-budget attempt and revocation | A useful assistant still has enforceable limits. |
| 2:00–2:30 | Insights and cited AI answer | Inspect where authority went and why the server refused a request. |
| 2:30–2:45 | Evidence export | Records support the demonstration. State Sandbox and controlled-catalog limits. |

Do not record a successful provider flow using fixtures as if it were external verification. Never include API secrets or buyer passwords in the public recording.

## Release preparation

Run `npm run release:check` in the deployment environment. It is a configuration preflight, not an external verification or permission check. It deliberately exits nonzero for missing setup.

Use the persistent-host recipe in README. The current SQLite web/worker pair needs the same durable database file on one host. Separate Render web and worker services cannot be assumed to share that file. A multi-service deployment requires a shared database migration or recovery scheduled against the same web-hosted database. No hosting account, paid service, license trial, or provider credential was provisioned by this code change.

Follow `SANDBOX_VERIFICATION.md` for actual payment, callback, webhook, and recovery evidence.

# Allopal claims ledger

| Claim                                                                        | Evidence                                                         | Status                                                   |
| ---------------------------------------------------------------------------- | ---------------------------------------------------------------- | -------------------------------------------------------- |
| Policy is deterministic and uses server-owned catalog data                   | `lib/policy/engine.ts`, policy/API/security tests                | Test-covered                                             |
| AI can propose or select a cart but cannot authorize a payment               | Separate proposal/lock routes, agent route, agent/proposal tests | Code-reviewed and test-covered                           |
| Denied purchases never execute PayPal operations                             | Boundary and recovery tests                                      | Test-covered with explicit provider spies                |
| Reservation and payment attempt exist before external execution              | `lib/payments/lifecycle.ts`, recovery test                       | Test-covered                                             |
| Capture and cancellation cannot both claim the same attempt                  | Recovery race tests                                              | Test-covered                                             |
| Unknown results retain budget until reconciled                               | Recovery tests, no blind timeout rollback                        | Test-covered                                             |
| Replays return current state without another purchase                        | Concurrency, recovery, browser operation tests                   | Test-covered                                             |
| Revocation blocks captures not already claimed                               | Capture-claim check and tests                                    | Test-covered                                             |
| Demo sessions cannot inspect or reset another workspace                      | Handler-level ownership filters and session tests                | Test-covered                                             |
| Payment success requires stored capture state                                | Status endpoint, presentation tests, browser check               | Test-covered; browser evidence in index                  |
| Webhooks require provider signature verification and read provider state     | Webhook tests and client adapter                                 | Test-covered with fixtures; real registration unverified |
| Existing database migration preserves budget and holds legacy pending orders | Migration test                                                   | Test-covered                                             |
| A real PayPal Sandbox capture has completed on this release                  | No external artifact captured in this engineering session        | Not live-verified                                        |
| The deployed Groq and PayPal Sandbox configuration is available in a real buyer browser | Judge guide reports both providers configured; no verified buyer capture or webhook evidence yet | Configured, not live-verified |
| The Docker web/worker stack has been run                                     | Docker unavailable in this workspace                             | Not execution-verified                                   |
| Insights uses only the caller's workspace and separates payment states/currencies | `lib/analytics/report.ts`, analytics tests | Verification results tracked in the evidence index |
| The analyst cannot modify money or authority | Dedicated read-only route, server-selected evidence, Studio runner without tools | Test-covered with Groq response fixtures |
| AG Studio dashboard, custom widget, layout editing, and agent runner are integrated | `/insights`, `components/analytics/SpendingStudio.tsx`, `lib/analytics/studio-agent.ts` | Sponsor license and dated live Groq evidence still required |

Tests use synthetic provider responses and a disposable database. A green test is evidence of the tested behavior, not a production transaction. Promote external claims only after following `docs/SANDBOX_VERIFICATION.md`.

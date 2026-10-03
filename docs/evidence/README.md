# Allopal Evidence Index

This directory records the artifacts that support public claims about Allopal.

The repository currently contains strong source-level and automated-test evidence for the authorization boundary. It does not contain a captured independent live PayPal production run, so those claims remain explicitly unverified.

## Evidence status

| Evidence | What it shows | Source | Status |
|:---|:---|:---|:---|
| Policy engine tests | Ordered mandate, merchant, category, amount, and budget checks | tests/policy/engine.test.ts | Source-linked |
| Authorization API tests | Server-side authorization and client-tamper resistance | tests/api/authorize.test.ts | Source-linked |
| PayPal boundary tests | PayPal execution behavior and zero-call failure paths | tests/payments/paypal.test.ts | Source-linked |
| Security boundary tests | Explicit proof paths for blocked categories, over-budget purchases, and revoked mandates | tests/payments/security_boundary.test.ts | Source-linked |
| Concurrency tests | Atomic/idempotent handling of concurrent spending and repeated requests | tests/payments/concurrency.test.ts | Source-linked |
| AI proposal tests | Natural-language mandate proposal validation and human approval gating | tests/ai/proposal.test.ts | Source-linked |
| AI explanation tests | Read-only decision explanation behavior | tests/ai/explainer.test.ts | Source-linked |
| E2E specification | Canonical Cases A-D and their intended outcomes | tests/e2e/allopal_full_flow.test.ts | Source-linked |
| Security audit | Price tampering, category injection, and credential exposure checks | tests/security/security_audit.test.ts | Source-linked |
| Failure recovery | Fail-closed rollback behavior around payment failures | tests/failures/failure_recovery.test.ts | Source-linked |
| Theme contrast tests | Contrast math and adaptive typography helpers | tests/theme/contrast.test.ts | Source-linked |
| CI workflow | Automated test, typecheck, lint, and build commands configured in CI | .github/workflows/ci.yml | Configured |
| Live PayPal production transaction | Independent external transaction artifact | None currently captured | **Not captured** |
| External-user production usage | Evidence of external production users | None currently captured | **Not captured** |

## Capturing a runtime artifact

When a live verification is available, store a sanitized, reproducible artifact here rather than pasting a success statement into the README.

An artifact should record:

- timestamp
- environment: mock, sandbox, or production
- scenario or request
- relevant decision id
- PayPal order/capture ids when applicable
- final status
- important checks
- failure reason when applicable

Never commit:

- PayPal secrets
- AI API keys
- authentication headers
- cookies
- payment signatures
- database credentials
- private wallet material

The README and docs/CLAIMS.md should link the artifact rather than duplicating raw output.

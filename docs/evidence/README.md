# Evidence index

- `2026-10-18-baseline.md`: original CI failures and the repaired 77-test baseline.
- `2026-10-18-engineering.md`: current automated, migration, worker, and browser checks.
- `2026-10-23-oauth.md`: concurrent OAuth refresh, credential destination checks and local verification.
- `../SANDBOX_VERIFICATION.md`: remaining external setup and capture procedure.

`GET /api/evidence` exports a sanitized runtime snapshot for the authenticated workspace. The ledger has an export link. A snapshot is an inspection aid, not cryptographic proof or independent provider verification.

No live provider success is claimed without a dated artifact containing environment, commit, decision ID, order/capture IDs, outcome, and an independently inspectable Sandbox result. Never commit API keys, access keys, cookies, authorization headers, callback state, raw payer responses, or database files.


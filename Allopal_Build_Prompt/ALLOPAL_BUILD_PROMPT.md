# ALLOPAL BUILD SPECIFICATION

You are the senior software engineer, security engineer, QA engineer, and technical auditor responsible for building Allopal.

Allopal is a spending authorization layer for PayPal agentic commerce.

A human creates and locks a spending mandate. An AI agent can request PayPal payments, but PayPal is only called when the payment satisfies the locked mandate.

Core invariant:

MANDATE PASSES
    -> PAYPAL ORDER CREATED
    -> PAYPAL CAPTURE

MANDATE FAILS
    -> NO PAYPAL ORDER
    -> NO PAYPAL CAPTURE

The AI can interpret human intent and explain decisions. It must never independently authorize money movement. The deterministic policy engine owns payment authorization. PayPal owns payment execution.

## PRIMARY DEMO

A parent creates:

- Mandate: School Shopping
- Limit: $40
- Duration: 7 days
- Allowed category: School Supplies
- Allowed merchants: Campus Books, Paper & Pencil

Case A: $18 notebook bundle from Campus Books, School Supplies.
Expected: mandate passes, PayPal order is created and captured, real PayPal order ID is stored and displayed.

Case B: $90 gaming headset from Campus Books, Electronics.
Expected: category fails, PayPal is never called, no order is created.

Case C: after spending $18, attempt a $25 notebook purchase.
Expected: remaining budget fails, PayPal is never called.

Case D: revoke the mandate, then attempt an $8 notebook purchase.
Expected: mandate fails, PayPal is never called.

Case E: user enters:
"Give my shopping agent $40 for school supplies from Campus Books for the next 7 days."
AI produces a structured proposed mandate. Human must explicitly approve and lock it. AI cannot silently activate or modify it.

## NON-NEGOTIABLE BUILD RULE

Build sequentially.

IMPLEMENT -> TEST -> VERIFY -> AUDIT -> COMMIT -> NEXT STEP

Never move to the next step when the current step has failing tests, TypeScript errors, lint errors, build errors, broken behavior, or unresolved security concerns.

Every completed step MUST have its own Git commit.

Do not batch unrelated steps into one commit.

## BEFORE WRITING CODE

Inspect the repository:

- framework
- package manager
- existing files
- architecture
- environment configuration
- database
- PayPal integration
- AI integration
- tests
- scripts
- Git status
- branch
- commits

Run the existing test suite, lint, typecheck, and build where available.

Document pre-existing failures separately from your changes.

Do not rewrite the project from scratch unless the existing project is genuinely unusable.

## TECHNOLOGY DEFAULTS

Use the existing project stack when reasonable.

Preferred:
- Next.js
- TypeScript
- PostgreSQL
- Prisma
- PayPal Sandbox
- PayPal Agent Toolkit where practical
- AI API for mandate interpretation and explanations

PayPal credentials and AI keys must remain server-side.

Never expose:
- PAYPAL_CLIENT_SECRET
- GROQ_API_KEY and GROQ_MODEL
- DATABASE_URL

Create .env.example with placeholders only. Never commit secrets.

## ARCHITECTURE

Use clear boundaries.

Suggested structure:

app/
  api/
    mandates/
    authorize/
    payments/
    decisions/

lib/
  ai/
  paypal/
  policy/
  db/

prisma/
  schema.prisma
  seed.ts

components/
  mandate/
  payment/
  decision/
  ledger/

tests/
  policy/
  payments/
  mandates/

Adapt this to the existing repository.

Critical flow:

Payment Request
    -> Authorization Service
    -> Policy Engine
    -> Decision

If denied:
    save decision
    stop

If allowed:
    PayPal create order
    PayPal capture
    save PayPal order ID

The PayPal service must not bypass the policy engine.

## DATABASE

Minimum models:

- Mandate
- Product
- Cart
- Decision

Optionally use PayPalTransaction if useful.

Mandate should include enough information to reproduce why a payment was accepted or rejected.

Suggested fields:

id
name
weeklyLimit
spentAmount
validFrom
validUntil
status
allowedCategories
allowedMerchants
createdAt
updatedAt

Decision:

id
mandateId
cartId
amount
merchant
category
status
reason
checks
paypalOrderId
createdAt

Denied decisions must have paypalOrderId = null.

Approved payments that reach PayPal must have a real PayPal order ID.

Use integer cents or another exact representation for money. Do not use floating point for monetary calculations.

## STEP 0: REPOSITORY AUDIT

Inspect the current repository and run existing checks.

Verify:
- repository state is understood
- pre-existing failures are documented
- current application can be started or its failure is documented

If no code changes are required, do not invent changes just to create a commit.

## STEP 1: FOUNDATION

Set up or verify:
- TypeScript
- database connection
- Prisma
- environment validation
- application structure
- .env.example

Verify:
- lint
- typecheck
- tests
- production build
- database connection

Audit:
- no secrets committed
- no credentials in client code
- no unsafe environment exposure
- no unnecessary dependencies

Commit:
feat: establish application foundation

Do not continue until verification passes.

## STEP 2: DATABASE AND SEED

Implement the schema and deterministic seed data for:
- School Shopping mandate
- Campus Books
- Paper & Pencil
- Notebook
- Gaming Headset

Verify migrations and seed.

Audit:
- exact money representation
- sensible constraints
- revoked mandates cannot accidentally become active
- timestamps are consistent

Commit:
feat: add mandate payment data model and seed

## STEP 3: DETERMINISTIC POLICY ENGINE

Implement a deterministic policy engine, conceptually:

evaluateMandate(mandate, cart)

Checks in order:
1. mandate exists
2. mandate active
3. mandate not revoked
4. merchant allowed
5. category allowed
6. amount valid
7. remaining budget sufficient

Return structured decisions.

Do not use AI to make authorization decisions.

Tests must cover:
- valid purchase
- inactive mandate
- revoked mandate
- invalid merchant
- invalid category
- insufficient budget
- exact budget boundary
- amount above budget
- zero/negative amount
- missing cart
- missing mandate

Boundary:
$22 remaining + $22 purchase = allowed
$22 remaining + $22.01 purchase = denied

Audit client tampering attempts against price, category, merchant, budget, and mandate status.

The server must load authoritative values itself.

Commit:
feat: add deterministic spending policy engine

## STEP 4: AUTHORIZATION API

Create:

POST /api/authorize

Client should provide identifiers such as mandateId and cartId.

Do NOT trust client-supplied:
- amount
- merchant
- category
- remaining budget

Server loads authoritative data.

Flow:
request
-> validate input
-> load mandate
-> load cart
-> load authoritative products
-> policy engine
-> decision
-> persist decision

At this stage, do not call PayPal yet.

Verify all core scenarios.

Audit modified amount, merchant, category, mandate state, nonexistent cart, nonexistent mandate.

Commit:
feat: add server-side payment authorization endpoint

## STEP 5: PAYPAL SANDBOX

Integrate real PayPal Sandbox.

Prefer official PayPal Agent Toolkit where practical. If it is unavailable or unreliable for required operations, use PayPal's official Orders API directly.

Implement:
- createOrder
- captureOrder

Use intent CAPTURE.

PayPal must only be called after policy returns allowed: true.

Never:
request -> PayPal -> policy

Always:
request -> policy -> PayPal

Verify:
- real sandbox order created
- real sandbox capture succeeds
- transaction is visible in sandbox
- order ID is stored
- remaining mandate budget updates correctly

Commit:
feat: integrate PayPal sandbox payment capture

## STEP 6: PROVE THE PAYPAL SECURITY BOUNDARY

Instrument and test the PayPal boundary.

Required:
wrong category -> PayPal calls = 0
over budget -> PayPal calls = 0
revoked mandate -> PayPal calls = 0
valid purchase -> PayPal calls = 1

Use mocks/spies in automated tests.

Audit:
- no public endpoint can create arbitrary PayPal orders
- no direct PayPal bypass exists
- all payment paths go through authorization

Commit:
test: verify PayPal authorization boundary

Do not continue until this passes.

## STEP 7: CONCURRENCY AND IDEMPOTENCY

Handle concurrent requests.

Example:
remaining = $40
request A = $25
request B = $25

The system must never capture $50.

Use transactions or appropriate database locking.

Protect against:
- double captures
- duplicate authorization
- repeated button clicks
- replayed requests

Test concurrent requests and exact budget boundaries.

Commit:
feat: make mandate spending concurrency safe

## STEP 8: AI MANDATE INTERPRETATION

Add AI for natural-language mandate proposals.

Example:
"Give my shopping agent $40 for school supplies from Campus Books for 7 days."

Flow:
natural language
-> AI
-> structured proposal
-> schema validation
-> human review
-> human locks mandate

AI must never:
- authorize payments
- call PayPal
- modify locked mandates
- revoke mandates
- increase limits
- bypass policy

Test malformed output, missing fields, invalid categories, invalid merchants, negative budgets, excessive budgets.

Commit:
feat: add AI mandate proposal flow

## STEP 9: AI DECISION EXPLANATIONS

Add AI-generated explanations from structured decisions.

Example:
CATEGORY_NOT_ALLOWED
-> "Blocked because electronics aren't included in this mandate."

The AI explanation is read-only and cannot change the underlying decision.

Commit:
feat: add AI payment decision explanations

## STEP 10: PAYPAL-CENTERED UI

Build the UI only after backend behavior is proven.

The interface should feel like a PayPal agentic payment experience, not a generic admin dashboard.

Three areas:

Mandate:
- spending limit
- remaining budget
- categories
- merchants
- expiration
- active/revoked state
- lock/revoke

Payment request:
- agent
- merchant
- product
- amount
- mandate
- authorization status
- PayPal status

Decision ledger:
- approved
- blocked
- revoked
- captured

UI must reflect actual backend state.

Never animate payment success before real PayPal capture succeeds.

Never claim "PayPal was not called" unless backend behavior proves it.

Commit:
feat: add PayPal-centered agent payment interface

## STEP 11: VISUAL POLICY GATE

Show the five checks:

Mandate
-> Active
-> Merchant
-> Category
-> Budget
-> PayPal

Successful:
all checks pass -> PayPal

Failed:
a check fails -> BLOCKED -> PAYPAL NOT CALLED

Animations must reflect actual server events, not fake timers.

Commit:
feat: visualize payment authorization decisions

## STEP 12: END-TO-END TESTS

Run from a clean database:

1. Create/interpret mandate
2. Human locks mandate
3. Request $18 notebook
4. Policy passes
5. PayPal order
6. Capture
7. Receipt
8. Budget decreases

Then:
- $90 headset -> blocked, no PayPal order
- $25 purchase with $22 remaining -> blocked
- revoke -> purchase blocked
- natural-language mandate -> AI proposal -> approval -> locked mandate -> payment

Commit:
test: add complete Allopal payment flows

## STEP 13: SECURITY AUDIT

Audit:
- authentication assumptions documented
- authorization between users/mandates
- API input validation
- exact money handling
- secret exposure
- PayPal bypass
- AI authority
- database state
- replay behavior
- concurrency
- sensitive logging

Search Git for secrets and review .gitignore.

Commit:
security: harden Allopal payment authorization boundaries

## STEP 14: FAILURE TESTING

Intentionally test:
- PayPal unavailable
- PayPal order creation failure
- PayPal capture failure
- database unavailable
- AI unavailable
- invalid AI response
- expired mandate
- revoked mandate
- duplicate request
- network timeout

Fail closed.

If payment status is uncertain, never display false success.

Commit:
test: harden failure and recovery paths

## STEP 15: CLEANUP

Run:
- lint
- typecheck
- tests
- production build

Remove:
- dead code
- unused dependencies
- debug logging
- unnecessary UI
- unused API routes
- duplicate logic

Review every API endpoint, environment variable, database table, and dependency.

Commit:
chore: prepare Allopal for demo release

## STEP 16: DEMO READINESS

Create deterministic demo reset/seed behavior, such as:

npm run demo:reset

The demo must start from known data.

Required 90-second sequence:
1. Create/interpret mandate
2. Human locks mandate
3. Request $18 notebook
4. PayPal captures
5. Show real PayPal order ID
6. Request $90 headset
7. Show policy rejection
8. Show PayPal was not called
9. Revoke mandate
10. Attempt another purchase
11. Show rejection
12. Show decision ledger

Commit:
feat: finalize deterministic hackathon demo

## FINAL AUDIT CHECKLIST

PayPal:
- real sandbox credentials
- real sandbox order
- real sandbox capture
- real order ID
- credentials server-side
- no fake payment success

Authorization:
- every payment passes policy
- denied payments never call PayPal
- revoked mandates cannot spend
- expired mandates cannot spend
- merchant restrictions work
- category restrictions work
- budget restrictions work
- exact budget boundary works
- concurrency cannot overspend

AI:
- natural-language mandate works
- output schema validated
- human approval required
- AI cannot authorize
- AI cannot bypass policy
- AI cannot directly call PayPal
- AI explanations cannot change decisions

Database:
- exact monetary representation
- decisions persisted
- PayPal IDs persisted
- denied decisions have no PayPal ID
- approved captures have PayPal IDs
- mandate state persisted
- revocation persisted

Security:
- no secrets in Git
- no secrets in client bundles
- all API input validated
- client cannot control authoritative price/category/merchant/budget
- direct PayPal bypass impossible
- replay controlled
- concurrency controlled
- sensitive credentials not logged

UI:
- backend state is authoritative
- success only after successful capture
- blocked payments explain why
- "PayPal was not called" is backed by server behavior
- ledger matches database
- revoke prevents future payment
- demo is understandable without README

## GIT DISCIPLINE

Before every commit:

git status
git diff
git diff --check

Then inspect the diff, check for secrets, run relevant tests, typecheck, lint, build, and manually verify where appropriate.

Commit only after the verification gate passes.

After each commit, report:

STEP: X
STATUS: VERIFIED

Implemented:
- ...

Verification:
- Tests: PASS
- TypeScript: PASS
- Lint: PASS
- Build: PASS
- Manual verification: PASS

Security:
- ...

Commit:
<hash>
<message>

Next:
STEP X+1

If verification fails:

STEP: X
STATUS: BLOCKED

Failure:
...

Root cause:
...

Fix required:
...

DO NOT PROCEED.

## ENGINEERING PRINCIPLES

Server is authoritative.

Policy always comes before payment.

AI output is untrusted input.

Fail closed.

Real behavior over simulated behavior.

Keep the surface area small.

Do not add chatbots, unnecessary dashboards, merchant portals, production authentication, notifications, analytics, multi-chain payments, or multiple payment providers unless required to prove the core product.

## FINAL PRODUCT CLAIM

The finished product must prove:

"An AI agent can request a PayPal payment without receiving unrestricted authority to spend."

Build only what makes that claim real, testable, auditable, and visually undeniable.

# Preliminary issue tree: settlement-backed epoch treasury and auditable payouts

Status: published and vetted; implementation proceeds through native blockers
Last updated: 2026-08-09
Repository: `FundLoop/fundloop-website`
Project: [FundLoop Project](https://github.com/orgs/FundLoop/projects/1)
Proposed priority: High
Initial Project status for every issue: Scoped

## Hierarchy

```text
Feature: Settlement-backed epoch treasury and auditable payouts
├── Task: Capture epoch treasury and payout product decisions
├── Task: Finalize the accounting, custody, and migration architecture
├── Task: Obtain legal and accounting approval for ownership and privacy terms
├── Goal L: Publish legal terms, privacy, and consent controls
│   ├── Task L.1: Publish versioned project and user Terms with acceptance gates
│   ├── Task L.2: Publish a truthful Privacy Notice and public-profile consent
│   └── Task L.3: Enforce invitation acceptance and project-scoped profile sharing
├── Goal 1: Establish the canonical ledger and epoch control plane
│   ├── Task 1.1: Add asset, custody, ledger, and accounting-period foundations
│   ├── Task 1.2: Add the gated epoch state machine and scheduler
│   └── Task 1.3: Add external-event ingestion, shadow journals, and reconciliation
├── Goal 2: Collect and reconcile settlement-backed project packages
│   ├── Task 2.1: Implement Stripe USD/CAD bank-transfer intake and reconciliation
│   ├── Task 2.2: Implement Base stablecoin intake with separate treasuries
│   └── Task 2.3: Implement versioned project packages and reconciliation review
├── Goal 3: Allocate only funded epoch value
│   ├── Task 3.1: Implement monthly FX, fee, expiry, and carryover accounting
│   ├── Task 3.2: Lock settled pools and allocate by verified uniqueness
│   └── Task 3.3: Post approved user awards and publish the epoch close package
├── Goal 4: Execute auditable multi-rail payouts
│   ├── Task 4.1: Unify partial withdrawals, inventory reservations, holds, and queues
│   ├── Task 4.2: Execute and reconcile Base Safe/paymaster payouts
│   └── Task 4.3: Onboard and pay users through Stripe Connect
└── Goal 5: Prove migration and operational readiness
    ├── Task 5.1: Cut over legacy financial projections without duplicate obligations
    └── Task 5.2: Extend the operator and five-persona operational matrix
```

## Common implementation contract

Every executable Task must:

- reuse one registered Feature worktree/branch unless issue vetting records a
  financial-risk or external-integration reason for isolation;
- use forward-only migrations under `supabase/migrations/` and regenerate
  `types/supabase.ts` when schema changes;
- route new writes through typed Supabase Edge Function commands;
- preserve existing hashed monthly-cycle and allocation artifacts;
- avoid remote Supabase, Stripe live mode, production Base, Safe, Vercel, or email
  mutations without fresh explicit user authorization;
- add focused automated tests and the relevant local smoke path;
- update the relevant `agent-context/session-log/` entry after local validation and
  before committing;
- make one reviewable commit when the Task is complete and locally validated; and
- stop on billing, permission, credential, account, quota, or external-service
  non-performance rather than silently substituting a stubbed success.

## Parent Feature draft

### Title

`Settlement-backed epoch treasury and auditable payouts`

### Why

FundLoop's monthly operational MVP can calculate and credit earnings, but its
allocation pool is still derived from project submissions rather than canonical
cash received, its platform and epoch treasuries are not separated end to end, and
its payout adapters do not execute or reconcile transfers. This Feature makes the
monthly loop financially backed, multi-currency, and auditable from receipt through
payout and expiry rollover.

### Coordination objective

Deliver a gated monthly epoch system that accepts settled Stripe USD/CAD and Base
USDC/USDT/PYUSD, accounts for three fee types in a USD-functional double-entry
ledger, allocates only reconciled restricted assets, lets eligible users withdraw
through available project-linked rails, and proves every receipt, liability,
transfer, reconciliation, and rollover through immutable artifacts.

### In scope

- Pacific settlement cutoff and paired project list/payment packages.
- Separate platform and epoch custody by rail and asset.
- Hybrid multi-currency chart of accounts and canonical journal.
- Monthly FX, fee, reconciliation, carryover, locking, allocation, and close gates.
- Cubid whitelist/uniqueness/hold behavior.
- Stripe bank-transfer intake and Connect payouts.
- Base allowlisted stablecoin intake and Safe/paymaster payouts.
- Partial withdrawals, inventory constraints, queued carryover payouts, and expiry.
- Operator/founder/user surfaces, reports, emails, migration, and persona proof.
- Counsel-approved FundLoop ownership, no-refund, no-escrow, best-effort payout,
  currency-availability, and fee disclosures.
- A truthful no-sale/no-unrelated-disclosure Privacy Notice, private-by-default
  profiles, affirmative public-profile consent, and invitation-gated project member
  sharing.

### Out of scope

- Stripe cards and pull-based debit intake.
- Fiat beyond USD/CAD, chains beyond Base, or arbitrary tokens.
- Continuous/daily FX revaluation.
- Backdating settled receipts or allocating declared promises.
- Automatic conversion to assets outside the user's eligible project-linked pool.
- Clawback of completed user payouts.
- Production value before accounting, legal, custody, and control approvals.

### Validation overview

- Local Supabase migration/reset/seed and generated type validation.
- Journal, reconciliation, concurrency, RLS, FX, fee, allocation, and expiry tests.
- Stripe sandbox/CLI and Base local/Sepolia rail validation.
- Hardhat tests for intake separation and Safe-policy integration tests.
- Node 22 `CI=1 pnpm check`.
- Extended local operator and five-persona matrix with explicit sandbox/live claims.

### Risks

- Legal/custody classification may change the physical Stripe topology or account
  presentation; the architecture Task blocks implementation until reviewed.
- Historical payment timestamps are not settlement evidence; migration must not
  fabricate proof.
- Safe modules can bypass normal multisig controls; use audited deployments,
  allowance constraints, and revocation tests.
- Exact public project counts can support inference; reports need explicit privacy
  review despite the confirmed no-user-identifier rule.
- A broad cutover could double-create liabilities; shadow journals and one canonical
  withdrawal-backed obligation path are mandatory.
- The latest FundLoop-ownership/no-user-ownership intent conflicts with the earlier
  pre-payout liability model; counsel and an accountant must resolve recognition
  before ledger implementation.
- An absolute no-sharing promise would contradict Stripe, Cubid, hosting, email,
  legally required disclosure, and public-chain processing; the policy must promise
  no sale or unrelated voluntary disclosure while naming necessary exceptions.

## Parent Task: Capture epoch treasury and payout product decisions

Parent: Feature
Precedes: architecture Task and all Goals

### Objective

Preserve the completed product brainstorm, alternatives, confirmed decisions,
non-goals, and unresolved design inputs so later implementation does not rely on a
conversation transcript.

### Artifact

- `agent-context/2026-08-08-epoch-treasury-accounting/sprint-definition.md`

### Acceptance criteria

- All eight interview batches and subsequent corrections are reflected.
- Confirmed and unresolved decisions are visibly separated.
- Cash flow, state machine, fees, currencies/assets, Cubid, payouts, expiry, and
  accounting architecture are covered.
- The parent Feature and architecture Task link to the artifact.

### Stop condition

Stop after the decision artifact is reviewed and linked. Do not implement product
or schema changes in this Task.

## Parent Task: Finalize the accounting, custody, and migration architecture

Parent: Feature
Depends on: brainstorm Task
Blocks: Goal 1

### Objective

Review and finalize the engineering design, resolve remaining external/legal and
accounting choices, and produce executable contracts for implementation.

### Evidence and surfaces

- `docs/engineering/settlement-backed-epoch-treasury.md`
- the living Feature definition;
- current monthly-cycle, payment, allocation, payout, reporting, and contract code;
- official Stripe Connect, Base finality, and Safe module documentation;
- accountant/counsel decisions or explicit pre-production blockers.

### Required decisions and outputs

- Stripe platform/epoch balance and sweep topology.
- Exact external-event, journal, custody, FX, fee, stage/gate, reservation, and
  reconciliation contracts.
- Accountant-reviewed chart and pre-/post-allocation FX presentation.
- Safe threshold, allowance/module, signer, paymaster, and emergency controls.
- Price sources, Cubid TTL, holiday calendar, risk reserve, rounding/dust, and queued
  request policies.
- Migration mapping for every legacy financial row class.
- Threat model and operational-control review.
- Final API/event schemas, diagrams, rollout plan, and test matrix.

### Acceptance criteria

- The design contains no unresolved decision required by Task 1.1.
- Every trust boundary and accounting event has an owner and source of truth.
- Schema proposals follow Supabase RLS, FK indexing, exact numeric, idempotency,
  short-transaction, consistent-lock-order, and queue-processing guidance.
- External account or legal decisions that cannot be resolved in code are explicit
  production blockers rather than simulated implementation requirements.
- Goal 1 can be vetted without additional discovery.

### Stop condition

Stop after design approval. Do not implement production schema, rail, or payout
changes in this Task.

## Parent Task: Obtain legal and accounting approval for ownership and privacy terms

Parent: Feature
Depends on: architecture Task draft
Blocks: Goal L, Goal 1 ledger classification, project collection, and payouts

### Objective

Turn FundLoop's confirmed ownership, no-refund, no-escrow, best-effort payout,
currency-availability, privacy, and consent intent into jurisdiction-appropriate,
accountant-consistent policy language and implementation requirements.

### Evidence and surfaces

- `agent-context/2026-08-08-epoch-treasury-accounting/sprint-definition.md`;
- `docs/engineering/settlement-backed-epoch-treasury.md`;
- existing `/[locale]/terms`, `/[locale]/privacy`, cookies, onboarding, profile,
  invitation, payment, earnings, and payout surfaces;
- actual Supabase, Vercel, Stripe, Cubid, email, analytics, support, and Base data
  flows;
- Stripe Connected Account Agreement and privacy disclosure requirements; and
- qualified legal/accounting advice for FundLoop's operating jurisdictions.

### Scope

- Draft and obtain qualified review of language stating the intended FundLoop
  ownership of submitted project funds, no refund right, discretionary best-effort
  refunds, no escrow, no user ownership at allocation/request, best-effort payout,
  and no guaranteed asset or rail.
- Define the exact legal event at which a payout is "processed" and whether any
  earlier allocation, approval, reservation, request, or submission creates a
  contractual commitment, expense, or payable.
- Reconcile fund ownership with project/base/user fee presentation, revenue
  recognition, payout expense, abandoned awards, tax, sanctions, and custody.
- Produce a data-flow inventory and approve truthful Privacy Notice language: no
  sale/rental/unrelated voluntary disclosure, necessary processors, legal
  disclosures, Stripe/Cubid, hosting/email, public-chain data, retention, rights,
  public-profile consent, and project-member sharing.
- Define versioning, reacceptance, locale, withdrawal-of-consent, retention, and
  evidence requirements.

### Non-goals

- Codex independently declaring the requested language legally enforceable.
- Hiding necessary processors or public-chain exposure behind an absolute
  no-sharing claim.
- Implementing UI, migrations, or consent commands.

### Acceptance criteria

- Counsel-approved Terms and Privacy source documents exist with jurisdiction and
  effective-date metadata.
- An accountant-approved recognition memo selects the pre-payout accounting model
  and updates the chart/journal design.
- Required Stripe agreements/disclosures and connected-account consent path are
  identified.
- Every published privacy promise maps to the real data-flow inventory.
- Exact acceptance and consent events required from projects, users, invitees, and
  profile publishers are defined.
- Unresolved legal/accounting matters are explicit production blockers.

### Validation

- Human counsel/accountant approval evidence;
- structured policy-to-runtime data-flow review;
- engineering review against the Feature design and affected routes;
- no product implementation or external acceptance mutation.

### Stop condition

Stop after approved source documents and recognition/data-flow decisions are linked
to the Feature. If qualified approval is unavailable, leave dependent work blocked
rather than publishing definitive legal claims.

## Goal L: Publish legal terms, privacy, and consent controls

Depends on: legal/accounting approval Task
May proceed alongside: Goal 1 after ledger classification is approved
Blocks: Goal 2 project collection, Goal 4 payouts, and production rollout

### Objective

Publish the approved Terms and Privacy Notice and enforce private-by-default,
versioned, auditable consent at project submission, payout, public-profile, and
project-invitation boundaries.

### Goal acceptance

- Projects and users see approved, current, localized legal documents.
- Required acceptance is versioned and enforced at the relevant money workflows.
- Profiles remain private unless separately opted into public display.
- Invitations create no membership or member profile access before acceptance.
- Privacy behavior matches the approved data-flow inventory and role-based tests.

### Task L.1: Publish versioned project and user Terms with acceptance gates

Expected surfaces:

- `app/[locale]/(public)/terms/page.tsx` and legal-page components;
- approved localized message content and metadata;
- forward migrations for legal-document versions and acceptance records;
- typed Edge Function acceptance commands under `supabase/functions/` and `lib/`;
- founder project payment/contribution surfaces and user earnings/payout surfaces;
- Terms, acceptance, money-flow, RLS, and E2E tests.

Scope:

- Publish counsel-approved ownership, no-refund, discretionary refund, no-escrow,
  best-effort payout, currency availability, fees, expiry, holds, and provider/chain
  disclosures.
- Require the current project Terms before submitting project funds.
- Require the current applicable user/Stripe terms before payout onboarding or
  request, without representing that request transfers ownership.
- Record actor, document/version hash, locale, effective version, timestamp, and
  source surface; require reacceptance for approved material changes.

Non-goals:

- Writing unreviewed jurisdiction-specific legal conclusions.
- Conflating optional public-profile or project-membership consent with general
  Terms acceptance.

Validation:

- focused legal route/metadata/acceptance/RLS tests;
- local founder cannot submit funds without current acceptance;
- local user cannot enter the protected payout action without current acceptance;
- existing unrelated public routes remain accessible;
- `pnpm typecheck` and affected Vitest/Playwright suites.

Stop condition: approved Terms are published and gates are locally proven, followed
by session-log update and commit.

### Task L.2: Publish a truthful Privacy Notice and public-profile consent

Depends on: legal/accounting approval Task
Blocks: Task L.3

Expected surfaces:

- `app/[locale]/(public)/privacy/page.tsx`, cookies/legal navigation, and message
  catalogs;
- `components/account/fundloop-profile-panel.tsx`, account settings, onboarding
  visibility controls, and `lib/public-discovery.ts`;
- forward migrations for document versions and separate profile-publication consent;
- typed profile visibility command and privacy/public-discovery tests.

Scope:

- Publish approved no-sale/no-rental/no-unrelated-voluntary-disclosure language plus
  truthful processor, legal, Stripe/Cubid, email/hosting, retention, rights, and
  Base public-chain disclosures.
- Keep personal profiles private by default.
- Require separate affirmative public-profile consent; no preselected public option.
- Allow prospective withdrawal that immediately removes public discovery while
  retaining legally required audit/financial records.
- Store version, fields/scope, locale, timestamp, and source surface.

Non-goals:

- Promising that no processor or legally compelled disclosure ever occurs.
- Deleting immutable financial/security records when public consent is withdrawn.

Validation:

- public-discovery/RLS tests prove private profiles never appear;
- onboarding/account smoke proves explicit opt-in and prospective withdrawal;
- policy text matches the approved data-flow inventory;
- localized legal route and accessibility checks;
- `pnpm typecheck` and affected Vitest/Playwright suites.

Stop condition: Privacy Notice and public-profile consent are locally green,
session-logged, and committed.

### Task L.3: Enforce invitation acceptance and project-scoped profile sharing

Depends on: Task L.2

Expected surfaces:

- `supabase/migrations/20260805143000_project_invitations.sql` through a new
  forward-only migration;
- `lib/invitations/project-invitation-command.ts` and typed invitation Edge Functions;
- `components/project-invitation-acceptance.tsx`, founder invitation panel, and
  project member read models/components;
- invitation, RLS, profile-field, email, and persona tests.

Scope:

- Preserve pending invitations without creating participants, organization members,
  or profile access.
- Present the project, role, approved profile-field sharing, and current policy
  version before affirmative acceptance.
- Atomically record acceptance and only then create membership/participation.
- Share only the approved personal-profile fields with authorized members of that
  project; prevent unrelated-project and pre-acceptance access.
- Support decline/revocation/expiry and versioned acceptance evidence without
  leaking invitation tokens.

Non-goals:

- Automatically adding invited email addresses to projects.
- Cross-project member directories or profile correlation.
- Making the accepted member's profile public on the internet.

Validation:

- migration and command tests prove no membership before acceptance;
- RLS/read-model tests for inviter, invitee, accepted member, unrelated project, and
  public roles;
- browser smoke covers invite, inspect sharing disclosure, accept, and scoped member
  visibility;
- persona cleanup proves zero invitation/membership/consent residue;
- `CI=1 pnpm check` for the completed Goal batch.

Stop condition: invitation and project profile-sharing controls are independently
validated, session-logged, and committed.

## Goal 1: Establish the canonical ledger and epoch control plane

Depends on: architecture Task and legal/accounting approval Task

### Objective

Introduce an additive, immutable financial source of truth and the approved gated
epoch orchestration while preserving compatibility with current monthly-cycle
workflows.

### Goal acceptance

- Exact native and USD balances can be posted, reversed, trial-balanced, and
  reconciled in local Supabase.
- Existing pages and tests remain functional through compatibility projections.
- Stage attempts are idempotent and cannot skip hard gates.
- Shadow operation creates no user-visible payable or external transfer.

### Task 1.1: Add asset, custody, ledger, and accounting-period foundations

Expected surfaces:

- forward migrations under `supabase/migrations/`;
- `types/supabase.ts`;
- new financial domain helpers under `lib/accounting/`;
- typed Edge Function/shared posting contract under `supabase/functions/_shared/`;
- focused tests under `tests/` and local seed/docs updates.

Scope:

- financial assets and custody accounts;
- ledger accounts, periods, transactions, and postings;
- atomic idempotent posting and reversal functions;
- exact native atomic amounts plus USD functional amounts;
- retained financial references, RLS, least privilege, FK/partial indexes, and audit
  evidence.

Validation:

- local Supabase migration/reset/seed;
- generated type diff review;
- focused balance, reversal, idempotency, RLS, deletion-retention, and query-plan
  tests;
- `pnpm typecheck` and affected Vitest suites.

Stop condition: foundations are locally green and committed with a session log; no
legacy financial path has been switched.

### Task 1.2: Add the gated epoch state machine and scheduler

Depends on: Task 1.1

Expected surfaces:

- migrations for stage attempts, gate results, business calendar, and artifacts;
- `lib/monthly-cycles/` stage orchestration;
- typed Edge Functions and scheduled-function configuration under `supabase/`;
- `/[locale]/admin/cycles` and observability read models;
- stage/idempotency/concurrency tests.

Scope:

- approved 12-stage state machine;
- Pacific cutoff, email-relative opt-out, expiry, and close triggers;
- hard/soft gates, single-admin audited overrides, pause/resume/retry;
- advisory locking, optimistic state guards, `SKIP LOCKED` queue claims, and
  compatibility mapping to the legacy enum.

Validation:

- deterministic fake-clock transitions across DST/month/holiday boundaries;
- concurrent cron/manual attempt tests;
- operator state/attempt visibility smoke;
- no external call while a database lock is held.

Stop condition: the new engine runs in shadow mode without changing legacy outcomes.

### Task 1.3: Add external-event ingestion, shadow journals, and reconciliation

Depends on: Tasks 1.1 and 1.2

Expected surfaces:

- external financial event, funding application, and reconciliation migrations;
- `lib/accounting/`, `lib/payments/`, and operator reconciliation read models;
- Edge Function ingestion/posting commands;
- trial-balance/reconciliation report tests and docs.

Scope:

- immutable provider/chain events and dedupe;
- custody reconciliation by account and asset using the confirmed tolerance;
- shadow receipt, fee, allocation, and payout journals from fixtures;
- unmatched/suspense workflows and close-package scaffolding;
- explicit classification of legacy timestamps as non-settlement evidence.

Validation:

- duplicate/out-of-order event tests;
- receipt application cannot exceed settled native amount;
- exact native/functional conservation and variance classification;
- shadow totals compared to existing operational projections without cutover.

Stop condition: shadow reconciliation is green and differences are explained; no
canonical allocation switch.

## Goal 2: Collect and reconcile settlement-backed project packages

Depends on: Goal 1 and Goal L

### Objective

Make Stripe and Base settled receipts, paired with versioned project user lists,
the only fundable inputs available to later epoch locking.

### Task 2.1: Implement Stripe USD/CAD bank-transfer intake and reconciliation

Expected surfaces:

- a Stripe adapter under `lib/execution/adapters/` and typed contracts;
- signed webhook Edge Function(s) under `supabase/functions/`;
- founder payment UI/read models under `app/[locale]/(app)/projects/`;
- Stripe fixture/sandbox tests and `docs/engineering/env-and-testing.md`.

Scope:

- server-side USD/CAD bank-transfer instructions;
- event signature validation, dedupe, ordering, availability evidence, fees, refunds,
  disputes, and balance reconciliation;
- clearing and separated treasury sweep evidence according to approved topology;
- no cards or pull-based debits.

Validation:

- Stripe CLI/sandbox success, duplicate, delayed availability, reversal, mismatch,
  and webhook replay cases;
- no secret/provider payload leakage;
- local founder flow stops pending until availability evidence exists.

Stop condition: sandbox funds can be ingested and shadow-journaled; no live mode.

### Task 2.2: Implement Base stablecoin intake with separate treasuries

Depends on: Task 2.1 only for shared receipt contracts, not rail behavior

Expected surfaces:

- new version under `contracts/src/`, deployment scripts/manifests, and Hardhat tests;
- `lib/onchain/` runtime/deployment/reconciliation code;
- Base reference-data migrations and typed Edge Function commands;
- local-chain/Base Sepolia smoke documentation.

Scope:

- allowlisted Base USDC/USDT/PYUSD contract addresses;
- gross receipt, snapshotted project fee, net epoch amount, and separate treasury
  addresses/events;
- pause, ownership/configuration, finality, reorg/replacement, and independent
  receipt reconciliation;
- no arbitrary token or production deployment.

Validation:

- `pnpm --dir contracts test`;
- local wallet intake and malicious-token/fee/treasury/pause tests;
- Base Sepolia evidence when credentials are authorized;
- deployment manifest/database audit remains fail-closed.

Stop condition: non-production receipts reconcile to exact treasury balances.

### Task 2.3: Implement versioned project packages and reconciliation review

Depends on: Tasks 2.1 and 2.2

Expected surfaces:

- versioned project package/validation/Cubid/compliance migrations;
- founder contribution and attribution workspaces;
- operator reconciliation workspace and public preliminary report route;
- email Edge Function/template and typed commands;
- package/privacy/clock/email/Cubid tests.

Scope:

- atomic list/payment pairing and rollover lineage;
- rerunnable pre-cutoff validation tool;
- frozen post-cutoff package and only approve/opt-out actions;
- accepted-delivery-relative deadline and silence-as-approval;
- project KYB/KYC/sanctions gates;
- valid/whitelisted Cubid, uniqueness score, remediation, holds, pseudonyms, and
  greylist/blacklist email events;
- exact preliminary project totals/counts without user identifiers.

Validation:

- missing list or payment rolls both forward;
- opt-out preserves one project fee and defers base fee;
- project-scoped pseudonyms cannot correlate across projects;
- invalid/whitelist/greylist/blacklist and Cubid outage TTL matrix;
- founder browser smoke including delivered reconciliation email.

Stop condition: only approved or silent-approved, settled packages can reach the
next Goal's lock candidate set.

## Goal 3: Allocate only funded epoch value

Depends on: Goal 2

### Objective

Execute monthly valuation, fees, carryover, locking, deterministic Cubid-score
discounting, global low-earner redistribution, and provisional award posting
entirely from reconciled custody-backed inputs.

Goal invariants:

- equal theoretical funded project share per eligible user;
- initial project claim equals theoretical share multiplied by locked Cubid score
  divided by the versioned locked maximum score;
- baseline is the largest single-project score-adjusted initial claim; exact cap is
  `3 ×` baseline and the canonical retained/final cap is that value floored to the
  allocation minor unit;
- before redistribution, aggregate initial is clamped to cap; if aggregate exceeds
  cap, every project/source initial lot is scaled by `cap / aggregate`, retained
  proportionally, and its exact difference becomes source-linked overlap overflow;
- one global pool equals score-discount shortfalls plus overlap-cap overflow, and
  clamped current totals are raised lowest-first through stable deterministic
  water-filling;
- capped users and zero-baseline users receive no top-up;
- cap-aware residual assignment skips any user/source whose next unit would cross
  cap and keeps rejected exact fractions or minor units source-linked in the global
  pool or returned/carryover residue;
- top-ups and returned/carryover residue retain project, rail, asset, native, FX,
  and functional-USD provenance; and
- redistribution is funded principal, not fee, revenue, treasury sweep, payable,
  or production value flow.

### Task 3.1: Implement monthly FX, fee, expiry, and carryover accounting

Expected surfaces:

- FX observation/snapshot, fee assessment, expiry, carryover, and
  redistribution-source migrations;
- `lib/monthly-cycles/`, `lib/accounting/`, scheduled Edge Functions, and operator
  review UI;
- monthly valuation, fee journal, expiry, carryover, and variance tests.

Scope:

- primary/fallback/reasonability/preanalysis/review/approval/post rate workflow;
- one-admin manual rate only after source exhaustion;
- stablecoin `+/-0.3%` pause;
- 1% default project fees with rail clamps, 2.5% base fee per rail, and treasury
  sweeps;
- three-month expiry, reserved-claim protection, old-epoch harvest, and inventory
  exchange for queued payouts;
- preserve every post-fee distributable source by project, rail, asset, native
  quantity, FX snapshot, and functional USD; and
- keep redistribution-pool principal and cap-exhausted residue source-linked and
  outside fee, revenue, and payable classifications.

Validation:

- first-of-month and DST/timezone fixtures;
- fee min/max and no-double-project-fee cases;
- depeg, missing-source, manual-rate, FX gain/loss, expiry, and conservation tests;
- prior epoch closes only after successful harvest.

Stop condition: fee-processed and carryover-complete assets are provably backed,
provenance-complete, and ready to lock without calculating claims or moving value.

### Task 3.2: Lock settled pools and allocate by verified uniqueness

Depends on: Task 3.1

Expected surfaces:

- `lib/monthly-cycles/monthly-cycle-lock-command.ts` and calculation-package code;
- `lib/monthly-cycles/mvp-distribution-calculator.ts`;
- allocation migrations/types/artifacts and operator calculation surfaces;
- deterministic/property tests and compatibility fixtures.

Scope:

- lock only funding applications and journal-backed available epoch balances;
- eliminate declared contribution amount as canonical pool input;
- include approved project packages, fixed FX, fees, carryover, Cubid whitelist, and
  locked score/max evidence in the manifest;
- divide each funded project pool equally across eligible users;
- calculate `initial claim = theoretical share × locked score / locked max score`
  and create source-linked score-discount shortfall lots;
- aggregate user initial claims, define baseline as the largest single-project
  initial claim, set exact cap to `3 ×` baseline, floor it to the allocation minor
  unit as the canonical cap, and clamp aggregate initial before redistribution;
- when aggregate exceeds cap, apply one exact `cap / aggregate` factor to every
  project/source initial lot and move each difference into the pool as overlap-cap
  overflow; start water-filling from the canonical retained target, namely floored
  `min(aggregate, exact cap)` bounded by the floored minor-unit cap;
- define the global pool as score-discount shortfalls plus overlap-cap overflow;
  capped and zero-baseline users receive no top-up;
- use aggregate initial claim, baseline, then stable user ID for ties and assign
  minor-unit rounding deterministically;
- apply cap scaling in exact decimals, allocate retained source residuals by
  fractional remainder then stable project/rail/asset/source-lot key, and derive
  each overflow lot as original minus retained so native and USD units conserve;
  never let retained-lot or final-award rounding cross the floored cap, skip capped
  residual candidates, and keep rejected fractions/units source-linked in the
  pool or returned/carryover residue;
- preserve project/rail/asset/native/FX/USD provenance for initial claims, top-ups,
  returned residue, and payout eligibility;
- deterministic rerun and material-change comparison.

Validation:

- no-receipt/no-allocation invariant;
- invalid score/max, pre-redistribution cap, zero-baseline, arbitrary-overlap,
  input-permutation, asset/native/USD conservation, privacy, and source
  attribution;
- repeat run equivalence;
- canonical A+B fixture: A `$300`, `5/10/15` of `20` gives `$25/$50/$75`
  initial and `$150` pool; B `$1,000`, 100 users each exactly `10/20` gives `$500`
  initial and `$500` pool; because the three A users also use B, the combined
  `$650` goes first to the 97 B-only lowest earners;
- four-project overlap fixture `[100,100,100,100]`: aggregate `$400`, baseline
  `$100`, cap `$300`, four retained `$75` source lots, four `$25` overflow lots,
  then water-fill only uncapped users; and
- fractional cap fixture: four `$0.335` lots yield aggregate `$1.34`, baseline
  `$0.335`, exact cap `$1.005`, canonical cent cap `$1.00`, and four `$0.25`
  retained lots; `$0.335` proportional overflow plus the cap-rejected `$0.005`
  exact remainder stays source-linked as `$0.34` pool/residue and the user never
  receives `$1.01`; and
- arbitrary-overlap cap-aware randomized properties conserve exact decimals and
  integer minor units independently, with no lost/double-assigned unit; and
- old point-proportional results are explicitly superseded and intentional
  differences documented.

Stop condition: reviewed allocation is reproducible but payouts remain closed.

### Task 3.3: Post approved user awards and publish the epoch close package

Depends on: Task 3.2

Expected surfaces:

- bookkeeping-credit and journal posting commands;
- reporting/storage artifacts and public/project/user/operator read models;
- admin review and payout-readying UI;
- close-package, notification-audience, and report privacy tests.

Scope:

- one admin approves exact lock/result hashes;
- post approved provisional award-control records and asset eligibility from
  approved results,
  without recognizing user ownership before payout is processed;
- publish exact approved project totals/counts without user identifiers or
  cross-project membership inference;
- persist theoretical shares, score/max, initial claims, aggregate/baseline/cap,
  retention factors, retained source lots, score-discount contributions,
  overlap-cap overflow, pre-redistribution current, top-ups, final allocations, and
  source-linked residue;
- generate trial balance, custody, project funds, fee, FX, carryover, initial claim,
  redistribution pool, top-up, returned-residue, provisional award, and exception
  artifacts under one root hash, without payable classification;
- align payout thresholds and verify inventory/routes/paymaster before opening.

Validation:

- award-control balances equal approved allocations without creating user-owned
  liabilities before payout processing;
- original initial lots equal retained lots plus overlap-cap overflow; retained
  initials plus both pool-contribution classes reconcile to funded sources; both
  pool-contribution classes equal top-ups plus residue;
- report totals reconcile to journal and artifacts reproduce;
- role-scoped privacy tests;
- payout window cannot open before every hard gate passes.

Stop condition: the epoch is `payout_readying` or `payout_open` with a valid close
package and no external payout yet required.

Production allocation, award posting, provider calls, and real value flow remain
fail-closed throughout Goal 3.

## Goal 4: Execute auditable multi-rail payouts

Depends on: Goal 3 and Goal L

### Objective

Replace credited-but-not-paid projections with one inventory-backed withdrawal path
that can settle and reconcile Base and Stripe payouts.

### Task 4.1: Unify partial withdrawals, inventory reservations, holds, and queues

Expected surfaces:

- withdrawal/payout/reservation/hold migrations and `types/supabase.ts`;
- `lib/withdrawals/`, `lib/execution/`, user earnings/account workspaces, and typed
  Edge Function contracts;
- reservation concurrency, expiry, hold, and idempotency tests.

Scope:

- partial USD requests consuming credits oldest-first;
- one `rail x asset x destination` per request;
- exact native amount at originating epoch FX;
- project-linked eligible asset shortlist and inventory visibility;
- atomic exact inventory reservation, deterministic sequence, cancellation,
  compliance hold, and next-epoch queue;
- one live withdrawal-backed payout intent; retire direct result-based intents.

Validation:

- concurrent requests cannot double-reserve credits or inventory;
- $10 Stripe/$5 Base thresholds and 0%–100% user fee snapshots;
- depleted inventory queues without creating an unbacked liability;
- timely requests survive epoch expiry.

Stop condition: every payable is either available, reserved, queued, held, paid, or
explicitly closed through one obligation path.

### Task 4.2: Execute and reconcile Base Safe/paymaster payouts

Depends on: Task 4.1

Expected surfaces:

- EVM execution adapter, Safe/module integration, and payout reconciliation;
- paymaster funding/policy helpers and operator controls;
- Vercel/Supabase environment documentation without secrets;
- local/Sepolia Safe, signer, paymaster, replay, and reconciliation tests.

Scope:

- separate epoch/platform Safes;
- audited allowance/module for the limited Vercel-held signer;
- asset allowlist, destination/request binding, transaction/cumulative thresholds,
  expiry, pause, rotation, revocation, and master-threshold path;
- user fee transfer, recipient transfer, gas sponsorship, finality, replacement, and
  paid journal.

Validation:

- over-limit, wrong-token, wrong-recipient, replay, revoked signer, depleted
  paymaster, failed/replaced transaction, and reorg cases;
- paid status requires matched finalized receipt and balanced journal;
- controlled-value Sepolia smoke when authorized.

Stop condition: Base payout checkpoints are executable in non-production with no
production keys or funds.

### Task 4.3: Onboard and pay users through Stripe Connect

Depends on: Task 4.1

Expected surfaces:

- Stripe connected-account migrations and adapter commands;
- hosted onboarding routes/components under user account/earnings workspaces;
- signed webhook ingestion and payout reconciliation;
- Stripe sandbox browser and event tests.

Scope:

- hosted onboarding/account update and capability/readiness state;
- redacted USD/CAD payout routes;
- payout creation with idempotency, user fee handling, failure/remediation, trace
  references, and external reconciliation;
- no raw bank credentials or live-mode activation.

Validation:

- incomplete onboarding, requirements changes, payout success/failure, disabled
  external account, duplicate/out-of-order webhook, and reconciliation report cases;
- user route UI and sandbox payout smoke;
- paid state requires provider settlement and journal.

Stop condition: Stripe sandbox payout checkpoints are executable and reconciled.

## Goal 5: Prove migration and operational readiness

Depends on: Goals 1–4

### Objective

Safely cut over the canonical financial path and produce local/non-production proof
across founder, user, and operator journeys without overstating live readiness.

### Task 5.1: Cut over legacy financial projections without duplicate obligations

Expected surfaces:

- forward migration/backfill commands and reconciliation reports;
- legacy payment, cycle, credit, withdrawal, and payout-intent commands;
- compatibility read models, feature flags, runbook, and rollback/forward-fix docs;
- shadow equality and opening-balance fixtures.

Scope:

- classify each legacy row as externally verified, approved opening balance, legacy
  unverified, or reversed/voided;
- switch allocation to funding applications and credits to posted liabilities;
- retire direct published-result payout-intent creation;
- preserve hashed artifacts and prevent duplicate user obligations;
- use reversible feature flags and forward fixes, not destructive remote resets.

Validation:

- old/new shadow reconciliation and explicit difference report;
- no lost or duplicated credits/requests/intents;
- local migration from representative pre-feature state;
- full Node 22 `CI=1 pnpm check`.

Stop condition: canonical path is active locally/non-production and legacy writes are
disabled or explicitly retained read-only.

### Task 5.2: Extend the operator and five-persona operational matrix

Depends on: Task 5.1

Expected surfaces:

- `tests/e2e/` persona definitions/checkpoints/fixtures/reporting;
- local Supabase/Mailpit/Stripe fixture/Base local-wallet orchestration;
- `docs/engineering/persona-happy-path-harness.md`, validation record, and operations
  runbook;
- sanitized screenshots and machine-readable summaries.

Scope:

- project/user Terms acceptance, no-refund/no-escrow/best-effort disclosures, and
  material-version reacceptance;
- private-by-default profile, explicit public opt-in/withdrawal, pending invitation
  with no membership, affirmative acceptance, and project-scoped member sharing;
- founder validation, settlement, reconciliation email, approve/opt-out, and reports;
- user Cubid remediation, asset eligibility, partial/queued payout, fee, and
  settlement;
- returning member/founder equivalents;
- operator twelve-stage run, FX review, gates, allocation rerun, paymaster, payout,
  expiry, and close;
- Stripe USD/CAD and Base USDC/USDT/PYUSD happy paths plus high-risk failure matrix.

Validation:

- local operator and all-five-persona matrix with zero owned residue;
- remote-safe hosted smoke that labels sandbox, stubbed, pending, and real provider
  capabilities exactly;
- full Node 22 `CI=1 pnpm check`, contract tests, migration checks, and artifact
  sanitization.

Stop condition: the Feature has independently validated evidence, documented
production blockers, and no falsely green unavailable capability.

## Proposed dependency order

```text
Brainstorm Task
  -> Architecture Task
  -> Legal and accounting approval Task
  -> Goal L legal/privacy/consent controls and Goal 1 ledger/control plane
  -> Goal 2 settlement-backed collection
  -> Goal 3 funded allocation
  -> Goal 4 auditable payouts
  -> Goal 5 migration and operational proof
```

The architecture/legal Tasks, Goal L, and Goal 1 schema Tasks are hard predecessors
for money-moving product surfaces. Goal L and Goal 1 may proceed in parallel after
the legal/accounting Task resolves their shared contracts. Tasks 2.1 and 2.2
may run in parallel after shared external-event contracts exist. Tasks 4.2 and 4.3
may run in parallel after Task 4.1. All other sequencing is intentionally linear to
avoid competing financial sources of truth.

## GitHub publication record

Published on 2026-08-08 as [Feature #118](https://github.com/FundLoop/fundloop-website/issues/118):

- coordination Tasks: #119-#121;
- legal/privacy Goal and Tasks: #122-#125;
- ledger/control-plane Goal and Tasks: #126-#129;
- collection/reconciliation Goal and Tasks: #130-#133;
- allocation Goal and Tasks: #134-#137;
- payout Goal and Tasks: #138-#141;
- migration/readiness Goal and Tasks: #142-#144.

Verified after publication:

- 27 issues total: one native Feature, six native Goals, and twenty native Tasks
  (including the three coordination Tasks and seventeen implementation Tasks);
- every issue is in `FundLoop Project` with status `Scoped` and priority `High`;
- every issue has labels `enhancement` and `codex`, with no assignee;
- native parent/sub-issue and blocked-by relationships match the dependency plan;
- issue titles are unique within the tree;
- issue vetting and any transition to `Ready` remain a separate orchestration step.

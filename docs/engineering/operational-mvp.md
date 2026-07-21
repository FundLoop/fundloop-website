# FundLoop Operational MVP

Last drafted: 2026-07-20

Related docs:
- [Engineering Docs Index](./README.md)
- [Backgrounder for Agents](./backgrounder-for-agents.md)
- [Target-State Architecture](./target-state-architecture.md)
- [Monthly Cycle Domain Model](./monthly-cycles.md)
- [Allocation Architecture](./allocation.md)
- [Outbound Payout Domain](./payouts.md)
- [Reporting Publication](./reporting.md)

## Summary

Operational MVP means FundLoop can run one complete monthly bookkeeping cycle from project signup to user-visible credited earnings, without executing real outbound payouts.

The MVP must support:

- project signup with a contribution commitment
- project monthly contribution submission
- project attribution data submission
- user signup with CUBID linkage and payout-asset priorities
- monthly cycle lock
- deterministic capped equalization allocation
- operator verification and approval
- bookkeeping earnings credited to user accounts
- no actual payout execution

The MVP is successful only when a seeded or Preview/dev run proves one full cycle end to end and records sanitized evidence.

## Product Contract

### Personas

- Founder/project admin: creates a project, commits a contribution percentage, submits monthly contribution data, and submits attribution data.
- Regular user: signs up, links CUBID, sets payout-asset priorities, participates in projects, and sees credited earnings.
- Internal operator: locks cycles, reviews prep exceptions, runs calculation packaging, verifies or approves results, and creates bookkeeping credits.
- Agent: may read the same workflow state through MCP-safe read surfaces, but MCP write expansion is not required for this MVP.

### In Scope

- CUBID linkage required for user publish and project/founder publish.
- Contribution commitments stored as explicit project policy.
- Monthly contribution submissions attached to `monthly_cycles`.
- Attribution datasets attached to `monthly_cycles`.
- Deterministic calculation from locked cycle inputs.
- Earnings ledger credits in bookkeeping state only.
- Source-currency and USD-equivalent reporting.
- User payout-asset priorities for future settlement planning.

### Out Of Scope

- Real outbound payout transfer execution.
- External fiat provider integration.
- Production MCP publication.
- Advanced anti-fraud or rate-limit systems beyond existing CUBID/linkage gates.
- Complex governance or formula configurability.
- Real-time FX oracle integration.

## Core Workflow

### 1. Project Signup And Commitment

A founder signs in, links CUBID, creates a project, and commits a contribution percentage.

Required behavior:

- Project publish requires founder CUBID status `linked` or `verified`.
- Project commitment includes contribution percentage and default reporting currency.
- Founder workspace shows commitment status and current-cycle readiness.
- Project commitment is canonical product data, not only onboarding draft JSON.

Acceptance criteria:

- A seeded founder can create a project with a visible contribution commitment.
- The project appears in `/founder`, `/founder/projects`, and `/founder/projects/[slug]`.
- Missing commitment blocks MVP monthly-cycle readiness for that project.

Local smoke anchor:

- `maya@fundloop.example.com` / `FundLoopFounder123!` manages `civic-mesh`.
- `civic-mesh` carries an explicit `1.00%` commitment and `USD` default reporting currency in `supabase/seed.sql`.
- Expected founder smoke routes are `/en/founder`, `/en/founder/projects`, and `/en/founder/projects/civic-mesh`.

### 2. Project Monthly Contribution Submission

A founder/project admin submits monthly contribution data for a cycle.

Minimum input:

- `projectSlug`
- `cycleKey`
- `periodStart`
- `periodEnd`
- `sourceCurrency`
- `sourceAmount`
- `usdEquivalentAmount`
- `commitmentPercentage`
- `calculatedContributionAmount`
- optional source transaction/payment reference
- optional notes

Rules:

- Submission requires project admin/member authorization.
- Cycle must be `open`.
- Period must match the cycle bounds.
- Amounts must be non-negative.
- `usdEquivalentAmount` is required for MVP; no live FX oracle is used.
- One current submitted contribution record per project/cycle is canonical. Edits before lock may replace or version the draft, but lock consumes one final submission.

Acceptance criteria:

- Contribution submission appears in founder and operator cycle views.
- Missing submission creates a prep/lock warning.
- Submitted contribution data is included in the lock manifest.

### 3. Project Attribution Submission

A founder/project admin submits attribution data that identifies which users contributed value.

Minimum row shape:

- `userId` or resolvable user email/handle
- scoped CUBID identity for the project/protocol context
- `projectSlug`
- `cycleKey`
- `attributionPoints`
- optional category/role label
- optional evidence note/reference

Rules:

- Scoped CUBID identity is required for every attribution row.
- FundLoop user id or resolvable email/handle may be included when available for MVP operator/debug visibility.
- Attribution rows must resolve to FundLoop users before approval.
- Only CUBID-linked users are eligible for distribution.
- Attribution datasets have status `draft`, `submitted`, `approved`, or `rejected`.
- Only `approved` datasets are included in lock/calculation.
- Attribution points may be zero or positive; negative points are invalid.
- Duplicate users in one project/cycle dataset are either rejected or normalized into one summed row before approval.

Acceptance criteria:

- Project can submit attribution rows for a cycle.
- Attribution rows include scoped CUBID identities and resolve to FundLoop users before approval.
- Operator can see approval state.
- Approved attribution dataset is attached to `monthly_cycle_id`.
- Calculation rejects cycles with no approved attribution unless an operator explicitly overrides with a documented reason.
- MVP preserves internal project-level transparency as an intentional tradeoff. zkActivitySum is the future replacement for raw attribution visibility, not a live MVP claim.

### 4. User Signup And Asset Priorities

A user signs up, links CUBID, completes the basic profile, and sets payout-asset priorities.

Priorities mean the user ranks which assets they prefer to receive in future payout settlement.

Priority options for MVP:

- eligible project tokens
- supported stablecoins
- preferred fiat currency

Rules:

- Priorities do not change the user's earned USD bookkeeping amount in MVP.
- Priorities affect future settlement planning/readiness only.
- Users may reject all tokens, but the UI must warn that rejecting available tokens may reduce eventual realized value or delay settlement.
- If no preference is set, the default order is stablecoin, fiat, then project tokens.
- Priorities are editable after onboarding from workspace/account or earnings settings.

Minimum data model:

- `user_asset_preferences`
- `user_id`
- `rank`
- `asset_type`: `project_token | stablecoin | fiat`
- `asset_code`
- optional `project_id`
- `accepted`
- timestamps

Issue #70 implements this as the `user_asset_preferences` table plus the typed `user-asset-preferences-update` Edge Function command. The command replaces the authenticated user's custom preference set with deterministic ranks based on submitted order. An empty custom set means downstream read models should apply the default order: stablecoin, fiat, then project tokens. These rows are asset-selection preferences only; they are not payout destinations, rails, bank details, wallet addresses, or proof of payment readiness.

Issue #71 surfaces those preferences in `/workspace/account` as an editable asset-priority panel and in `/workspace/earnings` as read-only readiness context. The UI intentionally says preferences affect future settlement planning only. It also warns when a user rejects all project-token assets so users can make that tradeoff deliberately without implying that any transfer has happened.

Acceptance criteria:

- User can publish profile with CUBID linked.
- User can set and update ordered asset preferences.
- `/workspace` and `/workspace/earnings` show preference readiness and warnings.
- Rejecting all tokens displays a clear warning.

### 5. Monthly Cycle Lock

An internal operator locks an open cycle.

Rules:

- Lock uses the existing `monthly-cycle-lock` command boundary.
- Lock reattaches month-bearing rows to the target cycle before reading.
- Lock manifest includes cycle identity/bounds, project contribution submissions, confirmed or submitted payment/contribution records, approved attribution datasets with scoped CUBID identity references, eligible users and CUBID snapshot summaries, user asset preference summaries, counts, and checksums.
- Lock blocks unresolved required inputs by default.
- Operator override requires explicit reason and audit event.

Acceptance criteria:

- Lock creates deterministic `locked_manifest` and `locked_manifest_hash`.
- Locked manifest contains all MVP inputs.
- Repeated lock attempts fail safely once status is no longer `open`.
- Calculation work starts from `locked_manifest.mvp_inputs`, including contribution submissions, approved attribution datasets/rows, eligible users, CUBID snapshots, and destination-free asset preference summaries, not from live mutable rows.

### 6. Deterministic Allocation Calculation

The MVP allocation formula is defined in [Allocation Architecture](./allocation.md). Calculation uses only locked manifest inputs.

Definitions:

- Monthly pool USD = system-price-normalized value of confirmed available project contribution pools.
- Project pool USD = each project's confirmed available contribution amount normalized through the cycle price snapshot.
- Eligible user = CUBID status `linked` or `verified` at lock time with approved attribution for the contributing project/month.
- User raw project entitlement = project pool USD multiplied by the user's approved attribution share within that project.
- User baseline = the largest single-project raw entitlement for that user.
- Equalization remainder = monthly pool USD minus the sum of user baselines.
- User final allocation = baseline plus capped equalization top-up, capped at `3x` the user's baseline.
- Asset fulfillment = selected asset credit fills based on the user's highest-priority accepted available assets.
- Source-currency/project breakdown is retained for reporting, while canonical credit value is USD equivalent.

Rounding:

- Round after USD normalization.
- Store exact decimal calculation inputs and rounded credited amounts.
- Assign rounding residual deterministically to users by descending unrounded remainder, then stable user id sort.

Outputs:

- per-user result rows
- per-project/user attribution rows
- selected asset fill rows
- returned future-pool rows for unfulfillable amounts
- total pool USD
- source-currency breakdown
- calculation artifact hash
- warnings for excluded users or unresolved attribution

Acceptance criteria:

- Same locked manifest produces same result hash.
- Allocated USD plus returned future-pool USD equals total monthly pool USD after deterministic rounding.
- No user final allocation exceeds `3x` baseline.
- Ineligible users are excluded with reason codes.
- Calculation creates artifacts in Supabase Storage and result rows linked to `monthly_cycle_id`.

### 7. Verification And Approval

Operators review calculated results before credits become visible as approved earnings.

Verification checks:

- manifest hash matches calculation package input
- all included projects have approved contribution submissions
- all included attribution datasets are approved
- all included users are CUBID-linked at lock time
- allocated USD plus returned future-pool USD equals monthly pool USD after rounding
- no user allocation exceeds the `3x` baseline cap
- asset fills respect accepted preference order and recorded availability
- no negative credits
- artifact hashes exist
- warnings are visible and acknowledged

Approval rules:

- `needs_cleanup` keeps the cycle in calculation/review state and records an operator note.
- `verified` advances to verification state.
- `approved` advances to approval state and records an operator note.
- Approval is internal-operator only.
- Approval is a pre-credit checkpoint. It does not create user credits, execute payouts, publish reports, or mark users as paid.

Acceptance criteria:

- Operator can verify or reject results with a reason.
- Approval emits monthly-cycle audit events.
- Approved results become eligible for bookkeeping credit creation.

Expected MVP state labels:

- `calculated`: deterministic allocator outputs exist and can be reviewed, but they are not verified, credited, paid, or transferable.
- `verified`: an internal operator has recorded that calculated outputs pass integrity checks.
- `approved`: an internal operator has approved verified outputs for the next bookkeeping-credit creation step.
- `credited`: a later bookkeeping command has created user-visible earnings records from approved outputs.
- `not paid`: credited earnings have not been transferred, settled, or paid out.

### 8. Bookkeeping Earnings Credits

After approval, FundLoop credits users' accounts in a bookkeeping sense.

Rules:

- No real payout execution occurs.
- Credits are created from approved user results.
- Credits are created through the typed `monthly-cycle-bookkeeping-credits-create` Edge Function command.
- Credits store selected asset fill amount, canonical USD equivalent amount, and source-currency/project breakdown for reporting.
- Returned future-pool amounts are recorded separately and are not user credits.
- Credit status starts as `credited`.
- If existing `payout_intents` are used, they must be presented as bookkeeping/not-paid-yet records unless and until a later payout execution session changes status.
- User-facing language distinguishes `credited`, `pending payout setup`, `not paid yet`, and `future settlement preference`.

Acceptance criteria:

- `/workspace/earnings` shows credited earnings by cycle.
- User can see source breakdown and USD equivalent.
- Founder/operator views show total credited by cycle/project.
- No UI claims that funds were transferred.

Handoff contract from Goal #58 / issue #81 to Goal #59:

- Input cycle status is `approval`.
- The latest completed run is verified and has passed MVP integrity checks.
- Approval audit metadata identifies `nextStep = bookkeeping_credit_creation` and `noPayoutExecuted = true`.
- Credit creation must consume persisted calculated rows and selected asset fills; it must not rerun allocation with a different policy.
- Credit creation must be idempotent by cycle/run/user/asset fill.
- Credit creation must label user-visible records as `credited` and `not paid`.

## Required Interfaces

Use typed Supabase Edge Functions for all MVP writes:

- `project-monthly-contribution-submit`
- `project-attribution-dataset-submit`
- `project-attribution-dataset-review`
- `user-asset-preferences-update`
- existing `monthly-cycle-lock`
- existing `monthly-cycle-calculation-package`
- existing `monthly-cycle-verification-review`
- existing `monthly-cycle-approval`
- existing or adapted bookkeeping credit creation command

If an existing command already covers one of these behaviors, reuse it and document the mapping rather than creating a duplicate.

Required read surfaces:

- founder project readiness summary
- operator cycle readiness/prep summary
- user workspace earnings summary
- reporting summary by cycle

Required artifacts:

- locked manifest
- calculation package
- calculation result artifact
- optional human-readable cycle summary

Artifacts must be hashable and linked to `monthly_cycle_id`.

## End-To-End MVP Smoke

Create or reuse deterministic seed fixtures:

- one internal operator
- one founder/project admin
- one project
- three users
- CUBID-linked identity snapshots
- one monthly cycle
- one project contribution submission
- one approved attribution dataset
- user asset preferences covering stablecoin, fiat, project token, and token rejection warning

Smoke path:

1. Founder creates or verifies project and commitment.
2. Users sign up/link CUBID and set asset priorities.
3. Founder submits monthly contribution.
4. Founder submits attribution dataset.
5. Operator approves attribution dataset.
6. Operator locks cycle.
7. Operator runs calculation package.
8. Operator verifies and approves result.
9. System creates bookkeeping earnings credits.
10. Users see credited earnings in `/workspace/earnings`.
11. Operator sees cycle totals and audit events.
12. Record sanitized transcript in this document or a linked validation doc.

## Test Plan

Minimum automated coverage:

- project commitment validation and publish gating
- contribution submission authorization, period validation, amount validation, and cycle status rejection
- attribution submission user resolution, approval state, duplicate handling, and cycle linkage
- user asset priority create/update/reorder/reject-all warning
- lock manifest includes contribution, attribution, CUBID snapshot, and asset preference inputs
- attribution fixtures include scoped CUBID identity references and resolved FundLoop user mappings
- calculation fixture produces deterministic known capped equalization allocations
- rounding residual assignment is deterministic
- asset fulfillment partial fills and returned future-pool amounts are deterministic
- verification catches total mismatch, missing artifact, ineligible user, and unapproved dataset
- bookkeeping credit creation is idempotent
- user earnings workspace renders credited/not-paid states
- no payout execution command is called during MVP credit creation

Required validation gates:

- `pnpm lint`
- `pnpm test`
- `pnpm typecheck`
- `pnpm build`
- local Supabase migration/reset smoke when schema changes
- Preview/dev end-to-end MVP smoke before declaring operational MVP complete

## Success Criteria

Operational MVP is complete only when:

- a project can sign up and commit
- a project can submit monthly contribution data
- a project can submit attribution data
- a user can sign up, link CUBID, and set asset priorities
- an operator can lock a cycle
- the system calculates deterministic capped equalization allocations
- an operator can verify and approve results
- users see credited bookkeeping earnings
- no actual payout is executed
- one complete cycle is proven in local or Preview/dev with recorded evidence

## Assumptions And Defaults

- User priorities are payout-asset preferences, not allocation-weight inputs.
- MVP allocation uses raw project attribution as input, then applies capped global equalization.
- USD equivalent is the canonical bookkeeping credit value.
- Source-currency amounts are stored and shown for transparency.
- USD normalization comes from the cycle system price snapshot.
- CUBID linkage is required; full phone/provider verification improves readiness but does not block MVP earning credits.
- Existing monthly-cycle, payout-intent, reporting, and zkAS structures should be reused where practical.
- Real outbound payouts remain explicitly deferred.

# FundLoop Operational MVP

Last drafted: 2026-07-20

Related docs:
- [Engineering Docs Index](./README.md)
- [Backgrounder for Agents](./backgrounder-for-agents.md)
- [Target-State Architecture](./target-state-architecture.md)
- [Monthly Cycle Domain Model](./monthly-cycles.md)
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
- deterministic contribution-weighted distribution calculation
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
- `projectSlug`
- `cycleKey`
- `attributionPoints`
- optional category/role label
- optional evidence note/reference

Rules:

- Attribution rows must resolve to FundLoop users before approval.
- Only CUBID-linked users are eligible for distribution.
- Attribution datasets have status `draft`, `submitted`, `approved`, or `rejected`.
- Only `approved` datasets are included in lock/calculation.
- Attribution points may be zero or positive; negative points are invalid.
- Duplicate users in one project/cycle dataset are either rejected or normalized into one summed row before approval.

Acceptance criteria:

- Project can submit attribution rows for a cycle.
- Operator can see approval state.
- Approved attribution dataset is attached to `monthly_cycle_id`.
- Calculation rejects cycles with no approved attribution unless an operator explicitly overrides with a documented reason.

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
- Lock manifest includes cycle identity/bounds, project contribution submissions, confirmed or submitted payment/contribution records, approved attribution datasets, eligible users and CUBID snapshot summaries, user asset preference summaries, counts, and checksums.
- Lock blocks unresolved required inputs by default.
- Operator override requires explicit reason and audit event.

Acceptance criteria:

- Lock creates deterministic `locked_manifest` and `locked_manifest_hash`.
- Locked manifest contains all MVP inputs.
- Repeated lock attempts fail safely once status is no longer `open`.

### 6. Deterministic Distribution Calculation

The MVP formula is contribution-weighted. Calculation uses only locked manifest inputs.

Definitions:

- Monthly pool USD = sum of approved project contribution `usdEquivalentAmount`.
- Project pool USD = each project's approved contribution `usdEquivalentAmount`.
- Eligible user = CUBID status `linked` or `verified` at lock time.
- User attribution share within a project = user approved attribution points / total approved points for that project.
- User project earning USD = project pool USD multiplied by user attribution share.
- User total earning USD = sum of user project earning USD across projects.
- Source-currency breakdown is retained per project contribution for reporting, but canonical credit value is USD equivalent.

Rounding:

- Calculate in integer minor units where possible.
- Store exact decimal calculation inputs and rounded credited amounts.
- Assign rounding residual deterministically to users by descending unrounded remainder, then stable user id sort.

Outputs:

- per-user result rows
- per-project/user attribution rows
- total pool USD
- source-currency breakdown
- calculation artifact hash
- warnings for excluded users or unresolved attribution

Acceptance criteria:

- Same locked manifest produces same result hash.
- Total credited USD equals total monthly pool USD after deterministic rounding.
- Ineligible users are excluded with reason codes.
- Calculation creates artifacts in Supabase Storage and result rows linked to `monthly_cycle_id`.

### 7. Verification And Approval

Operators review calculated results before credits become visible as approved earnings.

Verification checks:

- manifest hash matches calculation package input
- all included projects have approved contribution submissions
- all included attribution datasets are approved
- all included users are CUBID-linked at lock time
- total credited USD equals monthly pool USD after rounding
- no negative credits
- artifact hashes exist
- warnings are visible and acknowledged

Approval rules:

- `needs_cleanup` keeps the cycle in calculation/review state and records an operator note.
- `verified` advances to verification state.
- `approved` advances to approval state and records an operator note.
- Approval is internal-operator only.

Acceptance criteria:

- Operator can verify or reject results with a reason.
- Approval emits monthly-cycle audit events.
- Approved results become eligible for bookkeeping credit creation.

### 8. Bookkeeping Earnings Credits

After approval, FundLoop credits users' accounts in a bookkeeping sense.

Rules:

- No real payout execution occurs.
- Credits are created from approved user results.
- Credits store canonical USD equivalent amount and source-currency/project breakdown for reporting.
- Credit status starts as `credited`.
- If existing `payout_intents` are used, they must be presented as bookkeeping/not-paid-yet records unless and until a later payout execution session changes status.
- User-facing language distinguishes `credited`, `pending payout setup`, `not paid yet`, and `future settlement preference`.

Acceptance criteria:

- `/workspace/earnings` shows credited earnings by cycle.
- User can see source breakdown and USD equivalent.
- Founder/operator views show total credited by cycle/project.
- No UI claims that funds were transferred.

## Required Interfaces

Use typed Supabase Edge Functions for all MVP writes:

- `project-monthly-contribution-submit`
- `project-attribution-dataset-submit`
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
- calculation fixture produces deterministic known allocations
- rounding residual assignment is deterministic
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
- the system calculates deterministic contribution-weighted distributions
- an operator can verify and approve results
- users see credited bookkeeping earnings
- no actual payout is executed
- one complete cycle is proven in local or Preview/dev with recorded evidence

## Assumptions And Defaults

- User priorities are payout-asset preferences, not allocation-weight inputs.
- MVP distribution formula is contribution-weighted by project pool and approved attribution points.
- USD equivalent is the canonical bookkeeping credit value.
- Source-currency amounts are stored and shown for transparency.
- Projects provide or confirm USD equivalent values in MVP; no live FX oracle is added.
- CUBID linkage is required; full phone/provider verification improves readiness but does not block MVP earning credits.
- Existing monthly-cycle, payout-intent, reporting, and zkAS structures should be reused where practical.
- Real outbound payouts remain explicitly deferred.

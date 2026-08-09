# FundLoop Operational MVP

Last updated: 2026-08-09

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
- deterministic Cubid-discount and capped low-earner redistribution
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
- Lock manifest includes cycle identity/bounds, approved project packages, applied and reconciled funding sources, project/rail/asset/native/FX/USD provenance, approved project cohorts with scoped CUBID identity references, eligible users, locked score/max evidence, user asset preference summaries, counts, and checksums.
- Lock blocks unresolved required inputs by default.
- Operator override requires explicit reason and audit event.

Acceptance criteria:

- Lock creates deterministic `locked_manifest` and `locked_manifest_hash`.
- Locked manifest contains every funded source, eligible project-user count, and score/max input required to reproduce the approved model.
- Repeated lock attempts fail safely once status is no longer `open`.
- Calculation work starts from `locked_manifest.mvp_inputs`, including funded source lots, approved project cohorts, eligible users, CUBID score/max snapshots, and destination-free asset preference summaries, not from live mutable rows.

### 6. Deterministic Allocation Calculation

The MVP allocation formula is defined in [Allocation Architecture](./allocation.md). Calculation uses only locked manifest inputs.

Definitions:

- Monthly pool USD = system-price-normalized value of confirmed available project contribution pools.
- Project pool USD = each project's confirmed available contribution amount normalized through the cycle price snapshot.
- Eligible user = CUBID status `linked` or `verified` at lock time and membership in the approved locked project package/cohort for that month. Historical attribution rows may support cohort evidence, but attribution points do not weight eligibility or allocation.
- Theoretical project share = the funded project pool divided equally across that project's eligible users.
- Initial project claim = theoretical project share multiplied by locked Cubid score divided by the versioned locked maximum score.
- Project pool contribution = theoretical project share minus the initial project claim; all contributions enter one global epoch redistribution pool.
- Aggregate initial claim = the sum of one user's score-adjusted initial project claims.
- User baseline = the largest single-project score-adjusted initial claim for that user.
- Exact user cap = `3 ×` baseline; canonical minor-unit cap = floor of that exact cap to the allocation minor unit. Before redistribution, aggregate initial claim is clamped, and neither retained-lot nor final-award rounding may cross the canonical cap.
- Raw proportional retained source lot = exact initial project/source lot multiplied by `min(1, exact cap / aggregate initial claim)`; its non-negative exact difference is exact overflow. Canonical initial/retained/overflow units are derived independently, while the source-provenanced sub-minor residual bridges exact and canonical totals.
- Global epoch redistribution pool = score-discount project pool contributions plus overlap-cap overflow.
- Pre-redistribution current = the canonical retained target: floor `min(aggregate initial claim, exact cap)` to the allocation minor unit and bound it by the floored minor-unit cap. A user already at cap, including a zero-baseline user at cap zero, receives no top-up.
- User final allocation = pre-redistribution current plus the deterministic lowest-current-total-first water-filling top-up, never above the cap.
- Asset fulfillment = selected asset credit fills based on the user's highest-priority accepted available assets.
- Every initial claim, pool contribution, top-up, and returned/carryover residue retains project, rail, asset, native, FX, and USD provenance.

This replaces the prior point-proportional share and overlap-derived remainder model.
Scores are individual discounts against equal project shares, not weights divided by
the sum of cohort scores. Redistribution principal is not a fee, revenue, treasury
sweep, or payable.

Until Goal #134's accounting, privacy, custody, and production gates are satisfied,
this calculation is review-only in local/dev. Production allocation and award
posting must remain fail-closed, and project/public outputs must not expose user-level
cross-project overlap.

Rounding:

- Maintain separate exact-decimal and canonical integer-minor-unit source ledgers. Every exact source satisfies non-negative `exact initial = exact retained + exact overflow`.
- Derive canonical initial source units first against the funded canonical total using descending fractional remainder then stable project/rail/asset/source-lot ID.
- Calculate exact-decimal cap scaling before rounding.
- Floor the retained-total target to the allocation minor unit and bound it by the canonical floored cap. Assign canonical retained units by constrained largest remainder, requiring `0 <= retained minor lot <= initial minor lot` and skipping saturated or zero-capacity lots.
- Define canonical overflow units only as `initial minor lot - retained minor lot`; they are never negative.
- Move an exact fraction or candidate minor unit rejected by the cap into the global overflow pool as cap-floor overflow with its original project/rail/asset/native/FX/USD provenance; together with proportional overlap overflow it may fund another uncapped user and otherwise becomes source-linked returned/carryover residue.
- Track sub-minor exact residual and deterministic cross-source residual transfers separately with source provenance; never calculate exact overflow from a rounded retained lot.
- Apply the same stable largest-remainder rule within each rail/asset/custody group for native atomic units.
- Round after USD normalization.
- Store exact decimal calculation inputs and rounded credited amounts.
- Exact equal-current users water-fill equally; aggregate initial and baseline do not break their tie. Assign an indivisible award unit only by descending fractional remainder of exact target then stable user ID, skipping capped users and continuing to another eligible user or source-linked residue.

Outputs:

- per-user result rows
- per-project/user theoretical-share, score-factor, and initial-claim rows
- source-linked retained-initial, score-discount contribution, overlap-cap overflow,
  and redistribution-top-up rows
- selected asset fill rows
- returned/carryover residue rows with originating source provenance
- total pool USD
- source-currency breakdown
- calculation artifact hash
- warnings for excluded users or unresolved attribution

Acceptance criteria:

- Same locked manifest produces same result hash.
- Every non-negative exact initial source lot equals exact retained plus exact overflow; independently, every canonical initial source unit equals bounded canonical retained plus non-negative canonical overflow.
- Retained initial lots plus score-discount contributions plus overlap-cap overflow equal the funded pool.
- Top-ups plus returned/carryover residue equal score-discount contributions plus overlap-cap overflow.
- Final allocations plus returned/carryover residue equal total funded pool USD after deterministic rounding.
- No retained-lot target or final allocation exceeds the floored minor-unit `3 ×` baseline cap.
- The canonical A+B fixture uses 100 B users each exactly `10/20`, produces `$150 + $500 = $650` of redistribution, and sends it first to the 97 B-only lowest earners.
- The four-project overlap fixture `[100,100,100,100]` clamps `$400` to a `$300` cap, retains `$75` per source, and contributes four `$25` overflow lots before water-filling.
- The fractional fixture with four `$0.335` lots has aggregate `$1.34`, baseline `$0.335`, exact cap `$1.005`, canonical cent cap `$1.00`, four `$0.25` retained lots, `$0.335` exact overflow, 34 canonical overflow cents, and a separately source-linked `$0.005` exact-to-canonical residual; it never awards `$1.01`.
- The two-`$0.006` retained-lot/one-cent-target counterexample assigns canonical initial capacity first, retains the cent only on that source, produces no negative source overflow, and separately reconciles exact `$0.012` to one canonical cent.
- The one-cent equal-current-user fixture gives two users exact `$0.005` top-up targets; fractional remainders tie, so stable user ID alone selects the cent and input permutation leaves the result hash unchanged.
- Arbitrary overlap count and project/source input permutation properties conserve exact decimals, USD minor units, and native atomic units.
- Cap-aware residual properties prove exact-decimal conservation separately from integer minor-unit conservation, with no lost or double-assigned fractions or units.
- Ineligible users are excluded with reason codes.
- Calculation creates artifacts in Supabase Storage and result rows linked to `monthly_cycle_id`.

### 7. Verification And Approval

Operators review calculated results before credits become visible as approved earnings.

Verification checks:

- manifest hash matches calculation package input
- all included projects have approved packages and reconciled, journal-backed funded sources
- all included project cohorts and score/max snapshots are approved and locked
- all included users are CUBID-linked at lock time
- retained initial lots, both pool-contribution classes, top-ups, and source-linked returned/carryover residue conserve the monthly pool after rounding
- no user allocation exceeds the floored canonical minor-unit `3 ×` baseline cap
- users already at cap and zero-baseline users receive no top-up
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
- Returned/carryover residue is recorded by originating funded source and is not a user credit, fee, revenue, or payable.
- Credit status starts as `credited`.
- If existing `payout_intents` are used, they must be presented as bookkeeping/not-paid-yet records unless and until a later payout execution session changes status.
- User-facing language distinguishes `credited`, `pending payout setup`, `not paid yet`, and `future settlement preference`.

Acceptance criteria:

- `/workspace/earnings` shows credited earnings by cycle.
- User can see source breakdown and USD equivalent.
- Founder/operator views show permitted cycle/project totals, source-linked returned/carryover residue, and not-paid status without exposing private payout destinations or cross-project membership.
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

Local validation evidence: [Operational MVP Local Validation](./operational-mvp-local-validation.md)

Preview/dev validation evidence: [Operational MVP Preview/Dev Validation](./operational-mvp-preview-validation.md)

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

The local seed currently provides this input set with cycle `2026-05`, founder/operator `maya@fundloop.example.com`, project `civic-mesh`, one submitted Civic Mesh contribution, verified CUBID snapshots for Maya/Eli/Safiya/Jonah, and one approved raw-row attribution dataset using scoped CUBID identities for Eli, Safiya, and Jonah. The seed intentionally does not pre-create lock, calculation, approval, or bookkeeping credit outputs; those records should be produced by the MVP smoke itself.

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
- lock manifest includes funded source provenance, approved project cohorts, locked CUBID score/max, and asset preference inputs
- attribution fixtures include scoped CUBID identity references and resolved FundLoop user mappings
- canonical A+B fixture produces deterministic score-adjusted claims and `$650` lowest-earner-first redistribution
- four-project `[100,100,100,100]` fixture retains four `$75` lots, contributes four `$25` overflow lots, and excludes the capped user from top-ups
- arbitrary overlap count, source-order permutation, zero-baseline, and exact-decimal/minor-unit/native conservation properties
- rounding residual assignment is deterministic
- asset fulfillment partial fills and source-linked returned/carryover residue are deterministic
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
- the system calculates deterministic score-adjusted claims and capped low-earner redistribution
- an operator can verify and approve results
- users see credited bookkeeping earnings
- no actual payout is executed
- one complete cycle is proven in local or Preview/dev with recorded evidence

## Assumptions And Defaults

- User priorities are payout-asset preferences, not allocation-weight inputs.
- MVP allocation uses approved project membership plus locked Cubid score/max evidence; mutable activity points and point-proportional cohort weights are superseded.
- USD equivalent is the canonical bookkeeping credit value.
- Source-currency amounts are stored and shown for transparency.
- USD normalization comes from the cycle system price snapshot.
- CUBID linkage is required; full phone/provider verification improves readiness but does not block MVP earning credits.
- Existing monthly-cycle, payout-intent, reporting, and zkAS structures should be reused where practical.
- Real outbound payouts remain explicitly deferred.

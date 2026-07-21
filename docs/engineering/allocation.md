# Allocation Architecture

Last updated: 2026-07-20

Related docs:
- [Engineering Docs Index](./README.md)
- [Operational MVP](./operational-mvp.md)
- [Monthly Cycle Domain Model](./monthly-cycles.md)
- [Outbound Payout Domain](./payouts.md)

## Summary

FundLoop allocation converts confirmed monthly project contribution pools into user-visible bookkeeping credits. For the operational MVP, allocation is not a simple proportional payout. It is a deterministic, USD-normalized, capped equalization process followed by preference-based asset fulfillment.

The allocator must be implemented as a pure calculation package first. It should accept a locked monthly manifest and price snapshot, produce deterministic outputs and hashes, and avoid live reads or writes. Database persistence, artifact storage, verification, and bookkeeping credits are separate workflow stages.

## Inputs

The allocator consumes only locked monthly-cycle inputs:

- confirmed available project contribution amounts for the cycle
- project/currency/token pool identity and source amounts
- system price snapshot for USD normalization
- approved attribution datasets for the cycle
- scoped CUBID identity references on attribution rows
- CUBID-linked user eligibility snapshot captured at lock time
- user asset preferences captured at lock time
- deterministic project, user, asset, and cycle identifiers

Unconfirmed commitments, unresolved receivables, draft attribution data, and post-lock identity/preference changes are not allocation inputs.

## Eligibility

A user is eligible for a project/month allocation only when all of these are true:

- the user is CUBID-linked at lock time
- the user appears in an approved attribution dataset for the contributing project/month
- the attribution row includes the scoped CUBID identity for that project/protocol context
- the attribution row resolves to the FundLoop user identity included in the locked manifest

For the MVP, a protocol is equivalent to a FundLoop project. If a later version supports multiple protocols under one project, that must become an explicit input dimension and should not be inferred from project metadata.

## Attribution Visibility And zkActivitySum Path

The MVP intentionally preserves internal project-level transparency. Operators can inspect approved attribution rows, project contribution pools, and allocation outputs directly. Founders can inspect the attribution data they submit for their own managed projects. This is an explicit operational tradeoff so the first monthly bookkeeping cycle can be debugged and verified without depending on a privacy proof system.

Even before zkActivitySum is implemented, MVP attribution submissions must include a scoped CUBID identity for each attributed user. When available, attribution rows may also include the resolved FundLoop user id for operator/debug usability. The scoped CUBID identity is required because it is the forward-compatible bridge to privacy-preserving attribution.

zkActivitySum is the planned replacement for raw attribution visibility. In that future mode, projects submit app/project-scoped activity scores tied to scoped CUBID identities, and users or the system produce aggregate activity proofs without exposing the user's full cross-project activity graph.

Future zkActivitySum ingest should be modeled as an interchangeable attribution source, not as a separate allocator. Allowed verifier backends are:

- `tee`
- `zk`

The MVP does not choose between TEE and ZK. During attribution schema work, it is acceptable to reserve proof fields only if they fit naturally:

- `proof_type`
- `proof_artifact_uri`
- `verifier_backend`
- `verification_status`

Public product copy should not claim zkActivitySum or privacy-preserving attribution is live until that implementation exists.

## Pool Model

Project contribution pools remain operationally separate by source asset or currency. The allocator also normalizes each pool to USD using the cycle price snapshot so users can be compared and equalized across projects and assets.

Required pool fields:

- `projectId`
- `cycleKey`
- `assetType`
- `assetCode`
- `sourceAmount`
- `usdValue`
- `priceSnapshotId` or equivalent deterministic price reference
- `availableSourceAmount`

Only confirmed available amounts are distributable. If an amount cannot be fulfilled into user credits because of preference or supply constraints, the unfulfilled value returns to the contributing project's future pool rather than becoming a user credit.

## Allocation Algorithm

### 1. Raw Project Entitlements

For each project pool, compute each eligible user's raw project entitlement from approved attribution points:

```text
user_project_raw_usd =
  project_pool_usd * user_project_points / total_eligible_project_points
```

Users without eligible approved attribution for a project receive no raw entitlement from that project.

### 2. User Baseline

For each user, compute the baseline as the largest single-project raw entitlement:

```text
user_baseline_usd = max(user_project_raw_usd values)
```

This baseline protects the strongest protocol/project-specific earning a user would have received without cross-project equalization.

Invariant:

```text
sum(user_baseline_usd) <= total_monthly_pool_usd
```

The sum should be lower than the total pool when users overlap across projects, and equal only when every eligible user has attribution in exactly one project. If the baseline sum is greater than the total monthly pool, the allocator must fail with a deterministic invariant error rather than silently scaling or inventing a fallback rule.

### 3. Remainder

The equalization remainder is:

```text
remainder_usd = total_monthly_pool_usd - sum(user_baseline_usd)
```

If the remainder is zero, final USD allocations equal baselines and the allocator proceeds directly to rounding and asset fulfillment.

### 4. Capped Equalization

Distribute the remainder globally in USD to users with the lowest current allocations first. This is the MVP's basic-income equalization layer: users who would otherwise receive the least from poorer or smaller protocols receive top-ups before users with higher baselines.

Each user's final allocation is capped at:

```text
user_final_cap_usd = 3 * user_baseline_usd
```

The cap is on final allocation, not only on the top-up. A user with a `100 USD` baseline can receive at most `300 USD` total for the cycle.

Tie-breaking must be deterministic. Recommended order:

1. lowest current allocation
2. lowest baseline
3. stable user id sort

If every eligible user reaches their cap and some remainder still exists, the remainder is returned to project future pools through deterministic returned-pool rows.

### 5. Rounding

Rounding happens after USD normalization and final USD allocation.

Rules:

- use integer minor USD units for canonical credited USD values
- keep exact decimal intermediate values in the artifact
- assign residuals deterministically by descending fractional remainder, then stable user id sort
- reconcile rounded allocations plus returned amounts to the confirmed monthly pool USD

Asset-specific source amounts may have different minor-unit rules. The asset fulfillment stage must apply those rules separately while preserving the canonical USD-equivalent reconciliation.

## Asset Fulfillment

After final USD-equivalent allocation, FundLoop fulfills each user's credit through accepted asset preferences.

Rules:

- choose the user's highest-priority accepted asset that is available
- if that asset has insufficient supply, partially fill it and continue to the next accepted asset
- continue until the user's allocation is fully filled or no accepted available asset remains
- unfulfillable value returns to the contributing project's future pool
- preferences affect asset fulfillment only; they do not change the user's USD-equivalent allocation

Issue #70 stores these preferences in `user_asset_preferences` and updates them through the `user-asset-preferences-update` Edge Function command. The rank order is canonical and deterministic. A missing custom preference set means default fulfillment order is stablecoin, fiat, then project tokens. The table intentionally stores asset intent only, not payout destinations or transfer instructions.

The output may contain multiple asset fills for one user result when fallback preferences are needed. The user-facing product may show those fills as one credited result with a breakdown.

## Outputs

Issue #76 introduced the pure allocator at `lib/monthly-cycles/mvp-distribution-calculator.ts`. It is intentionally runtime-agnostic and does not import the server-only monthly-cycle index. The calculation package command should call this module in the next persistence slice, then store the returned artifact and rows without recalculating the policy differently.

The pure allocator returns a deterministic structure containing:

- total monthly pool USD
- source asset/currency pool summary
- raw per-project user entitlements
- user baselines
- equalization top-ups
- final capped USD allocations
- rounding residual decisions
- asset fill instructions
- returned future-pool rows
- excluded users and reason codes
- warnings and invariant checks
- stable hash input and result hash

The calculation package command persists artifacts and rows from this output, but it must not recalculate with different rules.

## Verification Requirements

Verification must check:

- locked manifest hash matches the calculation input
- price snapshot reference is stable
- all included contribution pools are confirmed and cycle-linked
- all included attribution datasets are approved and cycle-linked
- all included users were CUBID-linked at lock time
- final allocation does not exceed `3x` baseline for any user
- allocated USD plus returned future-pool USD reconciles to the confirmed monthly pool USD
- asset fills respect accepted preference order and recorded availability constraints
- returned future-pool amounts are not presented as user credits
- artifact hashes exist and match persisted result rows

## User-Facing Reporting

User earnings surfaces should show:

- credited asset amount or amounts
- USD-equivalent total
- contributing project/protocol breakdown
- source-currency breakdown where relevant
- clear `credited` and `not paid yet` language

Founder and operator surfaces should additionally show:

- project/cycle credited totals
- returned future-pool totals
- asset pool utilization
- calculation artifact hash and verification state

No surface should claim that a transfer or payout has occurred during the operational MVP.

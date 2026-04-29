# Monthly Cycle Domain Model

Session 21 introduced `public.monthly_cycles` as the canonical operational anchor for FundLoop's economic month.
Session 22 added the first mutation command, `monthly-cycle-lock`, so operators can freeze an open cycle into an immutable lock manifest.

## Schema Contract

`monthly_cycles` has one row per economic month:

- `cycle_key` uses `YYYY-MM`
- `year`, `month`, `period_start`, and `period_end` are checked against `cycle_key`
- `status` uses `monthly_cycle_status`
- stage timestamps track open, lock, prep, calculation, verification, approval, distribution, completion, and reporting publication
- lock fields store `locked_manifest`, `locked_manifest_hash`, `locked_by_user_id`, and deliberate unresolved-onchain override metadata
- operator notes and user audit fields are present for future commands

`monthly_cycle_events` records lock attempts, successes, and failures with actor, attempt id, severity, message, and structured metadata. Later transition commands should extend this event-log pattern instead of inventing separate audit tables for each lifecycle step.

Status values are:

- `open`
- `locked`
- `prep`
- `calculation`
- `verification`
- `approval`
- `distribution`
- `completed`
- `reporting`

## Backfill and Linkage

The Session 21 migration backfills cycle rows from existing month-bearing data:

- `payments.period_end`
- `onchain_payment_submissions.submitted_at`
- `zkas_identity_artifacts.month`
- `zkas_datasets.month`
- `zkas_runs.month`
- `project_stats_monthly.year/month`

It then attaches nullable `monthly_cycle_id` references to operational rows. These foreign keys are nullable during the transition so existing workflows can continue while later sessions make cycle ownership stricter.

## App Read Model

`lib/monthly-cycles/` owns the app-side cycle helpers:

- month parsing and calendar bounds
- status constants and labels
- `loadMonthlyCycleAdminOverview()` for the operator page

`/[locale]/admin/cycles` is the operator overview. It summarizes cycle status, linked payment totals, reconciliation counts, zkAS datasets/runs, and published result totals. Partial read failures should degrade to warnings rather than crash the page.

Open cycles expose a lock action that calls the `monthly-cycle-lock` Edge Function. The first attempt blocks if same-cycle onchain submissions are still `submitted`, `confirming`, `awaiting_confirmation`, or `pending`. If that happens, the UI opens a strongly worded override modal. A retry can only proceed when the operator supplies an explicit reason, and the reason is written into both the manifest and audit event stream.

Locked cycles link to `/[locale]/admin/cycles/[cycleKey]/prep`, the Session 23 prep and exception review workspace. This route is intentionally read-only: it checks whether the locked manifest is safe to hand into calculation packaging, but it does not transition status or produce calculation artifacts yet.

## Lock Manifest

`monthly-cycle-lock` persists a deterministic JSON manifest and SHA-256 hash on the cycle row. The manifest is the v1 immutable input snapshot for later prep, calculation, verification, payout, and reporting work.

The manifest includes:

- cycle identity, calendar bounds, actor, lock timestamp, and override fields
- confirmed same-cycle payments
- same-cycle onchain submission state and reconciliation status
- active participating users' CUBID linkage/snapshot summary
- approved zkAS datasets and identity artifact references
- counts for each section

The command reattaches newly-created month-bearing rows to the cycle before reading. It updates the cycle from `open` to `locked` with an optimistic `status = open` guard so concurrent or repeated locks fail safely instead of overwriting an already-transitioned cycle.

## Prep Review

`lib/monthly-cycles/monthly-cycle-prep.ts` owns the prep read model. It evaluates the locked manifest and returns a posture:

- `not_locked`
- `blocked`
- `needs_review`
- `ready`

The prep workspace surfaces:

- missing or mismatched lock manifest/hash
- unresolved onchain submissions, including override reasons
- missing confirmed contribution inputs
- missing approved zkAS datasets or identity artifacts
- missing or unlinked CUBID participant snapshots
- informational live-row drift between current linked rows and the immutable manifest

Live drift is informational because downstream calculation should use the locked manifest, not mutable current rows. Prep does not create zkAS runs, package calculation inputs, approve exceptions, or move the cycle into the next status. Those responsibilities remain later sessions.

## Operating Rule

New monthly cadence work should attach to `monthly_cycles` instead of independently interpreting month strings. Existing zkAS `month` fields and payment period fields remain in place for compatibility, but `monthly_cycle_id` is the canonical join point for lock, prep, calculation, verification, payout, and reporting sessions.

All monthly-cycle mutations should follow the Edge Function command boundary. Session 22 intentionally added only locking; Session 23 added read-only prep checks. Calculation packaging, payout creation, and reporting publication remain later sessions.

## Local Supabase Note

If local Supabase reports `supabase_db_fundloop` missing, check for another repo's Supabase containers holding the ports. On 2026-04-29 the blocker was a competing `Genero` Supabase stack. Stopping those containers allowed `supabase start` to restore the FundLoop stack and `supabase migration up` to apply the lock migration locally.

# Monthly Cycle Domain Model

Session 21 introduced `public.monthly_cycles` as the canonical operational anchor for FundLoop's economic month.
Session 22 added the first mutation command, `monthly-cycle-lock`, so operators can freeze an open cycle into an immutable lock manifest.
Session 27 added the outbound payout domain model and the first payout-intent creation command.

## Schema Contract

`monthly_cycles` has one row per economic month:

- `cycle_key` uses `YYYY-MM`
- `year`, `month`, `period_start`, and `period_end` are checked against `cycle_key`
- `status` uses `monthly_cycle_status`
- stage timestamps track open, lock, prep, calculation, verification, approval, distribution, completion, and reporting publication
- lock fields store `locked_manifest`, `locked_manifest_hash`, `locked_by_user_id`, and deliberate unresolved-onchain override metadata
- operator notes and user audit fields are present for future commands

`monthly_cycle_events` records cycle pipeline attempts, successes, failures, warnings, actor, attempt id, message, and structured metadata. Session 37 broadened this from the original lock-focused audit stream into the canonical observability stream for lock, prep, calculation, verification, approval, distribution, payout execution, and reporting publication. Later transition commands should extend this event-log pattern instead of inventing separate audit tables for each lifecycle step.

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

Session 24 added `/[locale]/admin/cycles/[cycleKey]/zkas` as the cycle-anchored zkAS stage view. This route reads datasets, identity artifacts, runs, run results, published user results, and project summaries through `monthly_cycle_id` so operators can inspect zkAS as part of the monthly cadence instead of as a parallel control plane.

Session 25 added the first deterministic calculation-package command, `monthly-cycle-calculation-package`. It packages a locked/prep cycle into a cycle-level calculation manifest, uploads the package and run manifest artifacts to Supabase Storage, creates a locked zkAS run, links run datasets/payments, marks approved datasets as included, and advances the cycle into `calculation`.

Session 26 added `/[locale]/admin/cycles/[cycleKey]/verification` as the cleanup, verification, and approval workspace for calculated results. It also added the `monthly-cycle-verification-review` and `monthly-cycle-approval` Edge Function commands so operators can record cleanup-needed decisions, mark a cycle verified, and approve verified results for distribution with audit events and required notes.

Session 27 added `/[locale]/admin/cycles/[cycleKey]/payouts` as the first operator view over outbound payout work. It converts approved published user results into payout intents through the `monthly-cycle-payout-intents-create` Edge Function command, then moves the cycle into `distribution`. Payout execution, rail batching, and reconciliation remain later sessions.

## Pipeline Observability

Session 37 added `/[locale]/admin/cycles/observability` as the operator drill-down over `monthly_cycle_events`.

- Use this page to inspect lock, prep, calculation, verification, approval, distribution, and reporting events.
- Use `attempt_id` as the cross-stage handle when an operator or agent retries a monthly-cycle command.
- Keep MCP and future non-web clients pointed at this same event stream. Do not create a parallel protocol-only observability log.
- Payment-specific wallet and receipt telemetry still lives in `payment_flow_events`; monthly-cycle stage telemetry lives in `monthly_cycle_events`.

Session 28 added the chain-abstracted execution interface under `lib/execution/`. Session 31 added Solana-specific payout batch draft scaffolding on that boundary, and Session 32 added fiat provider-not-configured payout draft stubs. Monthly-cycle payout work should use the execution interface for batch planning and future rail execution instead of branching directly on EVM, Solana, or fiat details.

Session 34 added `/[locale]/founder/projects/[slug]/attribution` as the founder-facing contribution-data workflow. It does not move dataset writes yet; the existing project zkAS page still owns uploads and dataset detail routes while the founder workflow exposes the structured contract, readiness state, and recent submissions.

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

## zkAS Stage Alignment

`lib/monthly-cycles/monthly-cycle-zkas.ts` owns the cycle-specific zkAS read model. It returns a posture:

- `not_locked`
- `missing_inputs`
- `ready_for_packaging`
- `calculation_started`
- `published`

The posture is derived from the monthly cycle lock state, approved cycle-linked attribution datasets, approved cycle-linked identity artifacts, cycle-linked zkAS runs, and published cycle results. The page links back to prep review and into the existing upload/run consoles, because those older routes still own the operational actions until calculation packaging and verification commands are introduced.

The important boundary is conceptual and data-oriented: `month` strings remain for compatibility and storage paths, while `monthly_cycle_id` is the canonical way to determine what belongs to a cycle. New zkAS calculation, verification, publication, and reporting work should start from the cycle row and its linked records.

## Calculation Packaging

`monthly-cycle-calculation-package` is the command boundary between prep review and computation. The command:

- requires a locked, prep, or already-calculation cycle with a lock manifest and hash
- rejects missing approved attribution datasets, missing approved identity artifacts, duplicate project datasets, or multiple approved identity artifacts
- deterministically orders datasets and payments before hashing artifacts
- writes `monthly-cycle-calculation-package.v1` to `zkas-runs/{cycleKey}/cycle-{cycleId}/calculation-package.v1.json`
- writes the locked run manifest to `zkas-runs/{cycleKey}/run-{runId}/run-manifest.v1.json`
- creates a locked `zkas_runs` row and links `zkas_run_datasets` / `zkas_run_payments`
- records monthly-cycle audit events for attempt and success/failure outcomes

The package manifest intentionally excludes mutable packaging timestamps so the same locked inputs produce the same package hash. The run manifest still includes `run_id` because the current execution engine consumes run-scoped manifests; the cycle package hash is the stable cross-run audit artifact.

## Verification and Approval Review

`lib/monthly-cycles/monthly-cycle-verification.ts` owns the cycle-level result review model. It checks:

- the cycle is in `calculation`, `verification`, or `approval`
- a completed zkAS run exists
- the completed run has passed run-level verification
- a result artifact hash is present
- result row allocation totals match the run total
- failed runs are visible as cleanup warnings

`monthly-cycle-verification-review` records either:

- `verified`, which moves the cycle to `verification` and sets `verification_started_at`
- `needs_cleanup`, which keeps the cycle in `calculation` and records the cleanup note

`monthly-cycle-approval` requires a verified completed run and moves the cycle to `approval` with `approval_started_at`. This is the explicit checkpoint before later distribution and payout sessions create outbound obligations.

## Payout Intent Creation

`monthly-cycle-payout-intents-create` is the command boundary between approved distribution results and concrete outbound payout work. The command:

- requires the cycle to be in `approval` or `distribution`
- reads positive `zkas_published_user_results` attached through `monthly_cycle_id`
- creates one idempotent `payout_intents` row per published user result
- marks intents `ready` when the user has an active default payout route
- marks intents `draft` with `missing_default_payout_route` when a route is not configured yet
- advances the cycle to `distribution` and records audit events for attempt and success/failure outcomes

The command does not execute payouts or reconcile outbound transfers. Session 28 added the adapter interface and deterministic batch-draft builder that later payout commands should use to create rail-specific batches from ready intents.

Session 35 added `/[locale]/workspace/earnings` as the user-facing earnings and payout workspace. It reads monthly-cycle published results, payout intents, payout routes, batch status, and reconciliation cues so users can understand what they are owed and which stage each payout is in while payout execution remains operator-controlled.

Session 36 added `monthly_cycle_reports` and the `monthly-cycle-reports` Supabase Storage bucket as the durable reporting publication model. Public, user, founder, and operator pages now read report metadata through `lib/reporting/monthly-cycle-reports.ts`.

## Operating Rule

New monthly cadence work should attach to `monthly_cycles` instead of independently interpreting month strings. Existing zkAS `month` fields and payment period fields remain in place for compatibility, but `monthly_cycle_id` is the canonical join point for lock, prep, zkAS calculation, verification, payout, and reporting sessions.

All monthly-cycle mutations should follow the Edge Function command boundary. Session 22 added locking, Session 23 added read-only prep checks, Session 24 aligned zkAS reads/writes to cycle ownership, Session 25 added deterministic calculation packaging, Session 26 added verification/approval checkpoints, and Session 27 added payout-intent creation. Session 35 made those outputs visible to users, and Session 36 added reporting publication read models and artifact metadata. Payout execution and report generation commands remain later sessions.

## Local Supabase Note

If local Supabase reports `supabase_db_fundloop` missing, check for another repo's Supabase containers holding the ports. On 2026-04-29 the blocker was a competing `Genero` Supabase stack. Stopping those containers allowed `supabase start` to restore the FundLoop stack and `supabase migration up` to apply the lock migration locally.

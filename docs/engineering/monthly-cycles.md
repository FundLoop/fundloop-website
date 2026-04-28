# Monthly Cycle Domain Model

Session 21 introduced `public.monthly_cycles` as the canonical operational anchor for FundLoop's economic month.

The table is intentionally read-only from the product UI for now. Session 22 will add the first mutation command, `monthly-cycle-lock`.

## Schema Contract

`monthly_cycles` has one row per economic month:

- `cycle_key` uses `YYYY-MM`
- `year`, `month`, `period_start`, and `period_end` are checked against `cycle_key`
- `status` uses `monthly_cycle_status`
- stage timestamps track open, lock, prep, calculation, verification, approval, distribution, completion, and reporting publication
- operator notes and user audit fields are present for future commands

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

`/[locale]/admin/cycles` is a read-only operator overview. It summarizes cycle status, linked payment totals, reconciliation counts, zkAS datasets/runs, and published result totals. Partial read failures should degrade to warnings rather than crash the page.

## Operating Rule

New monthly cadence work should attach to `monthly_cycles` instead of independently interpreting month strings. Existing zkAS `month` fields and payment period fields remain in place for compatibility, but `monthly_cycle_id` is the canonical join point for lock, prep, calculation, verification, payout, and reporting sessions.

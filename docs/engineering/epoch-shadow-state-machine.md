# Epoch shadow state machine

Task #128 adds a provisional, non-effective 12-stage control plane beside the legacy monthly-cycle workflow. It is enabled only in local, development, preview, and test environments. Production is fail-closed in the Edge boundary, scheduler, RPCs, and database runtime controls. `production_value_flow_enabled` is constrained to false.

The stages are `collecting`, `reconciling`, `valuing`, `fee_processing`, `carryover_payouts`, `locking`, `allocating`, `reviewing`, `payout_readying`, `payout_open`, `expired`, and `closed`. The observability view maps them conservatively to legacy labels but never updates `monthly_cycles`.

Scheduling uses deterministic idempotency keys and optimistic state versions. Enqueue and completion take per-epoch advisory transaction locks. Workers claim one due row with `FOR UPDATE SKIP LOCKED`; the claim transaction ends before any external work. Completion records sanitized gate results and artifact references in a later transaction. Hard gate failures do not advance state. Audited single-actor overrides, pause/resume, and retry attempts are append-only evidence.

The fake clock is accepted only through the internal-secret Edge command in non-production environments. Pacific cutoffs use `America/Los_Angeles`; email-relative deadlines skip weekends and configured holidays. No external provider call is made while a database lock is held.

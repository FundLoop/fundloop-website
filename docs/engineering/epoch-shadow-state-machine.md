# Epoch shadow state machine

Task #128 adds a provisional, non-effective 12-stage control plane beside the legacy monthly-cycle workflow. It is enabled only in local, development, preview, and test environments. Production is fail-closed in the Edge boundary, scheduler, RPCs, and database runtime controls. `production_value_flow_enabled` is constrained to false.

The stages are `collecting`, `reconciling`, `valuing`, `fee_processing`, `carryover_payouts`, `locking`, `allocating`, `reviewing`, `payout_readying`, `payout_open`, `expired`, and `closed`. The observability view maps them conservatively to legacy labels but never updates `monthly_cycles`.

Scheduling uses deterministic idempotency keys and optimistic state versions. Enqueue and completion take per-epoch advisory transaction locks. Workers claim one due row with `FOR UPDATE SKIP LOCKED`; the claim transaction ends before any external work. Completion records sanitized gate results and artifact references in a later transaction. Hard gate failures do not advance state. Audited single-actor overrides, pause/resume, and retry attempts are append-only evidence.

Idempotency binds the full canonical transition command: state, target, expected stage/version, manifest, trigger, actor, and scheduled instant. Reusing a key with any changed field returns `epoch_shadow_idempotency_conflict`. Every transition has a seeded required hard gate; an empty or incomplete gate set fails the attempt. Overrides are permitted only for specifically marked gates and bind the claimed attempt, state, transition stage, gate, and the same internal-admin actor recorded on the attempt.

The tracked scheduler manifest and `pg_cron` job run every five minutes in non-production deployments. The job reads URL, anon key, internal scheduler secret, and trusted deployment environment from Supabase Vault; absent secrets or production stop before `pg_net` makes a request. It derives collection cutoff from the accounting period, intermediate readiness from `stage_ready_at`, review opt-out from the linked regional business calendar and delivered-email time, payout expiry from `payout_opened_at`, and final close from explicit carryover completion. These triggers enqueue evidence-bearing shadow attempts only.

The fake clock is accepted only through the internal-secret Edge command in non-production environments. Pacific cutoffs use `America/Los_Angeles`; email-relative deadlines skip weekends and configured holidays. No external provider call is made while a database lock is held.

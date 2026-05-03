# Operations Runbook

FundLoop is now organized around a small set of durable operational boundaries: Supabase deploys, monthly cycles, CUBID identity sync, payment/payout execution, and private storage artifacts.

This runbook is the first-stop checklist for a small operator team. The in-product companion is `/admin/operations`.

## Release Health

Primary surfaces:

- GitHub Actions app CI
- GitHub Actions `Supabase Deploy`
- `/admin/payments/deployments`
- `/admin/cycles/observability`

Before treating a release as healthy:

- Confirm app CI passed lint, tests, typecheck, build, and contract tests where relevant.
- Confirm Supabase dry-run or deploy targeted the intended `Preview` or `Production` environment.
- Confirm the Supabase deploy workflow parsed the expected project ref from the correct pooler secret.
- Confirm function runtime secrets already exist in the target Supabase project.
- Confirm no remote seeds or remote resets were used as part of the deploy.

Escalate if the app deploy is healthy but Supabase migration/function deployment failed. In that state, avoid testing flows that depend on newly-added database columns, buckets, or Edge Functions until deploy health is restored.

## Monthly Cycle Operations

Primary surfaces:

- `/admin/cycles`
- `/admin/cycles/[cycleKey]/prep`
- `/admin/cycles/[cycleKey]/zkas`
- `/admin/cycles/[cycleKey]/verification`
- `/admin/cycles/[cycleKey]/payouts`
- `/admin/cycles/[cycleKey]/reporting`
- `/admin/cycles/observability`

Operator sequence:

1. Lock an open cycle only after reviewing unresolved onchain submissions.
2. Use prep review to resolve missing attribution datasets, identity artifacts, stale identity snapshots, or empty confirmed payment inputs.
3. Package calculation inputs only from locked/prep/calculation cycles.
4. Verify calculated results before approval and payout intent generation.
5. Treat reporting as the publication stage, not as a substitute for calculation/approval.

The immutable lock manifest and generated storage artifacts are the recovery anchors. If state diverges, stop transitions and identify the last trustworthy event in `/admin/cycles/observability`.

## Identity Sync Troubleshooting

Primary surfaces:

- `/admin/identity`
- `/workspace/account`
- `/founder/account`

CUBID owns full name, email, phone, provider/social verification, verification state, and score. FundLoop owns display name, bio, occupation, location, interests, visibility, wallets, and product preferences.

Before identity-sensitive work:

- Review linked or verified users without `cubid_identity_snapshots`.
- Review stale snapshots and sync errors.
- Do not locally edit missing CUBID-owned fields; show them as pending until CUBID provides them.

Escalate if CUBID API failures are widespread. Pause new identity-sensitive publishes and monthly prep work until the upstream failure mode is understood.

## Payment, Reconciliation, And Payout Incidents

Primary surfaces:

- `/admin/payments`
- `/admin/payments/reconciliation`
- `/admin/payments/observability`
- `/admin/cycles/[cycleKey]/payouts`
- `/admin/payments/deployments`

Checks:

- Founder payment-route writes and receipt recording should use typed Edge Function commands.
- Admin confirmation and reconciliation writes should use typed Edge Function commands or the internal Edge-backed reconciliation path.
- Rail behavior belongs behind `lib/execution/`; operator pages should not special-case EVM, Solana, or fiat outside the execution interface.
- If receipt state, chain state, and payment status disagree, preserve the unresolved submission and do not force confirmation without an audit trail.

## Storage Artifacts And Evidence

Primary references:

- `lib/storage/artifacts.ts`
- `docs/engineering/storage-artifacts.md`
- `monthly_cycle_reports`
- `zkas_runs`
- `zkas_datasets`
- `zkas_identity_artifacts`

Rules:

- Use shared storage path helpers instead of inline object-path assembly.
- Keep product buckets private by default.
- Let database rows own metadata and authorization context.
- Do not stream private storage contents through MCP or public pages without a scoped Edge Function download path.
- Create replacement artifacts instead of mutating published or locked artifacts.

## Local And Remote Environment Safety

Use local Supabase for destructive migration replay and smoke tests. Use remote preview/dev only for remote-safe smoke tests, CI dry-runs, and CI-managed deploy validation.

Agents must not manually push, reset, re-link, seed, or otherwise mutate remote Supabase unless the user explicitly grants that permission in the current prompt.

See `docs/engineering/env-and-testing.md` and `docs/engineering/supabase-deployments.md` for detailed environment rules.

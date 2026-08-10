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
- Confirm `dev` and `main` branch protections are active before relying on PR-only promotion.
- Confirm the `Production` environment has required reviewers before merging a `dev` to `main` release-candidate PR.
- Confirm the Supabase deploy workflow parsed the expected project ref from the correct pooler secret.
- Confirm function runtime secrets already exist in the target Supabase project.
- Confirm no remote seeds or remote resets were used as part of the deploy.
- Use `docs/engineering/release-candidate.md` for the current dev-to-main promotion sequence and production smoke checklist.

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

## Feature #118 operational matrix

Use `tests/e2e/operational/feature-118-capability-matrix.json` as the capability source of truth for a Feature #118 review. Do not infer provider readiness from green local SQL, Hardhat, or browser tests.

1. Reset and seed only the local FundLoop stack.
2. Run the all-five-persona harness and require zero owned residue for every persona.
3. Run the focused review-policy, invitation, package, FX, allocation, withdrawal, Stripe, and Base suites named by the capability matrix.
4. Run the neutral-ledger, epoch-shadow, reconciliation, close-package, withdrawal, Base, Stripe Connect, and financial-cutover SQL suites against the disposable local database.
5. Run Hardhat and the full Node 22 check.
6. Inspect exact 1440x900 and 390x844 sanitized captures. Never retain automatic traces or failure screenshots from OTP, invitation-token, payout-destination, or private-profile surfaces.
7. Run hosted smoke only against an explicitly selected Preview/dev URL and Supabase project. A missing target remains `pending`; it is not a local failure and must not be labeled green.

Current hard stops:

- Stripe inbound bank-transfer intake stays disabled while the sandbox reports no supported `customer_balance` currencies.
- Base USDT/PYUSD cannot leave local mock status without reviewed provider-address evidence.
- production runtime controls, policy effectiveness, definitive accounting classifications, payables, provider calls, transfers, and value flow remain disabled.
- counsel and accountant/bookkeeper approval are production-promotion gates, as previously directed; they do not block neutral local/dev evidence.

On any mismatch between provider state and the machine matrix, downgrade the capability to `pending`, preserve the evidence, and stop the affected command. On cleanup residue, stop the aggregate as failed and use the exact run ledger recovery command; never broaden a delete target or erase append-only evidence.

# Dev To Main Release Candidate Path

Last reviewed: 2026-08-13

Session 52 records the first credible promotion path from `dev` to `main`. Sprint
#155 adds the immutable [production-readiness evidence contract](./production-readiness-evidence-contract.md).
This document is intentionally operational: it separates what the repo can enforce
from what GitHub/Supabase operators must configure before production data is touched.

## Current Verified Repo State

- Repository: `FundLoop/fundloop-website`
- Default branch: `main`
- Integration branch: `dev`
- GitHub environments present: `Preview` and `Production`
- Supabase deploy workflow: `.github/workflows/supabase-deploy.yml`
- App CI workflow: `.github/workflows/ci.yml`
- PRs into `dev` or `main` run Supabase migration dry-runs only.
- Pushes to `dev` deploy migrations and Edge Functions to the dev Supabase target.
- Pushes to `main` deploy migrations and Edge Functions to the main Supabase target through the `Production` GitHub environment.
- App CI now runs on pushes to `dev`, pushes to `main`, `codex/**` feature branches, and pull requests.
- `dev` and `main` are protected for administrators and require PRs, linear history,
  resolved conversations, and the exact three delivery checks.
- `Production` is restricted to `main`, requires a human approval, and does not
  allow administrator bypass.

The timestamped [GitHub delivery-control read-back](./github-delivery-controls-2026-08-13.md)
records the unsafe baseline and the owner/admin API result after configuration.

## Enforced GitHub Controls

GitHub API checks on 2026-08-13 confirm:

- both branches require exact check-run contexts `validate`, `Supabase fresh-schema replay`, and
  `Supabase dry-run` on every PR;
- the Supabase check always reports, but only runs provider-backed dry-run work when
  the reviewed path classifier says it is required;
- both branches require PRs and enforce protection for administrators; the approval
  count is zero while the repository has only one eligible human, avoiding an
  administrator-enforced self-review deadlock; and
- `Production` accepts only `main`, has one required human reviewer, and has
  administrator bypass disabled.

Re-read these live controls before promotion because checked-in documentation is not
configuration evidence. Do not approve a Production deployment until the separate
release authority boundary is satisfied.

## Required Secrets And Runtime Configuration

GitHub Actions secrets:

- `DEV_SUPABASE_SESSION_POOLER_URL`
- `MAIN_SUPABASE_SESSION_POOLER_URL`
- `SUPABASE_ACCESS_TOKEN`

Target Supabase function secrets must already be configured per project. At minimum verify:

- Supabase URL and key values required by Edge Functions.
- CUBID credentials used by identity functions.
- Wallet/runtime configuration for enabled chains and rail adapters.
- `FUNDLOOP_PAYMENTS_CRON_SECRET` in both the Next.js runtime and Supabase Edge Function secrets.
- Internal admin and zkAS superadmin allowlists for production operators.

The repo cannot read secret values from GitHub or Supabase. Treat this as an operator checklist item.

## Promotion Sequence

1. Merge feature branches into `dev` only through PRs.
2. Wait for app CI and the Supabase deploy run on `dev` to pass.
3. Run the beta smoke checklist against the dev/preview app.
4. Open a PR from `dev` into `main`.
5. Confirm app CI passes on the PR.
6. Confirm the Supabase Deploy PR dry-run targets `main` and succeeds without remote mutation.
7. Review migration ordering, Edge Function changes, runtime secret requirements, and smoke results.
8. Merge the PR into `main` only after the production approval gate and branch protections are active.
9. Approve the `Production` environment deployment when ready.
10. Confirm the push-triggered main Supabase deploy applies migrations and deploys functions successfully.
11. Regenerate the v1 evidence manifest and require exact migration/function/schema
    parity for the main SHA while `productionValueFlowEnabled=false`.
12. Run the production smoke checklist below and bind it to the same app/Supabase
    deployment IDs.
13. Keep cutover and go-live pending until their separate approvals and evidence
    pass. Production deploy is not authority for either action.

## Migration And Rollback Rules

- Migrations are forward-only.
- Do not reset, reseed, or relink production Supabase from CI or local machines.
- Supabase migrations run before Edge Function deployment.
- If a production migration fails before changes apply, stop and repair with a new PR.
- If a production migration applies but the app is unhealthy, ship a forward repair migration or app hotfix PR rather than resetting data.
- If an Edge Function deploy fails after migrations apply, either re-run the workflow after fixing the function bundle or ship a narrow repair PR.
- Keep the previous Vercel/app deployment available as the first app rollback option, but remember that database rollback is forward repair.

## Minimum Production Smoke Checklist

Run these after the main deploy is green:

- Public: `/en`, `/en/participation`, `/en/founders`, `/en/projects`, `/en/reports`.
- Auth: sign in as a non-production production-test account, then open `/en/workspace` and `/en/workspace/account`.
- Founder: open `/en/founder`, `/en/founder/projects`, and one managed project workspace.
- Payments: open `/en/admin/payments`, `/en/admin/payments/reconciliation`, and `/en/admin/payments/deployments` as an internal operator.
- Monthly cycles: open `/en/admin/cycles`, one cycle detail stage, and `/en/admin/cycles/observability`.
- Reporting: open `/en/workspace/reporting`, `/en/founder/projects/[slug]/reporting`, and one public reports page.
- Identity: verify CUBID-linked account status renders without exposing CUBID secrets to the browser.
- Storage: download only authorized private zkAS artifacts from the superadmin route when a known artifact exists.
- MCP: run the local stdio health smoke against the intended non-production actor before using agents for production-adjacent workflows.

Record smoke evidence in `agent-context/session-log.md` or a dedicated release note before declaring the release candidate complete.

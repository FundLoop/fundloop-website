### session v1: operational MVP hosted validation status refresh

- Timestamp: 2026-07-22T05:54:55Z
- Agent: Codex
- Branch: codex/operational-mvp-hosted-validation-status
- Head: 9417a0d

Objective:
- Reconcile the operational MVP issue tree after the merged implementation PR and record the current hosted validation blocker truthfully.

Actions:
- Validated and commented evidence for operational MVP issues #52 through #59 and moved their implemented tasks/goals to `On dev`.
- Removed satisfied GitHub blocker edges from already-landed predecessor issues so the remaining smoke issue is not artificially blocked.
- Updated `docs/engineering/operational-mvp-preview-validation.md` to replace the stale "branch not published" blocker with the current dev deploy state and the remaining authorized hosted smoke blocker.

Validation:
- Focused Vitest, lint, and typecheck commands were run during issue reconciliation and recorded on the relevant GitHub issues.
- This docs-only commit was checked with `git diff --check`.

Reflections:
- Most of the MVP implementation work was already on `dev`; the main work here was careful evidence reconciliation rather than new product code.
- Preview/dev smoke should still be treated as incomplete until an authorized hosted run proves the end-to-end path.

Suggested next steps:
- Run the hosted operational MVP smoke with non-production credentials and update issue #87 plus the preview validation doc with sanitized evidence.

### session v2: hosted smoke attempt and env fallback

- Timestamp: 2026-08-04T04:04:31Z
- Agent: Codex
- Branch: codex/operational-mvp-hosted-validation-status
- Head: 4377ee5

Objective:
- Use the provided non-production app URL and `.env.remote.local` credentials to retry the hosted operational MVP smoke and record either evidence or the exact remaining blocker.

Actions:
- Installed the missing local Playwright Chromium/headless-shell binaries so remote-safe browser tests can launch.
- Ran the remote-safe Playwright lane against `https://fundloop-website.vercel.app`.
- Updated the remote E2E env loader so it accepts canonical non-production Supabase env names as fallbacks when `PLAYWRIGHT_REMOTE_SUPABASE_*` aliases are empty.
- Added focused unit coverage for the fallback behavior.
- Recorded the hosted smoke attempt in `docs/engineering/operational-mvp-preview-validation.md`, including the remote dev reference-data blocker.

Validation:
- `pnpm dlx node@22.22.1 /opt/homebrew/bin/pnpm test:e2e:remote` reached remote dev Supabase and failed before fixture insertion because zero active contract-mode intake contracts were available.
- Read-only remote diagnosis found 3 active supported chains, 8 active chain assets, 1 crypto payment method, 4 required payment statuses, 0 active intake contracts, and 0 route candidates.

Reflections:
- The prior "authorized hosted context" blocker is mostly cleared, but the remote dev database still lacks active non-production intake-contract reference rows required by the remote-safe smoke.
- The smoke harness should now fail on real readiness gaps instead of silently skipping when `.env.remote.local` uses canonical app Supabase variable names.

Suggested next steps:
- Repair remote dev intake-contract reference data through the approved deploy/configuration path, then rerun the remote-safe lane and the full operational MVP hosted smoke.

### session v3: dev intake reference-data deploy repair

- Timestamp: 2026-08-04T04:35:29Z
- Agent: Codex
- Branch: codex/operational-mvp-hosted-validation-status
- Head: c76e750

Objective:
- Repair the remote dev intake-contract reference-data blocker through the approved Supabase deploy path instead of manual remote mutation.

Actions:
- Updated the Supabase Deploy workflow so database migration sessions receive `app.settings.fundloop_target_environment=dev|main`.
- Added a forward migration that activates deterministic non-production EVM intake-contract placeholders only for `dev` when explicit configured addresses are absent.
- Kept the production/main path fail-safe by skipping missing configured addresses rather than overwriting rows with placeholders or zero values.
- Updated deployment and hosted-validation docs with the target-aware migration contract and pending post-merge validation steps.

Validation:
- `git diff --check` passed.
- `pnpm dlx node@22.22.1 /opt/homebrew/bin/pnpm test -- tests/e2e-env.test.ts` passed.
- `actionlint .github/workflows/supabase-deploy.yml` was not available because `actionlint` is not installed locally.
- Local Supabase replay was attempted, but startup was canceled before migration replay because the local stack needed to pull large updated service images and did not reach readiness in a reasonable window.
- `supabase stop` was run afterward and stopped the local development setup.
- PR dry-run, post-merge dev deploy, and hosted smoke rerun remain pending because the repair must land through the approved GitHub deploy path.

Reflections:
- The issue is not that the app cannot read reference data; the dev target lacks active intake-contract reference rows because earlier migrations could only activate them from unavailable DB session settings.
- Passing target environment through the deploy workflow gives migrations a small, auditable configuration surface without broad remote mutation rights.

Suggested next steps:
- Publish the branch to `dev`, wait for Supabase dry-run, merge once approved, confirm the dev deploy applies the migration, and rerun the hosted smoke.

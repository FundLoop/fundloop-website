### session v1: dev intake activation retry

- Timestamp: 2026-08-04T05:27:19Z
- Agent: Codex
- Branch: codex/fix-dev-intake-contract-activation
- Head: aca170c

Objective:
- Repair the post-merge dev Supabase intake-contract activation path after PR #95 deployed successfully but hosted remote-safe smoke still found zero active route candidates.

Actions:
- Confirmed the push-triggered dev Supabase deploy for PR #95 succeeded through migrations and Edge Function deployment.
- Reran the remote-safe hosted smoke and reproduced the same fixture blocker: zero active contract-mode intake route candidates.
- Read dev remote reference tables without mutation and confirmed `chain_intake_contracts` still contained inactive zero-address EVM placeholder rows.
- Updated the Supabase Deploy workflow so Postgres `options` uses `%20` percent-encoded spaces rather than query-string `+` spaces, and added `PGOPTIONS` as a secondary session-setting path.
- Added a forward retry migration that activates deterministic non-production intake/treasury placeholders only when the migration session explicitly reports `dev`, skips `main`, and raises on missing/unsupported target markers.
- Updated the Supabase deployment docs with the reliable session-setting encoding rule.

Validation:
- `git diff --check` passed.
- Python YAML parse for `.github/workflows/supabase-deploy.yml` passed.
- A local Node sanity check confirmed the workflow encoder emits `options=-c%20app.settings.fundloop_target_environment%3Ddev` and not query-string `+` spacing.
- `pnpm dlx node@22.22.1 /opt/homebrew/bin/pnpm test -- tests/e2e-env.test.ts` passed.
- PR dry-run is pending.
- Pending post-merge dev deploy confirmation.
- Pending hosted remote-safe smoke rerun after the retry migration lands on `dev`.

Reflections:
- The previous workflow change was structurally valid and the migration was marked applied, but the runtime evidence shows the target environment setting did not reach the migration connection.
- The retry migration should fail loudly if the workflow ever loses the target marker again, which is safer than silently recording a no-op migration.

Suggested next steps:
- Open a tiny repair PR to `dev`, confirm Supabase dry-run, merge after approval, confirm the dev deploy applies the retry migration, and rerun hosted MVP smoke.

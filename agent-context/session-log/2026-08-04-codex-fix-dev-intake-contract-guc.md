### session v1: database-level deploy target marker

- Timestamp: 2026-08-04T21:08:30Z
- Agent: Codex
- Branch: codex/fix-dev-intake-contract-guc
- Head: 5ec571e

Objective:
- Repair dev intake-contract activation after PR #103 proved Supabase session pooler/startup parameters still did not reach deploy migration execution.

Actions:
- Confirmed PR #103 merged into `dev` and its push-triggered Supabase deploy succeeded.
- Confirmed the retry migration ran as `unknown` and no-oped, leaving zero active contract-mode intake rows in dev.
- Updated the Supabase Deploy workflow to install `psql` for deploy runs and set `app.settings.fundloop_target_environment` as a database-level GUC immediately before `supabase db push`.
- Added cleanup logic that resets the database-level deploy marker after migration deployment.
- Added a new forward migration so dev receives another approved deploy-path activation attempt.
- Updated Supabase deployment docs to treat connection startup options as secondary and database-level GUC as the reliable deploy marker.

Validation:
- `git diff --check` passed.
- Python YAML parse for `.github/workflows/supabase-deploy.yml` passed.
- Static grep confirmed the workflow contains database-level `ALTER DATABASE ... SET/RESET` marker handling and the new forward migration is present.
- `pnpm dlx node@22.22.1 /opt/homebrew/bin/pnpm test -- tests/e2e-env.test.ts` passed.
- PR dry-run is pending.
- Pending post-merge dev deploy confirmation.
- Pending hosted remote-safe smoke rerun after the new migration lands on `dev`.

Reflections:
- PR #103 improved safety and made local replays sane, but the deploy log showed the session marker still arrived as `unknown`.
- The reliable fix needs a setting visible to the new migration connection, not only startup parameters on the connection string.

Suggested next steps:
- Validate, open a small repair PR, merge after green checks, confirm dev rows become active, rerun hosted smoke, then clean merged branch residue.

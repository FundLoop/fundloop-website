### session v1: Supabase deploy target through session options only

- Timestamp: 2026-08-04T21:38:02Z
- Agent: Codex
- Branch: codex/fix-dev-intake-session-options
- Head: b56b8c500b40ff8aee32c358213f408423e9c54d

#### Objective

Repair the dev Supabase deploy path after the post-merge PR #106 run failed because the session-pooler deploy user cannot mutate database-level custom settings with `ALTER DATABASE`.

#### Actions Taken

- Removed the privileged `ALTER DATABASE ... SET/RESET app.settings.fundloop_target_environment` calls from the Supabase deploy workflow.
- Kept the first repair focused on session-level connection options, then updated it after Codex review identified that Supabase CLI resets session state before applying migrations.
- Added a non-secret persistent `public.supabase_deploy_context` marker row for deploy migrations to read after `RESET ALL`.
- Updated the pending dev intake-contract activation migration to read the persistent marker through dynamic SQL, while preserving marker-less local replay as a no-op.
- Updated Supabase deployment documentation to make the persistent marker the canonical target-aware migration path.

#### Validation Notes

- Passed: workflow YAML parse/static validation.
- Passed: `git diff --check`.
- Passed: `pnpm dlx node@22.22.1 /opt/homebrew/bin/pnpm test -- tests/e2e-env.test.ts`.
- Passed: PR #107 Supabase dry-run before the review-driven persistent marker update.
- Pending: PR dry-run and post-merge dev Supabase deploy.

#### Reflections

- The prior repair fixed URL parsing, but still depended on privileged database-level GUC mutation. Session-level connection options are the safer deployment contract for managed Supabase targets.

#### Suggested Next Steps

- Open a draft PR to `dev`, wait for the Supabase dry-run and standard checks, then complete review/merge gates before validating the push-triggered dev deploy and hosted smoke.

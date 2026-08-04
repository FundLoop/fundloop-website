### session v1: Supabase deploy target through session options only

- Timestamp: 2026-08-04T21:38:02Z
- Agent: Codex
- Branch: codex/fix-dev-intake-session-options
- Head: 918f4b7e84849d0c36d7cca4d4ce49ac78c64696

#### Objective

Repair the dev Supabase deploy path after the post-merge PR #106 run failed because the session-pooler deploy user cannot mutate database-level custom settings with `ALTER DATABASE`.

#### Actions Taken

- Removed the privileged `ALTER DATABASE ... SET/RESET app.settings.fundloop_target_environment` calls from the Supabase deploy workflow.
- Kept the target marker on the actual deploy connection through the encoded database URL `options` parameter and `PGOPTIONS`, which matches the permission level available to the Supabase pooler user.
- Removed the now-unused PostgreSQL client installation step from the workflow.

#### Validation Notes

- Pending: workflow YAML parse/static validation.
- Pending: focused local tests.
- Pending: PR dry-run and post-merge dev Supabase deploy.

#### Reflections

- The prior repair fixed URL parsing, but still depended on privileged database-level GUC mutation. Session-level connection options are the safer deployment contract for managed Supabase targets.

#### Suggested Next Steps

- Open a draft PR to `dev`, wait for the Supabase dry-run and standard checks, then complete review/merge gates before validating the push-triggered dev deploy and hosted smoke.

### session v1: encode psql deploy URL before marker setup

- Timestamp: 2026-08-04T21:21:19Z
- Agent: Codex
- Branch: codex/fix-dev-intake-psql-url-encoding
- Head: 0eb253ed465dab094088edaaee6b2ec8665e7a91

Objective:
- Repair the dev Supabase deploy failure after PR #105 exposed that `psql` received the raw session-pooler URL before the workflow URL encoder ran.

Actions:
- Confirmed PR #105 merged after green CI, Copilot review, Codex review, and resolved review threads.
- Confirmed the push-triggered dev Supabase deploy failed before `supabase db push`.
- Read the deploy log and identified `psql` interpreting part of the raw pooler secret as the host because the URL had not yet been encoded/masked.
- Moved the existing URL encoding and masking block before all `psql` calls so both `ALTER DATABASE ... SET/RESET` and `supabase db push` use the same derived URL.

Validation:
- `git diff --check` passed.
- Python YAML parse for `.github/workflows/supabase-deploy.yml` passed.
- `pnpm dlx node@22.22.1 /opt/homebrew/bin/pnpm test -- tests/e2e-env.test.ts` passed.
- PR dry-run is pending.

Reflections:
- The deploy marker approach is still the right path, but any helper that touches the database must use the same encoded URL, not just the Supabase CLI call.

Suggested next steps:
- Validate, open a small repair PR, merge after full review gates, confirm the dev deploy applies the pending intake activation migration, then rerun hosted smoke.

### session v2: cleanup warning review fix

- Timestamp: 2026-08-04T21:25:08Z
- Agent: Codex
- Branch: codex/fix-dev-intake-psql-url-encoding
- Head: 0eb253ed465dab094088edaaee6b2ec8665e7a91

Objective:
- Address PR #106 review feedback before merging the psql URL encoding repair.

Actions:
- Updated the deploy-marker cleanup warning so it is accurate for any deploy-step early-exit path, not only failures after `supabase db push`.
- Corrected the session v1 log head to the implementation commit.

Validation:
- `git diff --check` passed.
- Python YAML parse for `.github/workflows/supabase-deploy.yml` passed.
- `pnpm dlx node@22.22.1 /opt/homebrew/bin/pnpm test -- tests/e2e-env.test.ts` passed.

Reflections:
- The cleanup trap can run before, during, or after migration deployment; the message should describe cleanup scope rather than a specific phase.

Suggested next steps:
- Push, reply to and resolve the review thread, then continue CI/review gates.

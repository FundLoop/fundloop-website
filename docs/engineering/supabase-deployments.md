# Supabase Remote Deployments

Last reviewed: 2026-08-11

FundLoop deploys Supabase schema migrations and Edge Functions through the `Supabase Deploy` GitHub Actions workflow.

## Targets

- Pull requests into `dev` execute the entire migration history against a fresh isolated local database, run representative SQL/RLS/RPC suites, and then run a non-mutating migration dry-run against the dev Supabase project.
- Pull requests into `main` execute the same isolated replay and suites, then run a non-mutating migration dry-run against the main Supabase project.
- Pushes to `dev` deploy migrations and all tracked Edge Functions to the dev Supabase project.
- Pushes to `main` deploy migrations and all tracked Edge Functions to the main Supabase project through the GitHub `Production` environment gate.
- Manual `workflow_dispatch` can run a `dry-run` or `deploy` against either target. Manual `main` deploys also use the `Production` environment gate.
- All other runs use the GitHub `Preview` environment.

PR runs intentionally do not mutate shared databases or deploy functions.

Live API read-back on 2026-08-11 still reported no protection rules on the
`Production` environment and `can_admins_bypass=true`. It also reported no branch
protection for `dev` or `main`. Add and read back the required controls before
treating the main deploy as approval-gated.

The workflow's remote PR `supabase db push --dry-run` remains planning evidence only.
It is paired with an isolated, executable full-history replay because PR #185's
dry-run passed, then push run `31542120571` failed with SQLSTATE `42601` while
executing `20260809020000_neutral_ledger_foundations.sql` under Supabase CLI
`2.90.0`. CLI `2.113.0` was selected only after it replayed the unchanged history
through `20260811120000` and the representative suites passed. The
[production-readiness evidence contract](./production-readiness-evidence-contract.md)
therefore requires fresh executable replay before merge and exact post-deploy
migration, function, and schema read-back before parity can pass.

The isolated replay has no shared database credentials or GitHub environment. It
starts a local Postgres service, runs the same `supabase db push` deployment command
with `--include-all`, compares the applied migration history to every tracked file,
loads the local seed, and runs review-policy, funded-allocation, and payment-rail
SQL suites. A disposable invalid migration must
also fail without entering migration history. Both replay helpers reject any
non-loopback database hostname.

## Required GitHub Secrets

- `DEV_SUPABASE_SESSION_POOLER_URL`
- `MAIN_SUPABASE_SESSION_POOLER_URL`
- `SUPABASE_ACCESS_TOKEN`

The pooler URLs must be session-pooler Postgres connection strings with the standard Supabase username format:

```text
postgres.<project-ref>
```

The workflow parses `<project-ref>` from that username and fails before deployment if the format does not match. The parsed project ref is used for `supabase functions deploy --project-ref`.

## Deployment Behavior

Database migrations are deployed with:

```bash
supabase db push --yes --include-all --db-url "$SUPABASE_DB_URL"
```

Pull requests use the same target resolution but run:

```bash
supabase db push --yes --include-all --db-url "$SUPABASE_DB_URL" --dry-run
```

The workflow sets a non-secret persistent Postgres target marker before deploy migrations run:

```text
public.supabase_deploy_context.target_environment = dev|main
options=-c%20app.settings.fundloop_target_environment=dev|main
PGOPTIONS=-c app.settings.fundloop_target_environment=dev|main
```

The persistent marker is the reliable path for Supabase CLI deploy migrations because CLI migration application can run `RESET ALL` before executing migration SQL, which clears session/startup settings before `current_setting(...)` reads them. The marker contains only `dev` or `main`; it is not a secret. The startup `options` and `PGOPTIONS` values are retained as best-effort secondary paths for commands that do not reset session state.

Forward migrations may use this setting for target-aware reference data that must differ between Preview/dev and Production. Migrations must fail safe: missing production configuration must not overwrite existing production values with local or placeholder data. Dev-only smoke fixtures may use deterministic non-production placeholders when the target is `dev` and the migration documents that behavior.

Connection URL `options` values must be percent-encoded with `%20` for spaces. Do not rely on query-string `+` encoding for this parameter. Also do not rely on connection startup parameters alone for migration-critical behavior through the session pooler.

Workflow helpers must not print rewritten database URLs to logs. If a helper constructs a derived connection string, write it to a temporary file or shell variable, then mask the derived value with `::add-mask::` before passing it to `supabase db push`.

Local `supabase db reset` and `supabase migration up` commands normally do not set `app.settings.fundloop_target_environment`. Target-aware migrations should treat a missing marker as local/no-op unless the migration is explicitly required for local schema correctness. Unsupported explicit marker values should still fail loudly.

Edge Functions are deployed by enumerating each local function directory under `supabase/functions/` except `_shared` and `_vendor`, then deploying the remaining function directories one by one:

```bash
supabase functions deploy "<function-name>" --project-ref "$SUPABASE_PROJECT_REF"
```

Before bundling functions on deploy runs, the workflow installs repo dependencies with `pnpm install --frozen-lockfile` so package dependencies remain available to the Deno bundler. `supabase/functions/deno.json` enables `nodeModulesDir` for that bundle step and maps Edge-safe package imports explicitly when needed.

Successful deploy output alone does not prove exact function source parity. The v1
evidence contract requires a candidate source digest, remote deployment digest or
equivalent independently readable binding, exact name inventory, and schema
fingerprint. Missing, extra, inactive, or unverifiable functions block parity.

FundLoop no longer keeps a function-local CUBID mirror under `supabase/functions/_vendor/`. CUBID server and Edge code imports the runtime-agnostic `@cubid/core` package, and the Supabase Deno import map resolves it through `jsr:@cubid/core@0.1.0`. Browser-only CUBID compatibility helpers may still depend on local vendored tarballs, but Edge Functions must not depend on `node_modules/@cubid/api/dist/index.mjs`.

The workflow pins Supabase CLI `2.113.0` instead of using `latest`. Any future pin
change must pass a fresh full-history replay, the representative SQL suite, and the
deliberately invalid migration smoke before deployment.

The workflow never runs remote seeds, never resets a remote database, and never writes Supabase function secrets.

## Function Runtime Secrets

Each Supabase project must already have the runtime secrets needed by the functions, including Supabase URL/key values, CUBID credentials, wallet/runtime configuration, and any future integration keys.

Operator-style functions that support internal system callers also require:

- `FUNDLOOP_PAYMENTS_CRON_SECRET`

That secret must be configured both in the Next.js runtime and in the target Supabase project so the secret-gated internal route can invoke the matching Edge Function safely.

Use Supabase project settings or the Supabase CLI secrets workflow to manage those values deliberately per environment.

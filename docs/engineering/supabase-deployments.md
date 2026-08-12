# Supabase Remote Deployments

Last reviewed: 2026-08-12

FundLoop deploys Supabase schema migrations and Edge Functions through the `Supabase Deploy` GitHub Actions workflow.

## Targets

- Pull requests into `dev` execute the entire migration history against a fresh isolated local database, run representative SQL/RLS/RPC suites, and then run a non-mutating migration dry-run against the dev Supabase project.
- Pull requests into `main` execute the same isolated replay and suites, then run a non-mutating migration dry-run against the main Supabase project.
- Pushes to `dev` deploy migrations and all tracked Edge Functions to the dev Supabase project.
- Pushes to `main` deploy migrations and all tracked Edge Functions to the main Supabase project through the GitHub `Production` environment gate.
- Manual `workflow_dispatch` can run a `dry-run` or `deploy` against either target. Manual `main` deploys also use the `Production` environment gate.
- All other runs use the GitHub `Preview` environment.

PR runs intentionally do not mutate shared databases or deploy functions.

PR dry-runs targeting Dev also execute a read-only effective-schema diagnostic after
the remote migration plan. The diagnostic replays the complete candidate history in
a randomized Postgres 17 stack and compares that full `public` schema with a read-only
Dev dump. Unknown drift remains blocking; only the reviewed, unordered policy-role
set is canonicalized.

Before failing, the runner writes a sanitized
`fundloop.public-schema-diagnostic/v2` artifact. It contains candidate/environment
bindings, exact expected/observed schema hashes, complete per-object hash manifests,
missing/changed reviewed object identifiers, opaque hashes for unexpected remote
identifiers, and at most 200 differing line-number/hash pairs. It contains no schema
DDL, row data, database URL, credentials, secrets, function bodies, default values,
or unknown remote object names. Aggregate counts and hashes retain full coverage even
when the line-difference sample is truncated. Deploy runs produce the same diagnostic
before a schema mismatch throws, so failure-safe artifact upload preserves it.

PR #192 artifact `9146378398` bound the remaining Dev drift to three structural
differences with production value flow disabled: a legacy Boolean parse tree on the
reviewed `monthly_cycles_month_bounds_check`; environment-specific output ordering
for the unchanged `public_payments_read_all` role set; and one extra permissive INSERT
policy on reviewed `cron_logs`. The extra policy name remains opaque; its complete
object-key SHA-256 and safe catalog shape bind the forward repair. Migration
`20260812130000_repair_dev_public_schema_drift.sql` changes only the exact matching
legacy state, drops the extra policy through its object-key hash, and fails with
SQLSTATE `55000` for any other state. The role-order difference is handled by schema
normalization v2 because Postgres role OIDs are environment-specific and the role set
is unordered.

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

The isolated replay has no shared database credentials or GitHub environment. Its
wrapper creates a randomized, task-owned Supabase workdir with an empty migrations
directory and seed disabled, then starts its database on a dynamically allocated
loopback port. Before repository migration execution, the runner fails if the
application migration table already contains any row. It then runs the same
`supabase db push` deployment command with `--include-all`, compares the applied
migration history to every tracked file, loads the local seed exactly once, and runs
review-policy, funded-allocation, and payment-rail SQL suites. A disposable invalid migration must
also fail without entering migration history. Both replay helpers reject any
non-loopback database hostname. The wrapper removes only its randomized local stack
and workdir, including after a replay or smoke failure; it never stops an ordinary
developer Supabase project.

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

Before either a remote dry-run or any deploy-mode database mutation, runs resolve every tracked Edge Function import graph
with the pinned Deno runtime and frozen lockfile. This catches missing cross-workspace
imports before the first remote bundle is created:

```bash
find supabase/functions -mindepth 2 -maxdepth 2 -name index.ts -print0 \
  | sort -z \
  | xargs -0 deno cache --no-check --frozen --config supabase/functions/deno.json
```

The deploy then derives the expected inventory from directories that contain an
`index.ts`, checks the current remote inventory, and refuses to proceed if any extra
remote name is not a due, environment-scoped entry in
`supabase/retired-functions.json`. After that guard, one pinned CLI command deploys
all current functions and prunes only the reviewed retirement:

```bash
supabase functions deploy --project-ref "$SUPABASE_PROJECT_REF" --prune --jobs 1 --yes
```

`--yes` confirms the reviewed prune noninteractively only after the predeploy parity
guard has rejected every unexplained extra and limited deletion to due,
environment-scoped entries in `supabase/retired-functions.json`. The command remains
fail closed: removing or reordering that guard is covered by the workflow contract
test, and postdeploy read-back must still prove the exact resulting inventory.

Before bundling functions on deploy runs, the workflow installs repo dependencies
with `pnpm install --frozen-lockfile` so package dependencies remain available to the
Deno bundler. `supabase/functions/deno.json` enables `nodeModulesDir` for that bundle
step and maps Edge-safe package imports explicitly when needed. Edge-owned runtime
modules must stay below the application source boundary; other workspaces may
re-export them, but an Edge entrypoint must not depend on a re-export back into a
different workspace.

Successful deploy output alone does not prove exact function source parity. The v1
evidence contract requires a candidate source digest, remote deployment digest or
equivalent independently readable binding, exact name inventory, and schema
fingerprint. Missing, extra, inactive, or unverifiable functions block parity.

After deployment, the workflow lists the remote inventory again, requires exactly
the derived local names with `ACTIVE` status, downloads every deployed source closure
through the management API, and compares its path set against a separately derived
transitive checkout closure before comparing every byte plus the canonical closure
SHA-256 against the reviewed checkout. It records the remote bundle digest, version,
status, project ref, environment, candidate Git SHA, and observation time. The
database verifier independently replays all tracked migrations into a randomized
Postgres 17 local stack and requires exact remote migration-version equality. Before
`db push`, the deploy run persists the sorted per-file SHA-256 inventory with the
candidate Git SHA, Actions run/attempt, environment, and project ref in the repo-owned
append-only `supabase_deploy_migration_evidence` table. Post-deploy parity reads that
exact record back and independently recomputes both its file and aggregate digests;
versions without this binding are unverifiable. The verifier also requires every
public `production_value_flow_enabled` control to remain disabled and compares the
full normalized `pg_dump --schema-only --schema=public --no-comments` output
byte-for-byte using the exact `pg17-public-schema-normalized-v2` algorithm. Version 2
sorts only the unordered role set in `CREATE POLICY ... TO ...`; object names,
definitions, expressions, and every other schema byte remain covered.

One pending forward repair may pass the Dev PR diagnostic only when the tracked
`fundloop.public-schema-repair/v1` manifest matches the complete legacy drift
signature, the remote migration history is the byte-bound reviewed prefix, the repair
is the sole pending migration, and production value flow remains disabled. The
post-deploy verifier has no repair exception: it requires the complete migration
history and zero normalized schema drift.

The two sanitized `fundloop.public-schema-parity/v1` and
`fundloop.edge-function-parity/v1` JSON records are uploaded as one 30-day Actions
artifact bound to the target environment and Git SHA. They contain no database URL,
token, runtime secret, row data, or PII. A Dev deploy concludes with an unauthenticated
call to `epoch-allocation-close`; only the expected `401` denial counts as the
remote-safe smoke. Workflow success without these read-backs and smoke is not Dev
parity.

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

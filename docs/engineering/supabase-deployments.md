# Supabase Remote Deployments

Last reviewed: 2026-08-13

FundLoop deploys Supabase schema migrations and Edge Functions through the `Supabase Deploy` GitHub Actions workflow.

## Targets

- Pull requests into `dev` execute the entire migration history against a fresh isolated local database, run representative SQL/RLS/RPC suites, and then run a non-mutating migration dry-run against the dev Supabase project.
- Pull requests into `main` execute the same isolated replay and suites, then run a non-mutating migration dry-run against the main Supabase project.
- Pushes to `dev` deploy migrations and all tracked Edge Functions to the dev Supabase project.
- Pushes to `main` deploy migrations and all tracked Edge Functions to the main Supabase project through the GitHub `Production` environment gate.
- Manual `workflow_dispatch` can run a `dry-run` or `deploy` against either target. Manual `main` deploys also use the `Production` environment gate.
- All other runs use the GitHub `Preview` environment.

PR runs intentionally do not mutate shared databases or deploy functions.

The workflow itself starts for every PR into `dev` or `main`, ensuring the protected
branches always receive the exact `Supabase dry-run` status context. A checked-in
path classifier gates the provider-backed execution. Relevant candidates must pass
the remote plan and diagnostic; unrelated candidates must skip that execution and
pass the final context only after the workflow verifies the skip. Classification or
execution ambiguity fails closed. Push deployment remains path-filtered.

PR dry-runs targeting Dev also execute a read-only effective-schema diagnostic after
the remote migration plan. The diagnostic replays the complete candidate history in
a randomized Postgres 17 stack. When the PR contains ordinary forward migrations, it
also replays the exact immutable remote-history prefix into a disposable baseline
Postgres 17 stack and compares that baseline `public` schema with a read-only Dev dump.
The baseline stack is separately task-owned and every host-side command uses its
dynamically allocated loopback port; container-side reads continue to use the stack's
internal Postgres port. The
candidate tail must be strictly forward, may contain one or more migrations, and its
full replay must already have succeeded. Changed bytes, an unknown/non-prefix remote
version, missing byte-bound baseline evidence, or unexplained remote schema drift
remain blocking. Only the reviewed, unordered policy-role set is canonicalized.

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

Live API read-back on 2026-08-13 confirms protected `dev` and `main` branches require
PRs plus the app, executable replay, and Supabase checks. The approval count remains
zero while FundLoop has only one eligible collaborator, preventing enforced
self-review deadlock. `Production`
is restricted to the exact `main` branch, requires the repository's human reviewer,
and has administrator bypass disabled. See the timestamped
[delivery-control evidence](./github-delivery-controls-2026-08-13.md). Re-read live
state before promotion; no document substitutes for current configuration evidence.
The pre-publication [Goal #158 certification](./goal-158-delivery-integrity-evidence.md)
binds those controls to the exact certified Dev deployment and drift artifacts.

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

The read-only drift job selects exactly one target pooler secret into a masked job
environment variable. It never writes a database URL to `GITHUB_OUTPUT` or an
artifact; step outputs contain only the derived project reference and checkout SHA.
This preserves URL-encoded credentials byte-for-byte across steps and keeps them out
of GitHub's command-file transport.
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
through `GET /v1/projects/{project-ref}/functions/{slug}/body` on the official
Supabase Management API with the CI-only bearer token and
`Accept: multipart/form-data`. This matches the pinned CLI 2.113.0 response contract
without using its filesystem extractor, which cannot safely retain legitimate
monorepo-root closure members outside `supabase/functions`. The repo-owned reader
compares the multipart path set against a separately derived transitive runtime
checkout closure before comparing every byte plus the canonical closure
SHA-256 against the reviewed checkout. It records the remote bundle digest, version,
status, project ref, environment, candidate Git SHA, and observation time. The
reader rejects redirects and non-200 responses without logging response bodies,
validates project/function identifiers, bounds the response, file count, and each
file, and rejects absolute/traversal paths, symlink/non-regular markers, duplicate or
case/Unicode-colliding paths, and missing/extra closure members. Only the known
`fundloop-website/` archive prefix is stripped; no source path or byte is allowlisted
out of comparison. The contract follows Supabase CLI tag `v2.113.0`,
`apps/cli-go/internal/functions/download/download.go` (`readForm` and `getPartPath`).
This is multipart source read-back, not ZIP extraction. The database verifier
independently replays all tracked migrations into a randomized
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

Ordinary pending forward migrations may pass the Dev PR diagnostic only when remote
history is the exact byte-bound reviewed prefix, a disposable replay of that prefix
has zero normalized drift from Dev, the complete candidate tail replays successfully,
and production value flow remains disabled. The legacy one-off
`fundloop.public-schema-repair/v1` path remains limited to its exact recorded drift
signature. The post-deploy verifier has no pending-migration exception: it requires
the complete migration history and zero normalized schema drift.

The expected function closure is derived with the repo-pinned TypeScript compiler
API after `pnpm install --frozen-lockfile`. It follows side-effect imports, dynamic
imports, value imports/re-exports, mixed clauses containing any value binding, and
runtime JSON assets. Only declarations using the whole-declaration `import type` or
`export type` form are excluded. Ordinary import/export
declarations remain bound even when every named specifier uses inline `type`, matching
the Supabase bundle's retained module closure. Parse diagnostics fail closed, and the Deno
module-graph preflight still runs before migration or function mutation. This is a
language-semantic graph rule, not a path or remote-content allowlist.
Dynamic imports accept the standard string-literal one-argument form and two-argument
form with import attributes/options. Nonliteral specifiers and any other arity fail
closed rather than risking an underived repository dependency.

The two sanitized `fundloop.public-schema-parity/v1` and
`fundloop.edge-function-parity/v1` JSON records are uploaded as one 30-day Actions
artifact bound to the target environment and Git SHA. They contain no database URL,
token, runtime secret, row data, or PII. A Dev deploy concludes with an unauthenticated
call to `epoch-allocation-close`; only the expected `401` denial counts as the
remote-safe smoke. Workflow success without these read-backs and smoke is not Dev
parity.

`epoch-allocation-close` intentionally retains `verify_jwt = false` because its
repo-owned handler authenticates the supported bearer token formats. Except for
`OPTIONS`, authentication runs before method and payload handling: unauthenticated
GET or POST receives `401` without revealing payload validation, authenticated
non-POST receives `405` with `Allow: POST`, malformed authenticated JSON/input receives
`400`, and authenticated non-admin operator actions receive `403`. Existing domain and
RPC failure envelope status behavior is otherwise unchanged.
Absent, blank, malformed, or non-Bearer Authorization headers are rejected locally as
`401` before the Supabase auth client is called. Only a syntactically valid Bearer
credential reaches provider authentication; provider transport failures remain a
sanitized `500`, distinct from missing credentials.

## Immutable delivery manifests and read-only drift

Every successful Supabase deployment now publishes a verified
`fundloop.environment-delivery-manifest/v1` artifact. Its collision-resistant name
contains the environment plus both identities: the certified backend deployment
SHA/run/attempt and the read-only observation SHA/run/attempt. The manifest binds the
append-only, byte-digested migration evidence; exact remote history and normalized
schema; the independently derived, ordered Edge Function closure inventory and remote
source/bundle/version/status read-back; the value-flow control read-back; and the safe
hosted `401` denial. It intentionally does not claim branch protection, approvals, or
fresh-replay evidence that this workflow did not independently observe.

Observation and deployment provenance are distinct. A UI-only checkout may observe a
certified backend deployment from an earlier SHA only when the latest matching
append-only deploy-evidence record independently recomputes to the checkout's exact
ordered migration byte inventory. Function source parity remains bound to the current
observation checkout. In deployment mode the two SHA/run/attempt identities must be
identical, and `certifiedDeployment.recordedAt` is the timestamp read back from that
validated immutable database row—not the later verification or manifest timestamp.
Schema, function, and hosted-smoke component evidence retain their own observation SHA
and timestamp inside their digest-bound manifest sections. Every component SHA must
equal the final observation SHA, and exact RFC3339 ordering (without millisecond
truncation) requires the certified deployment to precede or equal every component,
which must in turn precede or equal the final manifest observation.

Migration evidence is deliberately inserted before `supabase db push` so the exact
candidate bytes remain auditable even when a deployment fails. That candidate row does
not certify success. Only after migration/schema parity, Edge Function deployment and
source read-back, hosted `401`, and manifest composition pass does the workflow append a
separate immutable `fundloop.deploy-completion-evidence/v1` row. It binds the candidate
SHA/run/attempt/environment/project and migration inventory to schema, function,
certified deploy-smoke, and deployment-manifest digests, retains the complete sanitized
deploy manifest, and requires completion time to follow every deploy observation.
Both the required parity artifact and immutable manifest artifact must publish before
the completion row is appended; an upload failure therefore leaves candidate-only
evidence. Before that final mutation, the complete manifest, its self-digest, component
digests, and evidence list are independently re-verified. Read-only drift selects
candidates only through an exact completion join, re-verifies the retained deploy
manifest, and binds every completion digest back to it. Candidate-only, skeletal,
tampered, mismatched, legacy, or stale rows cannot become the certified deployment.
The drift manifest retains the certified deploy smoke separately from a newly observed
safe smoke; the fresh observation must be distinct and occur after completion.

All chronology-bearing evidence requires a semantic RFC3339 timestamp with an explicit
known timezone. `Z`, `+00:00`, and known positive or negative offsets are accepted;
RFC3339's unknown-local-offset form `-00:00` is rejected because it cannot prove order.

`Supabase Drift Detection` never deploys, repairs, seeds, prunes, or invokes database
mutation commands. UI-only dev/main pushes are observed directly. A shared classifier
assigns any backend or mixed push to `Supabase Deploy`; only its successful, same-repo
push-origin `workflow_run` performs the read-only observation, eliminating the
pre-deploy race. A manually dispatched deploy can target an environment different from
its source branch, so it is deliberately not inferred from `head_branch`; run the drift
workflow explicitly for that selected target instead.
The classifier's canonical path set is tested for exact equality with both deploy
workflow path lists. The daily schedule observes Dev only. Production observation is
an explicit manual or main-push protected-environment operation; missing Production
approval or read-only credentials fails closed and remains part of #162 rather than
being silently skipped. Scheduled Production automation is not claimed.
Both deployment and observation use the same `supabase-<environment>` concurrency
group, so an observation cannot overlap a mutation for its target. The backend path
contract covers every currently derived Edge closure member, including contract
observers and MCP server sources, plus the pnpm workspace/install inputs.
An Actions job failure is the automatic drift alert. Failure-safe artifact upload
retains only the sanitized component evidence that was produced before the blocker;
invalid observations are never published as immutable passing manifests.

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

# Sprint #155 Goal 1 session log

### session v1: Capture Feature #118 release-readiness evidence (#156)

- Timestamp: 2026-08-11T20:06:15-04:00
- Agent: Codex
- Branch: `codex/155-supabase-ci-gate`
- Head: `7eacafe7d1003a7f9e529d4887423d158e017732`

#### Objective

Record a dated, source-linked baseline that separates reviewed code, local evidence,
deployed Dev, hosted acceptance, Production deployment, and value-flow authority.

#### Actions Taken

- Read back PR #185, its successful application CI, and the paired failed Supabase
  deployment, including the exact SQLSTATE and pending migration plan.
- Compared `origin/dev` and `origin/main`; inspected live GitHub rules, branch
  protection, environments, and environment protection rules.
- Enumerated candidate migrations/functions and read the active function names from
  FundLoop Dev and Production without linking, deploying, or changing either project.
- Cross-checked provider classifications, capability records, professional review
  drafts, runtime controls, and cutover documentation.
- Published a release-readiness inventory with an owner/evidence map and a traced
  allocation-v2 capability claim.

#### Tests And Validation Notes

- Verified the inventory's PR, run, commit, function, migration, issue, and local
  document references against their source read-backs.
- Second-source spot check: the failed run's skipped function-deploy step agrees
  with the management API absence of `epoch-funded-allocation` on Dev.
- Capability smoke: traced allocation v2 from merge commit through exact local
  migration/function digests to its truthful `in-code`, not-deployed state.
- Documentation-only change; code/UI tests and visual evidence are N/A.
- `git diff --check` and final link/path checks run before commit.

#### Reflections

The strongest immediate release blocker is executable migration replay: PR planning
was green while push execution failed. GitHub's intended approval boundary is also
not enforced by the live repository/environment configuration.

#### Suggested Next Steps

- Independently validate #156, then define the versioned evidence contract in #157.
- Do not repair or deploy Supabase until the ordered Goal #158 implementation Tasks.

### session v2: Define parity, promotion, and go-live evidence (#157)

- Timestamp: 2026-08-11T20:15:05-04:00
- Agent: Codex
- Branch: `codex/155-supabase-ci-gate`
- Head: `adca9735928a4bd2cfe87824a3de9232fef9b779`

#### Objective

Define one versioned, fail-closed contract that binds the reviewed Git candidate to
replay, Supabase delivery/parity, hosted evidence, Production promotion, cutover,
and later go-live without conflating those gates.

#### Actions Taken

- Added the v1 engineering contract and a Draft 2020-12 JSON Schema covering Git,
  migration/function/schema inventories, deploy runs, GitHub controls, runtime
  controls, capabilities, allocation v2, approvals, and independent gates.
- Defined raw-file, function-tree, canonical-JSON, and normalized PostgreSQL schema
  digest algorithms plus blocking/warning/informational drift and forward-fix rules.
- Added a parity-valid fixture and focused test that removes one expected migration
  and function and requires blocking drift; the test also prevents deploy/parity
  from becoming value-flow authority.
- Corrected the deployment, release-candidate, and repository-status documents to
  reflect the live 2026-08-11 workflow and GitHub control evidence.
- Dry-applied the contract to successful run `31287337962` and failed run
  `31542120571`; older success remains narrower than v1 parity because source and
  schema digests were not captured then.

#### Tests And Validation Notes

- Passed: focused Vitest with four tests using the single-worker fork pool.
- Passed: ESLint for the new test, full TypeScript typecheck, strict Draft 2020-12
  schema/fixture validation with `ajv-cli`, JSON parsing, local Markdown link/path
  checks, and `git diff --check`.
- The first thread-pool Vitest attempt stalled before collection and was interrupted;
  the repository's known deterministic single-worker fork configuration completed.
- Smoke passed: deleting the fixture's first observed migration yields
  `missing-migration`; deleting its first observed function yields
  `missing-function`, both blocking.
- UI visual evidence is N/A because this Task changes evidence/docs/tests only.

#### Reflections

Historical workflow success cannot be promoted to exact parity retrospectively when
the run did not capture source digests or a schema fingerprint. The contract makes
that absence explicit rather than reconstructing authority from incomplete logs.

#### Suggested Next Steps

- Independently validate #157 together with its fixture smoke.
- Implement executable replay and post-deploy parity collection only in Goal #158;
  do not mutate a remote environment from this evidence-design Task.

### session v3: Close evidence evaluator fail-open gaps (#157)

- Timestamp: 2026-08-11T20:33:00-04:00
- Agent: Codex
- Branch: `codex/155-supabase-ci-gate`
- Head: `231eb0a8bc7c2f3371e6b2cdf94944a1f937e607`

#### Objective

Correct the independent validator's counterexamples so the v1 manifest has one
canonical executable evaluator and cannot claim a stronger gate while required
inventory, binding, protection, approval, alert, or runtime evidence is invalid.

#### Actions Taken

- Added `evaluateProductionReadinessManifest` with deterministic inventory and
  approval-scope hashing plus stable blocking drift codes.
- Enforced strict ordering, uniqueness, exact item and aggregate digests, active
  function read-back, schema parity, and migration version/name consistency.
- Bound the candidate SHA/app deployment to observed app SHA, Supabase environment
  and canonical project ref, Actions run/attempt, and post-deploy observation times.
- Made required prerequisites, branch/environment protections, named checks,
  scoped/unexpired approvals, blocking-alert delivery, and runtime controls fail
  closed; enforced gate dependencies and rejected contradictory pass declarations.
- Strengthened the JSON Schema and replaced placeholder fixture hashes with
  evaluator-recomputed inventory and approval-scope hashes.
- Expanded the focused test from four happy-path/smoke cases to a 42-case positive
  and negative matrix covering every validator counterexample.

#### Tests And Validation Notes

- Passed: Node 22 focused Vitest, 42/42 tests with the single-worker fork pool.
- Passed: strict Draft 2020-12 AJV validation of the canonical fixture.
- Passed: full TypeScript typecheck and focused ESLint after implementation.
- Passed: full lint, strict-schema negative probes for empty approvals, unprotected
  controls, duplicate inventory, and contradictory pass gates, local link checks,
  and `git diff --check`.
- UI visual evidence is N/A; this remains evidence-contract code/docs/tests only.

#### Reflections

A structural JSON Schema cannot enforce sorted semantic keys, recomputed aggregate
digests, environment-specific project identity, approval scope, or gate dependency
by itself. The schema is now the structural gate and the canonical evaluator owns
those cross-field invariants with reproducible failure codes.

#### Suggested Next Steps

- Return this focused fix commit to independent validation for #157.
- Keep #157 `In Progress`; do not begin #159 or mutate remote delivery state until
  the orchestrator accepts revalidation.

### session v4: Execute fresh-schema replay in PR CI (#159)

- Timestamp: 2026-08-11T20:53:10-04:00
- Agent: Codex
- Branch: `codex/155-supabase-ci-gate`
- Head: `8d102b940d073e93208be9b72ea792cdb0057bb2`

#### Objective

Replace listing-only PR migration evidence with a secret-free executable replay of
the exact deployment CLI contract, representative SQL suites, and a fail-closed
invalid-migration smoke while retaining non-mutating remote planning.

#### Actions Taken

- Reproduced PR #185's SQLSTATE `42601` at migration `20260809020000` with pinned
  Supabase CLI `2.90.0` against a uniquely named empty loopback database.
- Proved CLI `2.113.0` applies the unchanged 93-migration history through
  `20260811120000`, then pinned that version for both replay and deployment.
- Added a PR-only isolated database job that runs full-history `db push`, compares
  applied versions to tracked migration files, loads local seed data, and runs
  review-policy, funded-allocation, and payment-rail SQL/RLS/RPC suites.
- Added a disposable invalid-migration smoke that requires CLI failure and verifies
  the invalid version never enters history while the valid final migration remains.
- Retained remote `db push --dry-run` planning, updated deployment documentation,
  and bound the evidence fixture to the selected CLI version.

#### Tests And Validation Notes

- Passed: Node 22 fresh local replay, 93/93 ordered migrations through
  `20260811120000`, including the former `20260809020000` parser regression.
- Passed: three representative SQL/RLS/RPC suites on the replayed schema.
- Passed: disposable invalid migration failed with SQLSTATE `42P01`; history still
  contained `20260811120000` and excluded `20991231235959`.
- Passed: focused replay contract test, 5/5; both Node replay scripts parsed.
- Passed: Node 22 `CI=1 pnpm check`: lint, 172 files/820 tests, typecheck, and Next
  production build with 165 generated pages.
- The first full check detected the evidence fixture's now-stale approval-scope hash;
  the hash was recomputed for CLI `2.113.0`, and the complete rerun passed.
- `git diff --check` and workflow syntax checks run before commit.

#### Reflections

The migration itself did not require rewriting: the failure was the old CLI's
prepared-statement parser. Executing the deployment-shaped command on an empty local
database catches that class of failure without granting PR code shared credentials.

#### Suggested Next Steps

- Independently validate #159 and its loopback/failure boundaries before PR yeet.
- Keep the worktree for Goal #158 Task #160 and do not deploy or mutate Supabase
  until the orchestrator reaches the explicit delivery stage.

### session v5: Isolate the PR replay bootstrap (#159)

- Timestamp: 2026-08-12T00:16:00-04:00
- Agent: Codex
- Branch: `codex/155-supabase-ci-gate`
- Head: `b409325b06524de93895cd26f5f75044ac515f08`

#### Objective

Fix PR #190's hosted replay bootstrap so Supabase startup cannot apply FundLoop
migrations or seed before the deployment-shaped replay owns those actions.

#### Actions Taken

- Replaced repository-context `supabase db start` with one lifecycle wrapper that
  creates a randomized task-owned workdir, empty migrations directory, seed-disabled
  config, and dynamically allocated loopback database port.
- Removed shared Dev/Main database URLs and Supabase access token from the wrapper's
  child environment before starting or operating the local stack.
- Added an absent-or-empty-safe migration-history preflight that blocks the replay
  if any application migration is already recorded.
- Kept the exact pinned `supabase db push --yes --include-all --db-url` execution,
  exact 93-version comparison, one seed application, representative suites, and
  disposable invalid-migration smoke.
- Scoped cleanup to the randomized workdir and `supabase stop --no-backup`, including
  failure paths; ordinary developer Supabase projects and volumes are not targeted.
- Updated focused workflow-contract tests and deployment documentation.

#### Tests And Validation Notes

- Passed: Node 22 syntax checks for all three replay scripts and workflow YAML parse.
- Passed: focused deployment-audit suite, 7/7 tests.
- Passed: non-loopback refusal probes for replay and invalid-migration helpers.
- Passed: real wrapper replay on Docker/Colima: zero-history preflight, 93 migrations
  through `20260811120000`, seed once, three SQL/RLS/RPC suites, and invalid migration
  rejection with SQLSTATE `42P01` and unchanged valid history.
- Passed: task-owned stack stopped with `backup=false`; no matching replay container
  remained and no existing FundLoop/user stack was targeted.
- Passed: focused lint, full typecheck, and `git diff --check`.

#### Reflections

Supabase's normal project startup is intentionally convenient and applies tracked
migrations and seed. Deployment-gate replay requires a separate bootstrap project so
the deployment CLI—not local startup—remains the only application migration owner.

#### Suggested Next Steps

- Let PR #190 rerun the corrected hosted bootstrap and require green checks.
- Do not start #160 or merge; the sprint orchestrator owns CI/review follow-through.

### session v6: Address PR #190 readiness-evaluator review (#157/#159)

- Timestamp: 2026-08-12T00:31:00-04:00
- Agent: Codex
- Branch: `codex/155-supabase-ci-gate`
- Head: `994bcfea511b202cc1ea6a8be38524045f1dd52b`

#### Objective

Make the new executable replay an exact required protection check while preserving
fail-closed Sprint behavior and permitting only separately approved later cutover
and go-live runtime-control transitions.

#### Actions Taken

- Added exact `CI / Supabase fresh-schema replay` protection enforcement to the
  canonical evaluator, schema, fixture, release checklist, and evidence contract.
- Replaced unconditional cutover/value-flow blockers with gate-specific authorization
  that requires Production, consistent pass declarations, and complete approved,
  unexpired, exact-manifest-scope approval sets.
- Kept deployment, cutover, and go-live separate: deployment alone still blocks all
  activation; cutover approvals cannot authorize value flow; go-live additionally
  requires its own fresh approval.
- Added positive tests for correctly approved cutover/go-live manifests and negative
  tests for missing replay protection, premature controls, missing/expired/scope-
  mismatched approvals, and contradictory cutover gates.

#### Tests And Validation Notes

- Passed: Node 22 focused evaluator suite, 53/53 tests.
- Passed: focused lint and full TypeScript typecheck.
- Passed: strict AJV Draft 2020-12 schema/fixture validation.
- Passed: the five unrelated test files that timed out or contaminated DOM state in
  the highly concurrent full run, 5 files/13 tests, with a single fork worker.
- Full `CI=1 pnpm check` reached tests after lint but had 11 unrelated failures in
  five UI test files (timeouts/cross-test DOM state); all five passed immediately in
  isolated single-worker rerun. The focused evaluator, lint, and typecheck remained
  green; no affected product/UI files changed.
- `git diff --check` run before commit.

#### Reflections

Fail-closed does not mean permanently disabled. Runtime activation becomes valid only
when the manifest itself proves the distinct later authority boundary with fresh,
scope-bound evidence; a deploy or self-declared gate cannot supply that authority.

#### Suggested Next Steps

- Let the orchestrator reply to and resolve the two exact PR review threads after
  this commit is pushed; do not request a second review.
- Do not begin #160 or merge PR #190 from this review-fix session.

### session v7: Restore exact Supabase Dev delivery parity (#160)

- Timestamp: 2026-08-12T07:29:17-04:00
- Agent: Codex
- Branch: `codex/155-goal-1-delivery-integrity-post-ci`
- Head: `12f223a945685193e3e8e49ea4dc9797327dc182`

#### Objective

Repair the code-owned Edge bundle failure from Dev deploy run `31589614923` and
make the next CI-owned Dev deploy prove exact migration, effective-schema, and
Edge Function parity without crossing the Production or value-flow boundary.

#### Actions Taken

- Moved the Base intake v2 observer implementation into the application library
  consumed by the Edge entrypoint and made the contracts workspace re-export it,
  removing the bundler's failing cross-workspace dependency direction.
- Added a frozen Deno import-graph preflight for all 62 function entrypoints before
  any function deploy, then changed delivery to one all-function pinned CLI command.
- Added an explicit Dev-only retirement contract for the remote-only
  `monthly-cycle-payout-intents-create`; unexplained extras fail before `--prune`.
- Added post-deploy exact inventory/source verification: every active remote function
  is downloaded, byte-compared with the checkout, closure-digested, and bound to its
  remote bundle digest, project, environment, Git SHA, version, status, and time.
- Added a Postgres 17 full-history replay/read-back verifier requiring all 93 remote
  migration versions, zero enabled production-value-flow controls, and byte-identical
  normalized full `public` schema dumps from the same pinned database toolchain.
- Added sanitized parity artifacts and a Dev-only unauthenticated `401` smoke of
  `epoch-allocation-close`. No remote seed/reset, Production deployment, provider
  mutation, runtime secret access, or value-flow activation was added or performed.
- Updated the deployment runbook and focused workflow/parity tests.

#### Tests And Validation Notes

- Passed: Node 22 focused delivery-parity suite, 5/5; script syntax and workflow YAML.
- Passed: frozen Deno import resolution for all 62 Edge Function entrypoints.
- Passed: read-only Dev predeploy inventory guard: 39 observed functions, 62 expected,
  and only the named time-bounded retirement is an extra; no remote mutation occurred.
- Passed: real task-owned full-history replay, all 93 migrations through
  `20260811120000`, three representative SQL suites, invalid migration rejection,
  and stack cleanup without backup.
- Passed: container-pinned two-stack Postgres 17 parity surrogate with all 93 versions,
  all discovered production-value-flow controls disabled, and full normalized public
  schema SHA-256 `bc2a61fb984ee984b68275be9b848f319a7411c21401d860f632579b1adc6cf0`.
- Passed: focused ESLint, full typecheck, and `CI=1 pnpm check`: lint, 173 files / 838
  tests, typecheck, and Next production build with 165 generated pages.
- Passed: `git diff --check`. A diagnostic full Deno typecheck found 159 pre-existing
  loose-JavaScript typing errors, so the bundle-resolution gate uses `deno cache
  --no-check --frozen`; this validates the deployment failure class without claiming
  or weakening the repository's separate TypeScript gates.

#### Reflections

Exact delivery evidence needs both logical inventory and executable content. A green
migration step or function name list cannot prove the reviewed code is deployed; the
candidate-bound source closure, bundle digest, migration history, effective schema,
disabled controls, and remote-safe denial smoke must agree in the same CI run.

#### Suggested Next Steps

- Independently validate #160, then let the orchestrator open the Goal PR to `dev`.
- After merge, require a green CI-owned Dev deploy and inspect the two sanitized
  parity artifacts plus the `epoch-allocation-close` denial smoke before #160 review.
- Do not start #161, deploy Production, enable cutover/value flow, or retire the
  retained prior worktree branch before lifecycle cleanup is authorized.

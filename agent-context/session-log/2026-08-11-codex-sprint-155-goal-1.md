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

### session v8: Preserve failed parity diagnostics (#160)

- Timestamp: 2026-08-12T07:35:00-04:00
- Agent: Codex
- Branch: `codex/155-goal-1-delivery-integrity-post-ci`
- Head: `adc861f4ed35964ef46b9381426329fa69b7c504`

#### Objective

Apply the independent validator's pre-publish hardening note so a failed delivery
verification can still retain any sanitized parity record produced before failure.

#### Actions Taken

- Made the parity artifact step explicitly failure-safe with `always()` while still
  restricting collection to resolved deploy-mode runs.
- Changed an entirely absent artifact set to a warning so diagnostic collection does
  not replace the primary migration, parity, deploy, or smoke failure.
- Extended the focused workflow contract test to pin both behaviors.

#### Tests And Validation Notes

- Passed: Node 22 focused delivery-parity suite, workflow YAML parsing, focused
  ESLint, and `git diff --check`.

#### Reflections

Failure evidence is useful only when it remains sanitized and cannot obscure the
original gate result. The deploy-mode condition prevents dry-run collection, while
`always()` preserves safely generated partial diagnostics.

#### Suggested Next Steps

- Publish only through the orchestrator's Goal PR flow, then re-run independent #160
  validation after the candidate has merged and the CI-owned Dev deployment finishes.
- Do not deploy manually, start #161, or cross the Production/value-flow boundary.

### session v9: Preserve Node and Edge observer interoperability (#160)

- Timestamp: 2026-08-12T07:44:03-04:00
- Agent: Codex
- Branch: `codex/155-goal-1-delivery-integrity-post-ci`
- Head: `5f0b2f7970525b9aba920e7d1853889762b44488`

#### Objective

Repair PR #191's contracts-test regression without reversing the Edge-safe ownership
direction established for the Base intake v2 receipt observer.

#### Actions Taken

- Reproduced the Node 22 named-export failure in the contracts suite: the root-owned
  `.js` implementation was interpreted across the root/CommonJS and contracts/ESM
  package boundary and therefore did not expose the requested ESM named export.
- Renamed the application-owned observer implementation to explicit `.mjs` and updated
  both the contracts re-export and Edge entrypoint to import that canonical module.
- Updated the focused delivery regression to require the application-owned `.mjs`
  implementation while continuing to reject a dependency back into `contracts/`.

#### Tests And Validation Notes

- Passed: Node 22 `pnpm --dir contracts test`, 17/17 tests.
- Passed: frozen Deno import resolution for `base-intake-v2-reconcile`.
- Passed: Node 22 focused delivery-parity suite, 5/5 with one fork worker.
- Passed: focused ESLint, full TypeScript typecheck, and `git diff --check`.

#### Reflections

An explicit `.mjs` boundary is narrower and more reliable than changing module type
for the entire root or onchain directory. Both runtimes now consume the same reviewed
implementation without making the Edge closure depend on the contracts workspace.

#### Suggested Next Steps

- Let the orchestrator push the existing branch and require PR #191's Contracts Test
  plus all #160 delivery gates to pass before merge.
- Do not deploy manually, start #161, or cross the Production/value-flow boundary.

### session v10: Close PR #191 exact-parity review gaps (#160)

- Timestamp: 2026-08-12T08:06:33-04:00
- Agent: Codex
- Branch: `codex/155-goal-1-delivery-integrity-post-ci`
- Head: `180720531c4cbc960642f8b7f7986d90b881a54a`

#### Objective

Address all four actionable PR #191 review findings without weakening exact schema,
migration, function-source, or pre-mutation delivery coverage.

#### Actions Taken

- Added a forward-only append-only deploy-evidence table and generated type. Before
  `db push`, CI now persists the reviewed candidate's sorted migration filenames and
  exact raw-byte SHA-256 values with Git SHA, Actions run/attempt, target environment,
  and project ref. Post-deploy parity reads back and independently recomputes every
  file and aggregate digest; missing or changed evidence fails `migration-digest`.
- Replaced downloaded-file-selected local hashing with an independently derived
  transitive checkout closure. Remote missing/extra paths fail before byte comparison,
  and expected/observed closure digests are computed from their own path sets.
- Moved dependency install and frozen Deno graph resolution ahead of both PR dry-run
  and deploy database steps, so an invalid Edge graph cannot follow remote mutation.
- Implemented contract section 2.4 exactly: Postgres 17 `pg_dump --no-comments`, CRLF
  conversion, comment/blank/restrict removal, trailing ASCII-space trimming, exactly
  one final LF, full public schema coverage, and exact client-version recording.
- Added positive/negative tests for migration byte/binding/duplicate drift, function
  closure path drift, workflow ordering, append-only evidence, and normalization.
- Updated the deployment runbook for the new evidence and closure boundaries.

#### Tests And Validation Notes

- Passed: Node 22 focused delivery-parity suite, 8/8 tests.
- Passed: frozen Deno import resolution for all 62 Edge Function entrypoints.
- Passed: task-owned fresh replay of 94 migrations through `20260812120000`, three
  representative SQL suites, invalid migration rejection, and scoped cleanup.
- Passed: candidate-bound two-stack Postgres 17 schema parity, including remote
  migration digest read-back and canonical full-public-schema SHA-256
  `1d9b2700029d53c82d59b077fa52cbed6802120b6755b9821d278ebfd3c50102`;
  reviewed migration inventory SHA-256
  `40481dbaf772009a793295402a7e07473e269e6502bb2bf77b80776625484f0e`.
- Passed: Node 22 contracts, 17/17; focused ESLint; full TypeScript typecheck;
  workflow YAML parsing; script syntax; and `git diff --check`.

#### Reflections

Versions, downloaded paths, and nominal step ordering are each weaker than reviewed
bytes and independent derivation. The delivery record now survives as append-only
remote evidence, and graph/schema checks fail before the authority they guard.

#### Suggested Next Steps

- Let the orchestrator push the existing PR branch, reply to and resolve the four
  named review threads, then require all PR checks without requesting rereview.
- Do not deploy manually, start #161, or cross the Production/value-flow boundary.

### session v11: Preserve sanitized Dev schema-drift diagnostics (#160)

- Timestamp: 2026-08-12T10:43:59-04:00
- Agent: Codex
- Branch: `codex/155-goal-1-dev-schema-drift-recovery`
- Head: `367c7ed083d96def7455e5135486682562016e5f`

#### Objective

Make the authoritative post-merge Dev schema mismatch diagnosable from a PR without
mutating Dev, disclosing remote definitions, or allowing unknown drift to pass.

#### Actions Taken

- Added PR-to-Dev read-only diagnostic mode after the non-mutating migration plan.
  It replays all 94 migrations in a randomized Postgres 17 stack and compares the
  complete canonical `public` schema against a read-only Dev dump.
- Added `fundloop.public-schema-diagnostic/v1`, written before schema mismatch throws.
  It records exact full-schema hashes/counts, complete per-object hash manifests,
  reviewed missing/changed object labels, opaque hashes for unknown remote object
  identities, and at most 200 line-number/hash differences with a total count.
- Kept unknown drift blocking. The diagnostic contains no DDL, function bodies,
  default expressions, row data, database URLs, credentials, secrets, PII, or unknown
  remote names; full hashes and manifests preserve coverage despite bounded line output.
- Added failure-safe artifact upload for PR Dev diagnostics and included the same file
  in deploy-mode parity artifacts so a future failed verifier still yields evidence.
- Extended focused tests and documented the read-only, sanitized, fail-closed contract.

#### Tests And Validation Notes

- Passed: Node 22 focused delivery-parity suite, 9/9 tests; workflow YAML and script
  syntax; focused ESLint; and `git diff --check`.
- Passed: disposable structural-drift smoke against two task-owned Postgres 17 stacks.
  One added column failed closed with expected SHA
  `1d9b2700029d53c82d59b077fa52cbed6802120b6755b9821d278ebfd3c50102`
  and observed SHA
  `6c9e1416a58d9a5f74b97865764ac5ed91a97b42e8bcbb5386edee090bf33924`;
  one changed object and 11,552 differing line positions were counted, 200 line hashes
  were sampled, and neither the injected identifier nor DDL appeared in the artifact.
- Passed: task-owned stacks stopped without backup and no matching containers remained.
- Passed: Node 22 `CI=1 pnpm check`: lint, 173 files / 842 tests, typecheck, and Next
  production build with 165 generated pages.
- Actual Dev diagnosis is intentionally deferred to the PR workflow: its environment-
  scoped pooler URL was not present locally and no credential was requested.

#### Reflections

A diagnostic can retain complete structural accountability without publishing remote
definitions. Known reviewed identifiers are useful context; unknown identities and
all differing lines remain opaque hashes, while aggregate hashes ensure nothing is
silently excluded or normalized away.

#### Suggested Next Steps

- Let the orchestrator publish the existing branch, inspect the sanitized PR artifact,
  and scope a forward-only repair from the named structural differences.
- Keep #160 In Progress; do not deploy manually, start #161, mutate Production, or
  enable value flow while Dev schema drift remains unexplained.

### session v12: Bind and repair the exact Dev schema drift (#160)

- Timestamp: 2026-08-12T11:16:13-04:00
- Agent: Codex
- Branch: `codex/155-goal-1-dev-schema-drift-recovery`
- Head: `1ba90db45a3c3893e40e990a220691d0f2f23d7a`

#### Objective

Identify PR #192's sanitized Dev drift without disclosing the unknown object name,
then provide a forward-only repair whose PR exception is bound to that exact state
and whose post-deploy verifier still requires zero drift.

#### Actions Taken

- Read artifact `9146378398` and used the Supabase Management API read-only database
  role to inspect catalog metadata only. No rows, URLs, definitions outside reviewed
  objects, credentials, PII, or unknown raw object names were retrieved into evidence.
- Bound the differences to the legacy Boolean parse tree for
  `monthly_cycles_month_bounds_check`, environment-specific output ordering for the
  unchanged `public_payments_read_all` role set, and one duplicate permissive anon
  INSERT policy on reviewed `cron_logs` identified only by its object-key SHA-256.
- Added a forward-only migration that accepts only the already-clean state or the
  complete exact catalog precondition. The drift path drops the extra policy through
  its opaque identity hash and rebuilds the reviewed constraint; every other state
  fails with SQLSTATE `55000`.
- Added a versioned repair manifest and PR evaluator. The exception requires the exact
  legacy schema/object signature, value flow disabled, all first 94 reviewed migration
  bytes matching inventory SHA-256 `40481dba...`, and the repair as the sole pending
  migration. Deploy mode retains strict full-history and zero-drift enforcement.
- Advanced schema normalization to v2 by sorting only the unordered policy-role set,
  removing role-OID output nondeterminism without excluding any schema object or
  definition. Updated the evidence contract, evaluator/schema, fixture, and runbook.

#### Tests And Validation Notes

- Passed: Node 22 focused delivery/evidence suites, 65/65 tests; focused ESLint,
  script syntax, workflow YAML parsing, strict AJV Draft 2020-12, and diff check.
- Passed: pinned Supabase CLI 2.113.0 fresh replay of 95 migrations through
  `20260812130000`, three representative SQL suites, invalid-migration rejection with
  intact valid history, and task-owned cleanup.
- Passed: disposable full-schema repair probe. Both the exact opaque-hash drift path
  and already-clean path converged byte-for-byte under normalization v2; the raw
  unknown policy name never appeared in output or tracked files.
- Passed: Node 22 `CI=1 pnpm check`: lint, 173 files / 845 tests, typecheck, and Next
  production build with 165 generated pages.
- Candidate migration inventory is 95 files with SHA-256
  `8162d0148248a6f46afaaff3ea96aa17783a0e179bb9d5895d840e5b88bc7348`;
  production value flow remained disabled and no remote write occurred.

#### Reflections

Catalog semantics distinguish repairable drift from presentation nondeterminism. An
opaque identity hash can safely target one reviewed duplicate without publishing its
name, while the immutable baseline byte inventory prevents a rewritten migration from
borrowing the repair exception.

#### Suggested Next Steps

- Let the orchestrator independently validate and publish the existing draft PR, then
  require the CI-owned Dev deploy to apply the repair and produce strict zero-drift
  schema/function parity before #160 can pass.
- Do not manually mutate Dev, touch Production, enable value flow, or start #161.

### session v13: Fail closed when reviewed payment policy is absent (#160)

- Timestamp: 2026-08-12T11:42:52-04:00
- Agent: Codex
- Branch: `codex/155-goal-1-dev-schema-drift-recovery`
- Head: `46e84bd90b7f8126982f3da5d9f0f3a93574c28c`

#### Objective

Address PR #192 review feedback showing that an absent
`public_payments_read_all` policy makes the exact-drift predicate null and could let
the migration continue past its fail-closed guard.

#### Actions Taken

- Changed the repair precondition guard to require the exact-drift predicate to be
  explicitly true; false and null now both raise SQLSTATE `55000` before any DDL.
- Added focused regression coverage for the null-safe predicate and removal of the
  unsafe `IF NOT` form.

#### Tests And Validation Notes

- Passed: Node 22 focused Supabase delivery parity suite, 11/11 tests; focused ESLint
  and `git diff --check`.
- Passed: disposable PostgreSQL 17 missing-policy probe with the other exact drift
  preconditions present. The migration returned SQLSTATE `55000`; the before/after
  catalog fingerprint remained `6fa78d9d5083bb55ffe00dcdc924f4d8`.
- The task-owned probe database was stopped and its container removed. No remote
  database, deployment, branch, PR thread, or Production state was changed.

#### Reflections

SQL three-valued logic must be handled explicitly in destructive precondition gates;
only a literal true value may authorize the repair path.

#### Suggested Next Steps

- Let the parent inspect and push this focused fix, then reply to and resolve the
  review thread after the pushed commit is available.
- Keep #160 In Progress until the CI-owned Dev deploy proves strict zero drift.

### session v14: Confirm reviewed Edge Function prune in CI (#160)

- Timestamp: 2026-08-12T14:21:06-04:00
- Agent: Codex
- Branch: `codex/155-goal-1-function-prune-recovery`
- Head: `c840ec9421486cc48aa5d28d48614ccbafc7861b`

#### Objective

Allow the noninteractive CI-owned Dev deployment to delete the one exact reviewed
retired Edge Function only after the existing parity guard authorizes that inventory.

#### Actions Taken

- Added the Supabase CLI global `--yes` flag to the existing all-function deploy and
  prune command so GitHub-hosted CI confirms the reviewed deletion without a prompt.
- Strengthened the workflow contract test to require the predeploy inventory guard,
  confirmed prune, and postdeploy read-back in that exact order, and to reject the
  former unconfirmed command.
- Documented that confirmation derives solely from the due, environment-scoped
  retirement manifest; unexplained extras still fail before any prune.

#### Tests And Validation Notes

- Passed: Node 22 focused Supabase delivery parity suite, 11/11 tests, and focused
  ESLint.
- Passed: workflow YAML parse and `git diff --check`.
- Passed: local pinned Supabase CLI help contract exposes `--prune`, `--jobs`, and the
  global `--yes` flag accepted by the deploy command.
- No Supabase project was linked or mutated; no workflow, push, PR, Production action,
  function deletion, or value-flow activation occurred.

#### Reflections

Noninteractive confirmation is safe only after a separately tested verifier narrows
the destructive set to reviewed retirements. Ordering that verifier before mutation
and retaining postdeploy read-back keeps the operation fail closed.

#### Suggested Next Steps

- Let the orchestrator independently validate and publish this branch, then require
  the CI-owned Dev run to prune the retired function and complete exact postdeploy
  read-back plus the safe runtime smoke.
- Keep #160 In Progress and do not start #161 until that hosted evidence passes.

### session v15: Secure Management API function source read-back (#160)

- Timestamp: 2026-08-12T16:14:48-04:00
- Agent: Codex
- Branch: `codex/155-goal-1-function-source-readback-recovery`
- Head: `6868db96e31cab9bf3f711b224347296b3825924`

#### Objective

Replace the pinned CLI's filesystem extraction failure with a repo-owned, read-only
source verifier that preserves exact closure and byte parity for all reviewed Edge
Functions.

#### Actions Taken

- Reproduced the pinned Supabase CLI 2.113.0 Management API contract from its tagged
  Go source: authenticated GET of the function body with an
  `Accept: multipart/form-data` response, `Supabase-Path` precedence, and
  Content-Disposition filename fallback.
- Replaced `supabase functions download --use-api` with a bounded multipart reader
  against the same official endpoint. It validates project refs and slugs, rejects
  redirects/non-200 responses and sanitizes transport failures without exposing
  tokens, bodies, or unreviewed remote paths.
- Enforced response, part-count, and per-file limits; exact terminal framing; regular
  file-only entries; safe relative paths; duplicate/case/Unicode collision rejection;
  and normalization of only the known `fundloop-website/` archive prefix.
- Preserved independently derived checkout closures, exact missing/extra comparison,
  byte-for-byte checks, canonical source digests, and remote deployment bindings.
  Unknown extra paths are reported only by count and opaque SHA-256.
- Added a synthetic Management API fixture matrix and documented that this is direct
  multipart source read-back rather than ZIP extraction.

#### Tests And Validation Notes

- Passed: Node 22 focused source-readback and delivery-parity suites, 28/28 tests;
  focused ESLint and TypeScript typecheck.
- Passed: synthetic good monorepo closure and negative probes for traversal, absolute
  paths, symlink/non-regular markers, duplicate/colliding paths, missing/extra paths,
  changed bytes, response/file/count limits, malformed/truncated/trailing multipart,
  `Supabase-Path` precedence, non-200/redirect/auth/transport failures, and identifier
  validation. Secret-like unknown paths and provider/token/body text remained absent
  from errors.
- Passed: script syntax, workflow YAML parse, and `git diff --check`.
- Passed: Node 22 `CI=1 pnpm check`, including lint, the full test suite, typecheck,
  and Next production build with 165 generated pages.
- No Management API or Supabase project was called or mutated; no workflow, push, PR,
  Production action, #161 work, or value-flow activation occurred.

#### Reflections

Remote bundle metadata is untrusted even when it comes from the deployment provider.
Parsing the official multipart contract in memory avoids the CLI extractor's shared
filesystem assumptions while keeping every reviewed closure byte covered.

#### Suggested Next Steps

- Let the orchestrator independently validate and publish the branch, then require
  CI-owned postdeploy read-back across all 62 active functions and the safe Dev smoke.
- Keep #160 In Progress until that hosted evidence passes; do not start #161.

### session v16: Fully validate multipart MIME parameters (#160)

- Timestamp: 2026-08-12T16:22:43-04:00
- Agent: Codex
- Branch: `codex/155-goal-1-function-source-readback-recovery`
- Head: `ef3fbaf18878914b31f08e18b4afe5fd5cc5cce5`

#### Objective

Address independent validator findings by making the function source reader reject
ambiguous or partially parsed multipart MIME parameters before trusting any path.

#### Actions Taken

- Replaced permissive Content-Disposition and boundary parsing with one strict parser
  that consumes the complete type and parameter grammar, accepts valid token and
  quoted-string values, and rejects duplicate names, malformed escapes, unterminated
  quotes, empty values, and all unconsumed trailing syntax.
- Preserved official `Supabase-Path` precedence while requiring Content-Disposition
  itself to be valid before either path source is used.
- Added adversarial coverage for duplicate `name`/`filename`, trailing junk,
  malformed/duplicate boundary and charset parameters, and legal quoted escapes.

#### Tests And Validation Notes

- Passed: Node 22 focused source-readback and delivery-parity suites, 36/36 tests;
  focused ESLint and TypeScript typecheck.
- Passed: script syntax, workflow YAML parse, and `git diff --check`.
- Full `CI=1 pnpm check` was not repeated for this localized parser follow-up; it
  passed in session v15 before the validator fix.
- No network request, remote Supabase mutation, workflow, push, PR, Production action,
  #161 work, or value-flow activation occurred.

#### Reflections

Security-sensitive MIME parsing must reject ambiguity, not merely extract the fields
it recognizes. Full consumption makes duplicate or trailing attacker-controlled
syntax impossible to silently ignore.

#### Suggested Next Steps

- Return this follow-up to independent validation, then let the orchestrator publish
  and require CI-owned read-back of all 62 functions plus the safe Dev smoke.
- Keep #160 In Progress until that hosted evidence passes.

### session v20: Enforce authenticated Edge smoke semantics (#160)

- Timestamp: 2026-08-12T17:28:03-04:00
- Agent: Codex
- Branch: `codex/155-goal-1-safe-auth-smoke-recovery`
- Head: `5e2a5fef76575c9cac08af440acb5b21656491aa`

#### Objective

Make the safe unauthenticated Dev smoke prove the function's own authorization
boundary with HTTP `401`, without exposing payload validation or changing gateway JWT
mode.

#### Actions Taken

- Added a repo-owned authenticated POST HTTP boundary used by
  `epoch-allocation-close`: OPTIONS remains public, then authentication runs before
  method and command-body handling.
- Returned fixed, non-provider-controlled envelopes with `401` for unauthenticated
  requests, `405` plus `Allow: POST` for authenticated non-POST requests, and `400`
  for authenticated invalid JSON/command payloads. Authentication infrastructure
  failures return a generic `500`.
- Made authenticated non-admin operator actions explicitly `403`; preserved all
  existing downstream domain/RPC failure envelope status behavior to minimize scope.
- Added injected-auth tests of the actual shared HTTP handler used by the Edge wrapper,
  including an unauthenticated malformed POST whose downstream parser spy remains
  untouched. Added wrapper ordering/status contract assertions and documented why
  `verify_jwt=false` remains intentional.

#### Tests And Validation Notes

- Passed: Node 22 focused HTTP, epoch-close contract, and delivery-parity suites,
  21/21 tests; focused ESLint and TypeScript typecheck.
- Passed: Deno check of `epoch-allocation-close`, workflow YAML parse, and
  `git diff --check`.
- Tests prove unauthenticated GET and malformed POST return `401`, authenticated GET
  returns `405`, authenticated malformed POST returns `400`, OPTIONS skips auth,
  forbidden returns `403`, and provider-controlled auth error text is never echoed.
- No remote request or mutation, workflow, push, PR, Project status change, Production
  action, #161 work, or value-flow activation occurred.

#### Reflections

An auth smoke is meaningful only when the application handler—not merely the gateway—
returns an explicit denial. Authenticating before parsing also prevents unauthenticated
callers from using validation differences as a command-shape oracle.

#### Suggested Next Steps

- Return this commit to independent validation, then require the CI-owned Dev deploy
  to complete exact parity and observe the unauthenticated `401` smoke.
- Keep #160 In Progress until that hosted run passes.

### session v19: Bind inline-type module edges retained by Supabase (#160)

- Timestamp: 2026-08-12T17:01:05-04:00
- Agent: Codex
- Branch: `codex/155-goal-1-inline-type-module-recovery`
- Head: `b10c0db3d2d0a8cf6589ad3a47b68b5ddd3765ba`

#### Objective

Match Supabase's observed bundle closure by retaining ordinary module declarations
whose named bindings are all inline `type`, without restoring erased whole-declaration
type imports.

#### Actions Taken

- Narrowed exclusion to `ImportClause.isTypeOnly` and `ExportDeclaration.isTypeOnly`,
  the AST representation of whole `import type` and `export type` declarations.
- Kept every ordinary import/export declaration bound even when all named specifiers
  use inline `type`, while preserving all prior runtime, dynamic, JSON, and fail-closed
  behavior.
- Updated the synthetic graph so inline-only import and re-export modules are included
  while whole-declaration type-only modules remain omitted.
- Proved all 62 closures derive and admin reconciliation includes reviewed
  `lib/onchain/payment-submissions.ts` but excludes whole-declaration-only
  `types/supabase.ts`. Updated the deployment runbook.

#### Tests And Validation Notes

- Passed: Node 22 focused source-readback and delivery-parity suites, 41/41 tests.
- Passed: focused ESLint, TypeScript typecheck, script syntax, workflow YAML parse,
  and `git diff --check`.
- No remote request or mutation, workflow, push, PR, Project status change, Production
  action, #161 work, or value-flow activation occurred.

#### Reflections

Supabase's bundle preserves module edges from ordinary declarations even when their
bindings are inline types. The verifier must follow observed compiler semantics at
the declaration level rather than infer erasure from individual specifiers.

#### Suggested Next Steps

- Return this commit to independent validation, then require CI-owned all-function
  read-back and safe Dev smoke before advancing #160.

### session v18: Fail closed on ambiguous dynamic imports (#160)

- Timestamp: 2026-08-12T16:45:15-04:00
- Agent: Codex
- Branch: `codex/155-goal-1-runtime-source-closure-recovery`
- Head: `95ecd23be0947e63eb1c675923dac7c58fa0352b`

#### Objective

Address independent validation by covering standard two-argument dynamic imports and
refusing any dynamic dependency that cannot be derived exactly.

#### Actions Taken

- Accepted string-literal dynamic imports with either one argument or the standard
  second import-attributes/options argument.
- Continued deriving the first literal source for two-argument JSON imports so the
  runtime asset remains byte-bound.
- Made nonliteral dynamic import specifiers and invalid arity fail closed instead of
  silently omitting a possible repository dependency.
- Added positive one-/two-argument and negative nonliteral/over-arity coverage and
  documented the exact dynamic-import contract.

#### Tests And Validation Notes

- Passed: Node 22 focused source-readback and delivery-parity suites, 41/41 tests.
- Passed: focused ESLint, TypeScript typecheck, script syntax, workflow YAML parse,
  and `git diff --check`.
- No network request, remote mutation, workflow, push, PR, Production action, #161
  work, or value-flow activation occurred.

#### Reflections

Dynamic import options do not change the dependency identity, but a nonliteral first
argument makes that identity unknowable. Closure verification must accept the former
and reject the latter.

#### Suggested Next Steps

- Return this follow-up to independent validation, then require CI-owned all-function
  read-back and the safe Dev smoke before #160 progresses.

### session v17: Derive runtime-only Edge Function source closures (#160)

- Timestamp: 2026-08-12T16:42:06-04:00
- Agent: Codex
- Branch: `codex/155-goal-1-runtime-source-closure-recovery`
- Head: `064b64730ee562b516be605a8e0ec3abd85439fa`

#### Objective

Match the reviewed expected source closure to Deno's deployed runtime graph without
allowlisting the missing `types/supabase.ts` module or conceding any remote content.

#### Actions Taken

- Replaced regex import discovery with the repo-pinned TypeScript 5.9 compiler API.
- Excluded only erased whole `import type` / `export type` edges and named clauses
  whose specifiers are all inline `type`; mixed clauses with a value remain runtime
  dependencies.
- Preserved value imports/re-exports, export-star edges, side-effect imports, dynamic
  imports, and runtime JSON assets. Invalid TypeScript parse diagnostics fail closed.
- Added a synthetic runtime graph covering pure type-only, inline type-only, mixed,
  side-effect, dynamic, value re-export, type re-export, and export-star cases.
- Proved all 62 function closures derive and the admin reconciliation closure omits
  `types/supabase.ts` while retaining its reviewed value-bearing modules. Documented
  the compiler dependency and retained pre-mutation Deno graph guard.

#### Tests And Validation Notes

- Passed: Node 22 focused source-readback and delivery-parity suites, 39/39 tests,
  including all-62 closure derivation and fail-closed invalid syntax.
- Passed: focused ESLint, TypeScript typecheck, script syntax, workflow YAML parse,
  and `git diff --check`.
- Full `CI=1 pnpm check` was not repeated; the focused all-function graph plus
  typecheck is proportionate, and the full check passed in session v15.
- No remote API call or mutation, workflow, push, PR, status change, Production
  action, #161 work, or value-flow activation occurred.

#### Reflections

Expected parity must model the runtime compiler graph rather than textual references.
Using language semantics removes erased type edges precisely while continuing to bind
every deployed value-bearing source byte.

#### Suggested Next Steps

- Return the commit to independent validation, then let the orchestrator publish and
  require CI-owned read-back of all 62 functions plus the safe Dev smoke.
- Keep #160 In Progress until that hosted evidence passes.

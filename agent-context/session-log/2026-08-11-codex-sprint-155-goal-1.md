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

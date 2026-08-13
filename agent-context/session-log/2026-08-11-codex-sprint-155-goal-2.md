### session v1: harden post-reset persona readiness (#164)

- Timestamp: 2026-08-13T12:18:41Z
- Agent: Codex (`issue-implementer` handoff)
- Branch: `codex/155-goal-2-integrated-evidence`
- Head before commit: `9b72cc01cf8ba82e28d92d565bb07e69fc825d24`
- Objective: prevent persona fixtures from starting against stale or partially recovered local schema, Auth, Storage, Mailpit, Edge Functions, or Next runtime after reset.
- Actions: added a classified bounded readiness contract; bound Edge probes to the selected persona inventory; added the current deploy-completion schema sentinel, Storage and service-role-only local sentinel probes; added per-run Next commit/nonce identity; recovered one validated stale local Kong container; retained sanitized readiness evidence; bounded attribution-row and cold review visibility; documented the reset lifecycle.
- Validation: focused Vitest `8/8`, Node 22 typecheck, JS syntax and diff checks passed. Three fresh replay/start all-five-persona runs passed with every checkpoint and cleanup clean (`persona-20260813T114610047Z-73ef1742`, `persona-20260813T115629164Z-8c29c1b6`, `persona-20260813T120609029Z-cbd25426`). Forced self-test passed. The broader Feature #118 matrix proved fresh replay, all-five-persona pass, and final zero-residue reset, then remained red in the existing local-wallet fixture with `epoch_project_package_payment_rail_claim_mismatch`; that batch-level failure is assigned to #165/#186 and is not represented as hosted evidence.
- Reflections: local CLI reset can return before healthy Auth/Storage routing and can leave Kong bound to stale container addresses. Docker health alone is insufficient; exact HTTP readiness and app identity must gate fixture creation.
- Next steps: implement #165's exact Pay by Bank fixture/provenance coverage, then #181/#186; rerun the complete Feature #118 matrix before independent validation or Goal publication.

### session v2: prove exact EUR Pay by Bank allocation and replay (#165)

- Timestamp: 2026-08-13T12:34:00Z
- Agent: Codex (`issue-implementer` handoff)
- Branch: `codex/155-goal-2-integrated-evidence`
- Head before commit: `50051b95d34346173c8fa361a558fd7db2cbb7ae`
- Objective: carry one authoritative EUR Pay by Bank settlement through native/functional valuation, fee and source provenance, v2 allocation, reproducible close, and refund invalidation without enabling value flow.
- Actions: converted the real Pay by Bank provider/ledger/package fixture to EUR; added a closed-window v2 preview, lock, calculation replay, close replay, cap/top-up and immutable-root assertions; made invalidation exactly once; repaired the local wallet fixture's missing settled-rail claim; and added a forward-only v2 calculation replay wrapper that returns an identical calculated run while rejecting changed hashes.
- Validation: fresh local migration replay applied the new migration. Exact EUR SQL and the browser allocation fixture passed with rollback and no residue. Focused Vitest passed `16/16`; Node 22 typecheck and scoped ESLint passed. All evidence is local fixture evidence, not hosted/provider certification; Production and value-flow controls remained disabled.
- Reflections: the batch failure was a truthful integrity-trigger rejection of an incomplete browser fixture. Integrated EUR coverage then exposed a separate product defect: identical v2 result replay was rejected after the manifest advanced to `calculated`. Checking the immutable existing result before invoking the once-only calculator preserves conflict safety and restores idempotency.
- Next steps: independent validation remains pending. Implement #181 and #186 on this branch, then rerun the complete Feature #118 matrix and the Goal-level adversarial gate before publication.

### session v3: generate and publish deterministic audience reports (#181)

- Timestamp: 2026-08-13T12:46:00Z
- Agent: Codex (`issue-implementer` handoff)
- Branch: `codex/155-goal-2-integrated-evidence`
- Head before commit: `f06cd431ee9b733b226626e31dd45ea4d2a483f3`
- Objective: replace metadata-first reporting with deterministic, authorized generation, publication, explanation, audit, retention, and MCP reads for every required audience.
- Actions: added forward-only report artifact/event schema and generated types; typed generate/publish/read Edge commands; close-root-bound public, user, founder, operator, and MCP artifacts; completeness/hash/replay gates; seven-year executable tombstones; public/self/founder/operator MCP authorization; and an MCP artifact-read tool. Updated the EUR integrated close fixture to prove five-audience generation/publication, exact replay, Production denial, and retention audit.
- Validation: fresh local replay applied both reporting migrations. The integrated SQL smoke passed inside rollback with five generated/published/tombstoned audiences and no residue. Focused report/storage/MCP Vitest passed `54/54`; Node 22 typecheck, scoped ESLint, Deno check for the new Edge Function, and `git diff --check` passed. Hosted Dev verification remains explicitly owned by #183 and was not claimed.
- Reflections: enum expansion must commit before later migration constraints reference the new value. Retention mutation and later assertions must be sequenced in PL/pgSQL rather than embedded in one reorderable boolean expression. MCP coverage needs a real callable tool, not only an unregistered Edge operation.
- Next steps: independent validation remains pending. Implement #186's complete TAP/four-epoch lifecycle, rerun Feature #118 and the Goal adversarial batch, then hand the complete branch to validators and #188 publication.

### session v4: complete TAP discovery and four-epoch redistribution lifecycle (#186)

- Timestamp: 2026-08-13T13:28:00Z
- Agent: Codex (`issue-implementer` handoff)
- Branch: `codex/155-goal-2-integrated-evidence`
- Head before commit: `133278c589265a9b8459447da98104f4878f04dd`
- Objective: replace partial hard-coded database execution with a complete deterministic TAP runner and prove the fixture-backed E-3 through E redistribution lifecycle without hosted or value-flow activity.
- Actions: added top-level SQL/shell discovery with explicit wrapper ownership, isolated setup/cleanup resets, one exact reset recovery, per-command timeouts, clean TAP diagnostics, and nonzero failure propagation; added a four-epoch fixture that reuses the integrated EUR close and preserves source-fill, project, rail, asset, custody, FX, and evidence provenance while asserting E-3-only harvest, carry-in, current funding, balance conservation, replay/conflict behavior, capped top-up, and deterministic close/report hashes. Hardened cold persona execution by warming critical Next routes before Playwright and aligning the project review visibility timeout with the existing 60-second publish gate.
- Validation: canonical database runner passed valid TAP `1..21` with every suite `ok`, including isolated pre-feature migration and concurrency suites. Clean focused four-epoch replay passed `BEGIN/DO/ROLLBACK`; runner Vitest `5/5`, v2 calculator `12/12`, persona harness Vitest `16/16`, Node 22 typecheck, and scoped ESLint passed. The broad Feature #118 gate is not green: its first run had a single cold project-review timeout (4/5 personas, clean cleanup); a focused retry then hit local Edge CPU hard limits and a 113-second cold compile; the post-hardening retry could not reach personas because repeated local Supabase resets exhausted the Storage container, despite bounded retries and final reset. This is local fixture evidence only.
- Reflections: the complete failure set exposed two independent harness concerns: reset recovery must leave a known schema before continuing, and route compilation belongs in readiness rather than inside measured persona journeys. The canonical SQL gate is now complete and green, but the required batch gate must be rerun from a recovered local stack before validation/publication.
- Next steps: recover the task-owned local Supabase stack, rerun Feature #118 and `CI=1 pnpm check`, fix any real failures as one batch, then hand all four In Progress issues to independent validation. Do not start hosted #166/#182/#183 or publish #188 from this checkpoint.

### session v5: accept fixture-absent route warmup evidence (Goal 2 integration)

- Timestamp: 2026-08-13T14:24:00Z
- Agent: Codex (`issue-implementer` integration pass)
- Branch: `codex/155-goal-2-integrated-evidence`
- Head before commit: `31bd59d59a56f6ca89d50fb9824e69f57dbc9140`
- Objective: make the Goal 2 broad operational gate exercise product flows after deterministic cold-route compilation without weakening any persona assertion.
- Actions: recovered the documented lean local Supabase stack after the excluded Vector service attempted an unsupported Colima socket bind; restricted cold-route warmup to public user/project onboarding; refreshed the modal manager's profile status when the requested flow changes; and made review resumption wait for the exact flow-specific draft heading before clicking. This prevents a stale personal-draft surface from satisfying the project draft locator while preserving every publish/persistence assertion. Protected operator pages remain exclusively exercised after authentication and run-owned fixture creation.
- Validation: exact matrix runs passed fresh replay and final zero-residue reset while harvesting two harness failures before the final run: anonymous protected-route warmup correctly failed authentication, then one five-persona run reached 4/5 green with clean cleanup and showed the generic `Continue draft` locator could select a stale personal flow. Focused persona harness contracts, scoped lint, typecheck, the final matrix, `CI=1 pnpm check`, and proportionate database recheck follow this amended commit.
- Reflections: readiness warming may compile only routes whose preconditions the phase owns. Modal eligibility must refresh after profile activation, and resume actions must be scoped by flow identity rather than shared button text. Product authorization and persistence stay in the authenticated journeys.
- Next steps: rerun focused harness contracts and the complete Feature #118 matrix, then run the Node 22 full check and stop every task-owned local service before independent validation handoff.

### session v6: gate local-wallet resets on the current PostgREST schema (#186)

- Timestamp: 2026-08-13T14:44:13Z
- Agent: Codex (`issue-implementer` integration fix)
- Branch: `codex/155-goal-2-integrated-evidence`
- Head before commit: `fb02676d805d9725570fe2a8713fed0ccf3680f9`
- Objective: prevent the local-wallet lane from continuing after a CLI reset while PostgREST still has a missing or stale schema cache.
- Actions: added a bounded service-role schema sentinel after every local-wallet database reset; required HTTP 200, valid JSON, and the exact active Base/EVM/8453 `ref_chains` projection before chain sync or fixtures; removed the generic REST-root readiness shortcut; documented the reset contract; and added negative, delayed, and stale-response coverage. Updated the operational contract to follow the already-extracted persona readiness helper.
- Validation: focused Vitest passed `8/8`; scoped ESLint, Node 22 typecheck, JavaScript syntax checks, and `git diff --check` passed. Per the user boundary, Supabase was kept stopped and no Docker, reset, serve, wallet, matrix, provider, hosted, or remote command ran.
- Reflections: CLI reset completion and a non-5xx REST-root response cannot certify that PostgREST has loaded current tables and columns. A narrow data-contract probe gives the runner a truthful, classified timeout without weakening product assertions or retrying destructive resets.
- Next steps: with explicit permission to restart local Supabase, run one focused wallet startup/allocation transition. Only if green, run one complete Feature #118 matrix; only if that is green, run the Node 22 `CI=1 pnpm check`, then stop the task-owned local stack.

### session v7: close the reporting function delivery inventory (#181)

- Timestamp: 2026-08-13T14:48:00Z
- Agent: Codex (`issue-implementer` integration fix)
- Branch: `codex/155-goal-2-integrated-evidence`
- Head before commit: `e0e1eee075df552358116ca06ccecdab095e5159`
- Objective: make branch-current Supabase delivery and source-readback contracts include the new `monthly-report-publication` Edge Function.
- Actions: audited every tracked exact `62` function claim. Updated only the two tests that derive the current deployable inventory to expect 63, asserted that `monthly-report-publication` is explicitly inventoried, and proved its source closure contains the entrypoint, typed reporting contract, and shared command runtime. Preserved historical Dev certification documents and Goal 1 evidence at their observed 62-function snapshots, and preserved the environment-manifest test's intentionally synthetic 62-item fixture.
- Validation: focused delivery, source-readback, environment-manifest, and production-readiness manifest Vitest passed `118/118`; scoped ESLint, Node 22 typecheck, verifier syntax checks, and `git diff --check` passed. Supabase remained stopped; no Docker, local provider, reset, serve, wallet, matrix, or full-check command ran.
- Reflections: candidate-derived inventory assertions must advance with a new deployable entrypoint, while signed or timestamped environment evidence must remain immutable until a new hosted observation is authorized and performed.
- Next steps: retain the v6 permission gate before restarting local Supabase or running wallet/matrix validation. Hosted deployment inventory remains separate work and is not claimed by this local contract update.

### session v8: make TAP and four-epoch evidence accountable (#186)

- Timestamp: 2026-08-13T15:08:15Z
- Agent: Codex (`issue-implementer` static remediation)
- Branch: `codex/155-goal-2-integrated-evidence`
- Head before commit: `e8887f5f0809fdceb74382582a649dcf0dcb0de7`
- Objective: ensure the canonical database runner cannot turn invalid nested TAP into a passing suite, and replace the date-shift-only lifecycle fixture with executable E-3-through-E claim, harvest, calculation, close, carry, and reporting evidence.
- Actions: added strict nested TAP validation for plans, numbering, failures, bailouts, and unaccounted output; registered explicit non-TAP SQL and shell ownership contracts; retained one top-level TAP item only after setup, assertion, and cleanup resolve. Split the four-epoch lifecycle into committed setup, real two-session claim/harvest serialization, trusted TypeScript calculation, and final SQL assertions. The lifecycle now models partial reserved/queued/held/paid/closed claims plus released re-eligibility, newest-first harvest with oldest retained value, duplicate-harvest rejection, score discount, current funding, harvest, carry-in/out, initial-claim and cap limits, source-level exact/minor/native/project/rail/asset/custody/FX/evidence conservation, predecessor chaining, close/root replay, report replay, and permutation-stable calculation hashes.
- Validation: Supabase-free focused Vitest passed `29/29`; scoped ESLint, Node 22 typecheck, Node and shell syntax, discovery ownership inspection, and `git diff --check` passed. Supabase remained stopped; no Docker, Next, Edge, Playwright, provider, hosted, reset, or serve command ran.
- Reflections: exit zero is meaningful only when the runner owns an explicit non-TAP process contract or validates the nested TAP. Real concurrency evidence requires distinct database sessions and a synchronization boundary; string presence alone is only a static contract guard.
- Next steps: runtime execution of the rewritten SQL and two-session wrapper remains intentionally unproven until the user permits restarting local Supabase. At that boundary run the focused lifecycle once; a SQL/schema compatibility failure must be reported and fixed rather than converted into static success.

### session v9: bind persona readiness to the Goal 2 candidate (#164)

- Timestamp: 2026-08-13T15:21:16Z
- Agent: Codex (`issue-implementer` static remediation)
- Branch: `codex/155-goal-2-integrated-evidence`
- Head before commit: `e3bdf74044dbce6af0f6a0e68ead9db1f07390ef`
- Objective: prevent persona fixtures from accepting an old/partial schema, an incomplete manually maintained function list, or stale Edge code after a nominally successful local reset.
- Actions: replaced the old-table sentinel with a forward service-role-only Goal 2 schema identity covering 18 required relations, functions, and columns; replaced the manual persona inventory with an exact checkpoint-to-command registry including personal/project draft upsert, clear, and publish surfaces; required explicit static read-only route/source coverage for a no-function persona; and derived every selected function contract through the deployment verifier's existing transitive source-closure logic. Added a local-only secret/nonce/commit identity command that imports the checked-in exact source contracts, computes the selected contract digest inside the restarted Edge runtime, refuses Production, and performs no data/provider mutation. Kept hosted source identity assigned to the existing deployment manifest/source-readback verifier and advanced the candidate inventory to 64 functions.
- Validation: Supabase-free focused readiness, identity, delivery-inventory, and source-readback Vitest passed `63/63`; scoped ESLint, Node 22 typecheck, JavaScript syntax, and `git diff --check` passed. Adversarial cases cover delayed recovery, stale/partial schema, missing inventory, stale runtime nonce/source contract, malformed identity JSON, unsafe value-flow identity, and unjustified/mutating no-function coverage. Supabase remained stopped; no Docker, Next, Edge, Playwright, provider, hosted, reset, or serve command ran.
- Reflections: routing `OPTIONS` can prove only that a name resolves. Exact local code readiness needs a freshly restarted process to attest a repo-derived source contract it carries itself, while hosted source equivalence remains a post-deployment management-plane proof rather than a local inference.
- Next steps: runtime application of the new migration and execution of the identity command remain intentionally unproven until the user authorizes restarting local Supabase. Then run the focused persona startup/readiness transition, followed by the complete Feature #118 matrix only if focused readiness is green; hosted manifest certification remains separate authorized work.

### session v10: publish immutable versioned report objects (#181)

- Timestamp: 2026-08-13T15:37:23Z
- Agent: Codex (`issue-implementer` static remediation)
- Branch: `codex/155-goal-2-integrated-evidence`
- Head before commit: `88ba9ba9f113be390b25f1b64f290c9c1b485480`
- Objective: ensure reporting publication means an exact immutable Storage object exists, implement explicit version/supersession and PII tombstone lifecycles, and close every audience authorization boundary.
- Actions: extracted the real dependency-injected handler used by the Edge wrapper; added strict action-specific payloads and public/self/exact-founder/internal authorization; added deterministic MCP-capable Storage paths; and implemented prepare, immutable upload, exact byte/hash readback, finalize, safe partial cleanup, retryable finalize failure, and durable failure audit behavior. Added a forward-only corrective migration for canonical bytes/paths, Storage evidence, versioned read models, generate conflict, authorized regenerate/idempotency/supersession, direct-SQL publication denial, and Storage-backed PII tombstones that retain the original hash, subject evidence hash, close/version linkage, deadline, and append-only events. Advanced the Goal 2 schema identity to the complete 33-feature candidate and updated generated types, source closure evidence, SQL fixtures, and reporting operations documentation.
- Validation: Supabase-free focused handler, Storage, persona readiness, delivery/source closure, and MCP Vitest passed `110/110`; Node 22 typecheck, scoped ESLint, Deno check of the actual Edge entrypoint, JavaScript syntax, and `git diff --check` passed. Real handler tests cover generate, publish, regenerate, read, and tombstone; anonymous public, exact self, founder-admin project, operator/MCP, unauthenticated/cross-scope denials; immutable upload conflict replay; deterministic path rejection; byte/hash mismatch; multi-object partial cleanup; finalize retry; and failure-audit failure. No Supabase, Docker, Next, Edge serve, Playwright, provider, hosted, reset, or value-flow command ran.
- Reflections: a database transaction cannot certify a separate object store. Publication therefore needs a narrow two-system protocol whose database finalize step accepts only exact evidence already verified by the Edge command; SQL-only callers must fail closed. Subject erasure must remove object bytes and identifiers while retaining minimal non-PII financial evidence, not silently rewrite an allegedly immutable published object.
- Next steps: the corrective migration, Storage bucket interaction, RPC transitions, regeneration concurrency, and subject tombstone must be replayed against local Supabase only after the user permits restart. Hosted deployment/source/object proof remains owned by later Goal 2 hosted validation and is not claimed here.

### session v11: prove persisted EUR provenance without source reuse (#165)

- Timestamp: 2026-08-13T15:52:00Z
- Agent: Codex (`issue-implementer` static remediation)
- Branch: `codex/155-goal-2-integrated-evidence`
- Head before commit: `90c5fd93bd14152b07e8f5b2c47347e89dab2953`
- Objective: replace declared-input and boolean-only EUR evidence with persisted end-to-end conservation, and prevent the same EUR economic source from funding both the E-3 lifecycle and target-cycle current allocation.
- Actions: strengthened the executable EUR fixture to join the authoritative funding quote, signed provider event/evidence, exact gross/fee/net, native EUR and functional USD ledger postings, package source, FX observation/snapshot, fee ledger, valuation lot, manifest dispositions, persisted run, close artifacts/root, and report bytes/hash. Replaced the four-epoch fixture's cloned target lot with a distinct 20 EUR provider settlement and financial-prep source; bound the original 100 EUR lot exclusively to its E-3 award inventory and carry disposition, with exact protected-claim plus harvest plus carry conservation and rejection of any target source/origin reuse. Added reviewable static contract guards and documented that they supplement rather than replace executable SQL.
- Validation: Supabase-free focused Vitest passed `11/11`; scoped ESLint, Node 22 typecheck, shell syntax, and `git diff --check` passed. SQL execution, migration replay, the real calculator wrapper, and the Feature #118 matrix remain intentionally pending because Supabase must stay stopped. No Docker, Next, Edge, Playwright, provider, hosted, reset, serve, Production, or value-flow command ran.
- Reflections: a new valuation-lot row is not a new economic source when it points back to the already allocated lot. The target cycle needs genuinely independent settlement evidence, while the original source must reconcile exactly across its protected claim, harvested balance, and carry residue.
- Next steps: after explicit permission to restart local Supabase, run `supabase start`, `supabase db reset --local`, `FUNDLOOP_LOCAL_DATABASE_URL=postgresql://postgres:postgres@127.0.0.1:54322/postgres bash supabase/tests/epoch_allocation_v2_four_epoch_lifecycle.sh`, then the exact EUR SQL fixture and Feature #118 matrix only if the focused lifecycle is green. Stop the local stack afterward.

### session v12: remove subjects from report object locators (#181)

- Timestamp: 2026-08-13T16:09:00Z
- Agent: Codex (`issue-implementer` static privacy remediation)
- Branch: `codex/155-goal-2-integrated-evidence`
- Head before commit: `d68a075b01dc0c21b45bc2baabca0c2b59e48930`
- Objective: prevent private report publication and tombstone audit records from retaining raw user UUIDs or project IDs in Storage paths or event metadata.
- Actions: added a forward-only opaque-path migration that derives a domain-separated SHA-256 token from the immutable artifact identity, enforces the exact tokenized path on every artifact insert/update, returns no subjects in publication manifests, and preserves only opaque removed-path and hash evidence after tombstone. Added a fail-closed upgrade boundary for already-verified legacy objects that require a real Storage move/delete, plus a narrowly scoped migration-time metadata redaction that restores the runtime append-only trigger and appends redaction evidence without changing the original evidence hash. Updated the Edge-used path builder/handler, generated types, Goal 2 schema readiness identity/source contract, reporting operations documentation, and adversarial SQL/handler/storage tests.
- Validation: Supabase-free focused publication, storage, and persona readiness Vitest passed `34/34`; scoped ESLint, Node 22 typecheck, Deno check of the actual Edge entrypoint, JavaScript syntax, and `git diff --check` passed. Supabase remained stopped; no Docker, Next, Edge serve, Playwright, provider, hosted, reset, Production, or value-flow command ran.
- Reflections: hashing a subject into a token avoids direct disclosure, but binding the locator to the immutable artifact identity is cleaner and remains deterministic after subject erasure. A database-only migration must stop rather than claim it moved a verified Storage object; privacy repair of that object is an operator-controlled cross-system action.
- Next steps: after explicit permission to restart local Supabase, replay the forward migration and exercise generate/publish/tombstone against private local Storage, including the legacy verified-path fail-closed case. Then rerun the reporting fixture and broader Goal 2 gates; hosted Storage migration or proof remains separate authorized work.

### session v13: correct opaque-path event trigger replay (#181)

- Timestamp: 2026-08-13T16:27:00Z
- Agent: Codex (`issue-implementer` runtime certification)
- Branch: `codex/155-goal-2-integrated-evidence`
- Head before commit: `37a3532683090edd5a5f38354281aa3c3d3e8bab`
- Objective: unblock fresh migration replay after the opaque-path migration referenced a non-existent append-only event trigger.
- Actions: corrected both migration-time disable/enable statements to the trigger's exact registered name, `monthly_report_events_append_only`, and added a focused regression that binds the privacy migration to the defining migration's identifier while rejecting the erroneous variant.
- Validation: focused publication contract Vitest and diff checks passed before commit. The exact fresh lean Supabase replay is the next authorized runtime gate; no remote, hosted, Production, provider, payout, or value-flow state is in scope.
- Reflections: PostgreSQL trigger names are table-local runtime identifiers and must match the defining migration exactly; a similarly named table does not imply a generated trigger name.
- Next steps: restart the task-owned lean local stack, rerun fresh replay through `20260813150000`, then continue generated schema, reporting/Storage, strict TAP/EUR/four-epoch, wallet, Feature118, and full-check certification in dependency order.

### session v14: preserve evidence across report tombstones (#181)

- Timestamp: 2026-08-13T16:43:00Z
- Agent: Codex (`issue-implementer` runtime certification)
- Branch: `codex/155-goal-2-integrated-evidence`
- Head before commit: `489f66c`
- Objective: fix the runtime-discovered mismatch between Storage-backed subject tombstones and the legacy report artifact-pair invariant.
- Actions: added a forward-only corrective migration after the locally applied Goal 2 candidate history. The replacement invariant preserves the original live/unpublished rules, while permitting a removed path only for an explicit tombstone that retains a 64-hex immutable artifact hash and linked report artifact ID. Added adversarial static coverage for all required branches.
- Validation: focused publication contract, lint, typecheck, migration replay, and the full real local publish/download/tombstone lifecycle are recorded after execution below. No remote, hosted, Production, provider, payout, or real-value-flow state is in scope.
- Reflections: deleting a private Storage object must not force deletion of its evidence hash. The exception belongs only to an explicit linked tombstone; allowing arbitrary pathless hashed reports would weaken publication integrity.
- Next steps: freshly replay the local candidate, prove exact object hash readback and tombstone post-state, then continue the strict TAP gate only if reporting is green.

### session v15: bind four-epoch fixture rail to its enum (#186)

- Timestamp: 2026-08-13T17:54:00Z
- Agent: Codex (`issue-implementer` runtime certification)
- Branch: `codex/155-goal-2-integrated-evidence`
- Head before commit: `622126e`
- Objective: resolve the sole failure from the complete canonical 21-suite strict TAP pass.
- Actions: cast the setup fixture's conditional payout rail explicitly to `public.payout_rail`, preserving the selected rail semantics while preventing PostgreSQL from resolving the `CASE` expression as `text`. Added a static regression guard for the typed boundary.
- Validation: the initial complete runner passed 20/21 and identified the first SQLSTATE 42804 mismatch. A fresh focused execution then passed the real claim/harvest serialization, deterministic native-Node-22 calculation, persisted result, close/replay, generated reports, and full conservation assertions. Focused Vitest, shell syntax, lint, typecheck, and diff checks passed before commit. No remote, hosted, Production, provider, payout, or real-value-flow state is in scope.
- Reflections: enum-compatible literals inside a multi-branch SQL expression still resolve to `text` unless explicitly typed. Runtime execution also proved that provider IDs must satisfy their exact format, psql variables require stdin scripts rather than `-c`, carry must bind through persisted disposition lineage rather than surrogate ID ordering, the calculator must use an installed runtime, and the target close needs an explicit reviewing shadow state.
- Next steps: run the focused four-epoch wrapper against a freshly reset local candidate, then rerun the strict canonical suite once if focused execution is green.

### session v16: recognize the cutover wrapper's owned isolation (#186)

- Timestamp: 2026-08-13T18:11:00Z
- Agent: Codex (`issue-implementer` runtime certification)
- Branch: `codex/155-goal-2-integrated-evidence`
- Head before commit: `2992b3a`
- Objective: remove redundant container replay around the already self-isolating historical cutover migration wrapper.
- Actions: kept the wrapper's explicit accountable contract but stopped the parent TAP runner from adding setup and cleanup resets around it. The wrapper itself resets to the pre-feature migration boundary, applies the upgrade, asserts preservation, and restores current schema under its EXIT trap. Added discovery coverage for that exact ownership distinction.
- Validation: the canonical rerun proved the repaired four-epoch suite green and passed 20/21; only the cutover wrapper reported a non-diagnostic exit after redundant replay. Running that wrapper directly with tracing passed its historical reset, fixture, migration-up, assertion, and current restore. Focused runner tests, lint, typecheck, syntax, and the final canonical result follow below.
- Reflections: isolation must have one accountable owner. Nesting parent resets around a wrapper that deliberately owns two full versioned resets increases host pressure without improving test independence.
- Next steps: rerun the canonical suite with single-owner cutover isolation, then proceed to the focused wallet gate only if all 21 suites pass.

### session v17: version the business review and allocator-boundary target (#204)

- Timestamp: 2026-08-13T18:10:11Z
- Agent: Codex (`task-interview` / `issue-vetting` correction)
- Branch: `codex/155-goal-2-integrated-evidence`
- Head before commit: `92ccb56691db2d022de125e9695d07673022a3cb`
- Objective: make the dated FundLoop business critique and improvement proposal, including the three target allocator information-flow diagrams, versioned and reachable from the registered Sprint #155 worktree before allocator-boundary audit vetting.
- Actions: added the dated critique and improvement-suggestions documents under `docs/project-reviews/2026-08-13-business-red-team/`; preserved the three Mermaid contracts for the conventional MVP, alias-separated ZK target, and consented-PII project path; and recorded the product, privacy, reporting, fee, cap, custody, pilot, and stop-work recommendations without changing application behavior.
- Validation: source and Sprint-worktree documents were byte-for-byte identical before commit; `git diff --check` passed. No code, schema, runtime, provider, hosted, Production, payout, or value-flow validation was required or run for this documentation-only commit.
- Reflections: the allocator audit needs an immutable target contract, but the audit remains a Sprint-level discovery and architecture gate rather than an implementation Task nested under Goal #163. Native blockers preserve the required sequencing into #188 without misrepresenting the audit as a predetermined remediation.
- Next steps: move #204 directly under Sprint #155, update #155/#163/#204 to describe the Sprint-level gate, return #204 to Scoped, and rerun issue vetting. If the audit later finds violations, stop for explicit approval before inserting remediation Tasks; every approved remediation Task must be locally green before #204 can close.

### session v18: isolate local Edge CPU budgets per request (#164)

- Timestamp: 2026-08-13T18:27:00Z
- Agent: Codex (`issue-implementer` runtime certification)
- Branch: `codex/155-goal-2-integrated-evidence`
- Head before commit: `9d6359b`
- Objective: resolve the exact Feature #118 persona failure where readiness and the later operator command shared one local Edge worker CPU budget.
- Actions: changed only the local Supabase Edge runtime policy from `per_worker` to its documented `oneshot` fallback and bound that selection in the operational matrix contract. This preserves every command, authentication, payload, assertion, and hosted/Production runtime limit while giving each local readiness and command request a fresh bounded isolate.
- Validation: the first exact matrix passed fresh replay and four personas; the returning operator passed through approval, then `monthly-cycle-bookkeeping-credits-create` was cancelled by the local supervisor after explicit CPU soft/hard-limit logs. The harness cleaned every persona and completed its final zero-residue reset. Focused static gates and the one authorized post-fix matrix rerun follow below.
- Reflections: a readiness OPTIONS request must not spend CPU from the later acceptance command's budget. Persistent hot-reload workers are useful for interactive development, but the repo's 64-function deterministic acceptance harness needs request-level isolation.
- Next steps: restart the task-owned local stack so the runtime policy takes effect, run one exact Feature #118 matrix, then full Node 22 checks and stop the FundLoop stack if green.

### session v19: restore the governed allocation browser sequence (#165/#186)

- Timestamp: 2026-08-13T19:15:30Z
- Agent: Codex (`issue-implementer` batch integration)
- Branch: `codex/155-goal-2-integrated-evidence`
- Head before commit: `b3c445fa9e61bea839c95fb24e6d8a1794e21d9c`
- Objective: align the Feature #118 allocation browser acceptance with the v2 product guard that requires an operator-selected cap preview and immutable manifest lock before calculation.
- Actions: replaced direct calculation in the browser test with the real Preview scenario, exact preview/source/invariant evidence checks, Lock selected scenario, manifest/preview hash binding, calculation, and identical replay proof. Kept the second role-surface case on the persisted locked result and added a focused contract regression proving the Edge handler still rejects an unlocked calculation before invoking the calculator.
- Validation: focused allocation contract/UI Vitest initially passed `6/6`; scoped ESLint, Node 22 typecheck, and `git diff --check` passed. The first runtime attempt proved the sequence reached the real preview guard and failed with `epoch_allocation_v2_claim_window_open` because the old browser fixture targeted future cycle `2026-08`. The second exposed that shifting the cycle also requires its exact open accounting-period boundary. With those fixed, preview, lock, calculation, and identical replay passed; the separate close worker repeatedly returned generic `authentication_failed` even though Auth logs showed fresh login and every `/user` request as HTTP 200. Root cause was the Edge entrypoint mistaking Deno.serve connection info for its optional injected dependency object, then attempting to call a missing authentication function. The handler now accepts injection only when the explicit function is present and otherwise uses the real runtime boundary.
- Reflections: the previous browser acceptance encoded the retired calculate-first workflow and a target whose claim window had not closed, so both failure layers were intended backend guards working correctly. Acceptance must exercise the operator's governed selection sequence on a temporally valid fixture instead of bypassing or weakening either guard.
- Next steps: run the allocation-only local wallet phase once. If green, run one exact Feature #118 matrix from this commit, followed by the full Node 22 check, Deno checks, diff verification, and task-owned Supabase cleanup.

### session v20: preserve active project onboarding across auth refresh (#164)

- Timestamp: 2026-08-13T20:00:30Z
- Agent: Codex (`issue-implementer` static matrix-failure diagnosis)
- Branch: `codex/155-goal-2-integrated-evidence`
- Head before commit: `1234eaf7a0bff066cce97cdc59abaaf968435745`
- Objective: resolve the sole Feature #118 persona failure where a new founder reached the persisted project draft resume boundary but never retained the review screen after continuing.
- Actions: traced run `persona-20260813T195119985Z-87e4e68f` to `persona-project-review-not-visible`, before any project publish request or persistence check. The project flow reloaded onboarding state after every auth-state event and unconditionally forced an existing draft back to `resume`, even when the same user had already continued to `review`. The flow now offers resume on the first load or a changed user, while a same-user auth refresh updates persisted state without replacing the active screen. Added a deterministic component regression that continues a review-ready draft, emits a same-user `SIGNED_IN` refresh, and proves the review remains active instead of returning to resume.
- Validation: Supabase-free project signup Vitest passed `4/4`; scoped ESLint, Node 22 typecheck, and `git diff --check` passed. No Supabase, Docker, Next, Edge, Playwright, provider, hosted, Production, payout, or real-value-flow process ran. Runtime matrix proof remains pending coordinator permission.
- Reflections: increasing the review timeout could not fix this failure because the source could replace the awaited screen after the user advanced. Authentication refreshes may update identity-backed data, but they must not silently rewind an in-progress same-user workflow.
- Next steps: when the coordinator grants the local stack lease and disk headroom is safe, run exactly `DOCKER_CONTEXT=colima-codex-supabase PATH=/opt/homebrew/opt/node@22/bin:$PATH pnpm test:e2e:feature-118`; do not publish or claim Goal 2 runtime green before that matrix and the remaining required static gates pass.

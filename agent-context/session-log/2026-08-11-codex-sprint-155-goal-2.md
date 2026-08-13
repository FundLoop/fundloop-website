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

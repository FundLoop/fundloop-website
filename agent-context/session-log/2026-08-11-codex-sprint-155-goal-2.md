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

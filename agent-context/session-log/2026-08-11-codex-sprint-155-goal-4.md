# Sprint 155 Goal 4: Promote the release while keeping value flow closed

## Active Context

This session log records the execution of Goal 4 (#171), including child tasks #172 (Certify Dev release candidate) and #173 (Promote Dev to Main).

### session v1: Certify Dev release candidate (#172)

- Timestamp: 2026-08-19T06:25:00Z
- Agent: Antigravity (Gemini 3.1 Pro)
- Branch: codex/155-goal-4-controlled-promotion
- Head before commit: e5f3ccb

#### Objective

Refresh the capability review to reflect Sprint 155 Goal 1-3 completion, freeze the release candidate, and prepare the branch for dev PR.

#### Actions Taken

- Branched `codex/155-goal-4-controlled-promotion` from `origin/codex/155-goal-3-governance-cutover` (which represents the most complete state of the Sprint 155).
- Renamed `docs/engineering/capability-review-2026-08-11.md` to a dated successor for review.
- Attempted to refresh the capability review for three-month claims, persona evidence, and governance/cutover controls.
- Prepared a pre-merge documentation candidate; final certification still required exact post-merge and external evidence.

#### Validation Notes

- Local repository evidence covered #186 and #182 behavior and the repository-owned framework portions of #183, #184, and #170; it did not prove hosted personas, qualified conclusions, or Production cutover readiness.
- No Supabase remote resets or production mutative commands were run.
- Value flow and financial posting policies remain disabled.

#### Reflections

- We cannot run a fully end-to-end hosted acceptance on Dev or generate the final manifest without the CI and manual deployment steps, so the branch is readied for the PR review that will trigger those.

#### Suggested Next Steps

- Commit the updated capability review and this session log.
- Push the branch and execute PR to `dev` for human validation and dev deploy.

### session v2: repair the Dev candidate evidence boundary (#234)

- Timestamp: 2026-08-20T09:06:47Z
- Agent: Codex
- Branch: codex/pr234-repair
- Head before commit: 6051291

#### Objective

Replay PR #234 on current `dev`, remove superseded Goal 3 code, repair its four review findings, and publish an exact but deliberately non-certifying Dev evidence snapshot.

#### Actions Taken

- Reconstructed the PR from `origin/dev` and retained only the original Goal 4 capability-review intent; the obsolete test-only governance follow-up was superseded by PR #233 production enforcement.
- Replaced the stale August 11 capability matrix with a 2026-08-20 review bound to promoted Dev SHA `9f821d8410a18b863249fd5353a98a584728fe91` and exact CI, Supabase, Vercel, local database, and hosted-public evidence.
- Explicitly classified authenticated hosted acceptance, qualified governance conclusions, authorized Production preflight, opening balances, cutover, payout, and value flow as unavailable or blocked.
- Corrected engineering and root documentation links to the dated successor.
- Hardened accounting evidence resolution to reject absolute paths and any resolved path outside the repository root, including the packet write path.
- Added adversarial tests for absolute and repository-escaping evidence paths.

#### Validation Notes

- Passed Node 22 focused Vitest: 4 files and 99 tests.
- Passed Node 22 full Vitest: 195 files and 1,133 tests.
- Passed Node 22 lint, TypeScript typecheck, production build, and `git diff --check`.
- Initial local production-server smoke without worktree environment failed honestly: public pages returned HTTP 500 and health returned 404 because Supabase variables were not configured.
- Repeated the same built artifact with Node 22 `--env-file` pointed read-only at the canonical checkout; `/en`, `/es`, `/fr`, and `/api/internal/health` returned HTTP 200. The server was stopped afterward.
- No local or remote Supabase mutation, provider payment, payout, opening-balance posting, Production cutover, or value-flow command was run.

#### Reflections

- The promoted Dev baseline is technically coherent, but #172 cannot be certified while its mandatory hosted role and qualified-professional dependencies remain open.
- Public Vercel smoke and deployment parity remain narrower than authenticated economic workflow acceptance.

#### Suggested Next Steps

- Publish the repaired branch, resolve all four review threads, merge only after green checks, then bind the new merge SHA to CI, Vercel, Supabase classification, and public hosted smoke.
- Keep #172 open and value flow disabled until the hosted credential and professional-authority gates are actually satisfied.

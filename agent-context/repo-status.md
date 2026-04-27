# Repo Status

Last reviewed: 2026-04-27

| Requirement | Status |
| --- | --- |
| Branch and worktree | Pass: Session 20 has landed on `dev`; cleanup work is now proceeding on a feature branch. |
| README quality | Pass: the Edge Function and CUBID notes now reflect the current migrated command domains and point readers to the long-lived engineering references. |
| License | Pass: `LICENSE` is present. |
| Agent guide | Pass: `AGENTS.md` now explicitly states the repo-wide Edge Function read/write-path rule and warns agents not to copy legacy direct-write paths. |
| Session-log discipline | Pass: `agent-context/session-log.md` is maintained and this cleanup commit records its own session entry. |
| `agent-context/` scope | Pass: long-lived architecture docs have moved to `docs/engineering/`; `agent-context/` now stays focused on live backlog, repo status, and session logs. |
| Engineering docs | Pass: the engineering index includes backgrounder, current-state, and target-state architecture docs alongside route, shell, CUBID, Edge Function, and deploy references. |
| CUBID integration | Partial: the FundLoop side has meaningful CUBID linkage/snapshot work, but still depends on local tarballs and temporary Deno import mapping until the CUBID package publication is complete. |
| Testing strategy | Partial: Vitest, typecheck, build, Playwright lanes, and contract tests exist; coverage thresholds and a concise testing ownership guide are not yet in place. |
| Local acceptance harness | Pass: remote-safe and local-wallet Playwright lanes exist; the local lane depends on local Supabase and Hardhat environment setup. |
| CI | Partial: app CI runs lint, tests, typecheck, build, and contract tests on PRs and selected pushes; the Supabase deploy workflow now handles dry-runs and branch-targeted deploys, but direct `dev` pushes do not run the full app CI workflow. |
| Supabase deploy path | Pass: the dedicated deploy workflow exists, uses branch-scoped environments, and Session 20's function/deploy hardening has landed on `dev`. |
| Supabase Edge Function compliance | Partial: the repo guidance and docs now clearly require typed Edge Function command paths for writes, but remaining direct server/zkAS workflows should still be retired through the roadmap. |
| Environment conventions | Partial: `.env.example` and README environment notes exist; local-vs-remote Supabase environment switching could be safer with clearer named files or scripts. |
| Artifact hygiene | Pass: disposable ignored artifacts were removed locally, including `.next`, `.playwright-cli`, `output`, `.DS_Store`, `tsconfig.tsbuildinfo`, and `supabase/functions/node_modules`; dependency installs under `node_modules` and `contracts/node_modules` were intentionally retained. |
| Branch hygiene | Partial: merged stale local branches for PRs #17, #28, #30/#29, and #31 were removed. Remaining local `codex/*` branches are the active cleanup branch and `codex/wallet-production-readiness`, which has no PR and diverges from `dev`; inspect/archive it before deleting. |

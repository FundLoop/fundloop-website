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
| Testing strategy | Pass: Vitest, typecheck, build, Playwright lanes, contract tests, and change-type validation ownership are documented in `docs/engineering/env-and-testing.md`; coverage thresholds remain optional future hardening. |
| Local acceptance harness | Pass: remote-safe and local-wallet Playwright lanes exist; the local lane depends on local Supabase and Hardhat environment setup. |
| CI | Partial: app CI runs lint, tests, typecheck, build, and contract tests on PRs and selected pushes; the Supabase deploy workflow now handles dry-runs and branch-targeted deploys, but direct `dev` pushes do not run the full app CI workflow. |
| Supabase deploy path | Partial: the dedicated deploy workflow exists and uses branch-scoped environments, but Session 52 verified that GitHub currently reports no branch protection on `dev`/`main` and no required reviewers on `Production`; configure those before production promotion. |
| Supabase Edge Function compliance | Partial: the repo guidance and docs now clearly require typed Edge Function command paths for writes, but remaining direct server/zkAS workflows should still be retired through the roadmap. |
| Environment conventions | Pass: README and `docs/engineering/env-and-testing.md` now define `.env.local` for local Supabase, optional ignored `.env.remote.local` for non-production smoke credentials, and remote Supabase mutation limits. |
| Artifact hygiene | Pass: disposable ignored artifacts were removed locally, including `.next`, `.playwright-cli`, `output`, `.DS_Store`, `tsconfig.tsbuildinfo`, and `supabase/functions/node_modules`; dependency installs under `node_modules` and `contracts/node_modules` were intentionally retained. |
| Branch hygiene | Pass: stale merged local branches were removed, the divergent `codex/wallet-production-readiness` branch was inspected and deleted after confirming no salvage-worthy unique work, and the only remaining local `codex/*` branch is the active cleanup branch. |

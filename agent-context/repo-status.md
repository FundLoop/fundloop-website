# Repo Status

Last reviewed: 2026-04-27

| Requirement | Status |
| --- | --- |
| Branch and worktree | Partial: the worktree is clean on `codex/session-20-admin-edge-functions`, but Session 20 is still ahead of `dev` and should be landed before starting Session 21 or cleanup that depends on the latest application state. |
| README quality | Partial: the setup and workflow docs are broadly useful, but the Edge Function section still describes the early `project-payment-drafts-create` milestone and does not reflect the newer onboarding, CUBID, payment-route, and admin payment command migrations. |
| License | Pass: `LICENSE` is present. |
| Agent guide | Partial: `AGENTS.md` is strong and current on branch flow, Supabase safety, validation, and session logging; it should explicitly call out the Edge Function write-path rule as a repo-wide architectural requirement. |
| Session-log discipline | Partial: `agent-context/session-log.md` is maintained, but the latest Session 20 metadata still contains pending-head language until the feature branch lands and is reconciled. |
| `agent-context/` scope | Partial: active backlog and session logs are present, but long-lived architecture docs still live in `agent-context/` even though repo guidance says durable engineering docs belong under `docs/engineering/`. |
| Engineering docs | Partial: high-signal subsystem docs exist under `docs/engineering/`; the index should be refreshed after Cubid packaging and Session 20 land, and architecture docs should be moved out of `agent-context/`. |
| CUBID integration | Partial: the FundLoop side has meaningful CUBID linkage/snapshot work, but still depends on local tarballs and temporary Deno import mapping until the CUBID package publication is complete. |
| Testing strategy | Partial: Vitest, typecheck, build, Playwright lanes, and contract tests exist; coverage thresholds and a concise testing ownership guide are not yet in place. |
| Local acceptance harness | Pass: remote-safe and local-wallet Playwright lanes exist; the local lane depends on local Supabase and Hardhat environment setup. |
| CI | Partial: app CI runs lint, tests, typecheck, build, and contract tests on PRs and selected pushes; the Supabase deploy workflow now handles dry-runs and branch-targeted deploys, but direct `dev` pushes do not run the full app CI workflow. |
| Supabase deploy path | Partial: the dedicated deploy workflow exists and uses branch-scoped environments, but the current Session 20 branch still needs the final PR/deploy loop after CUBID packaging settles. |
| Supabase Edge Function compliance | Partial: write-path migration is well underway; remaining direct server/admin/zkAS workflows should continue to be retired through the roadmap rather than reworked ad hoc. |
| Environment conventions | Partial: `.env.example` and README environment notes exist; local-vs-remote Supabase environment switching could be safer with clearer named files or scripts. |
| Artifact hygiene | Partial: large local artifacts are ignored but present locally, including `.next`, `node_modules`, `contracts/node_modules`, `tsconfig.tsbuildinfo`, `.DS_Store`, `.playwright-cli`, and `output`. |
| Branch hygiene | Partial: several old local `codex/*` branches are present; deletion should be done only after checking merge/PR status so the active Session 20 branch is preserved. |

### session v128: Run beta readiness smoke
- timestamp: 2026-05-04T05:36:28-0400
- agent: **Codex (GPT-5)**
- branch: **codex/session-46-1-and-47-beta-smoke**
- head: pending session 47 commit

#### Objective
Complete Session 47 by running a focused local beta readiness smoke across public routes, authenticated workspaces, founder operations, monthly-cycle/operator surfaces, and MCP-adjacent test coverage.

#### Actions Taken
- Stopped the competing EverFund Supabase stack before starting FundLoop local Supabase.
- Recovered the local FundLoop stack from stale container and Colima interruptions, then started Supabase with Logflare excluded because the analytics container repeatedly failed health checks.
- Reset the local database through the full migration chain and tracked seed.
- Ran focused Vitest coverage for seeded public data, route redirects, user/founder workspaces, monthly cycles, reporting, earnings, MCP tools, observability, and E2E auth configuration.
- Smoked localized public routes, public redirects, authenticated workspace/founder/admin routes, founder payment/contribution/attribution/reporting surfaces, and operator pages against the local app.
- Recorded the beta readiness punch list in `agent-context/todo.md`, scoped mainly to Session 48 smoke-environment hardening.

#### Tests and Validation Notes
- `DOCKER_HOST=unix:///var/run/docker.sock supabase db reset` passed after starting the local stack with `supabase start -x logflare`.
- `pnpm test tests/local-public-seed.test.ts tests/public-route-redirects.test.ts tests/public-user-journey.test.ts tests/user-workspace.test.ts tests/founder-workspace.test.ts tests/monthly-cycles.test.ts tests/monthly-cycle-reports.test.ts tests/user-earnings-workspace.test.ts` passed: 8 files, 37 tests.
- Public HTTP smoke returned 200 for `/en`, `/fr`, `/es`, `/en/participation`, `/fr/participation`, `/es/support`, `/en/founders`, `/en/projects`, `/en/projects/civic-mesh`, `/en/users`, `/en/users/00000000-0000-4000-8000-000000000101`, `/en/reports`, `/en/documentation`, `/en/blog`, `/en/faq`, `/en/ecosystem`, `/en/privacy`, `/en/terms`, and `/en/cookies`.
- Redirect smoke confirmed `/`, `/participation`, `/en/about`, `/en/api`, `/en/analytics`, `/en/pledge`, `/en/pricing`, `/en/my-profile`, `/en/settings`, `/en/settings/account`, and `/en/organizations/test` route to their canonical destinations.
- Authenticated Playwright smoke with `maya@fundloop.example.com` passed for `/en/workspace`, `/en/workspace/account`, `/en/workspace/earnings`, `/en/workspace/reporting`, `/en/founder`, `/en/founder/projects`, `/en/founder/projects/civic-mesh`, `/en/admin`, `/en/admin/cycles`, `/en/admin/operations`, `/en/admin/identity`, `/en/admin/payments`, `/en/admin/cycles/observability`, `/en/admin/zkas`, `/en/admin/superadmin/zkas`, `/en/projects/civic-mesh/payments`, `/en/projects/civic-mesh/zkas`, `/en/founder/projects/civic-mesh/contributions`, `/en/founder/projects/civic-mesh/attribution`, and `/en/founder/projects/civic-mesh/reporting`.
- `pnpm test tests/mcp-founder-tools.test.ts tests/monthly-cycle-observability.test.ts tests/e2e-config.test.ts` passed: 3 files, 9 tests.

#### Reflections
- The product surface is much more smokeable than it was before the workspace/monthly-cycle/reporting sessions; the meaningful blockers were local smoke environment reliability issues rather than obvious broken beta routes.
- Local operator smoke depends on explicit allowlist env, so the seed guide needs to describe not just the account credentials but the env needed to make that persona an operator.
- The local Logflare failure is a good example of why Session 48 should focus on making the smoke harness boring and repeatable before more beta-hardening work piles on top.

#### Suggested Next Steps
- Run Session 48 next to harden seeded local/preview personas, document required operator env, and either repair or formalize the local `supabase start -x logflare` smoke mode.
- Then continue to Session 49 MCP runtime packaging once local smoke setup is boring enough for future agents and reviewers.

---

### session v127: Confirm post-merge dev Supabase deploy
- timestamp: 2026-05-03T18:25:21-0400
- agent: **Codex (GPT-5)**
- branch: **codex/session-46-1-and-47-beta-smoke**
- head: pending metadata commit

#### Objective
Close Session 46.1 by recording that the PR #40 post-merge `dev` Supabase Deploy run succeeded end to end.

#### Actions Taken
- Confirmed PR #40 merged to `dev` at merge commit `e9b9f80`.
- Watched the push-triggered `Supabase Deploy` run `25291992377` complete successfully.
- Verified the run deployed `mcp-workflow-read`, `user-cubid-resolve-email`, and `user-cubid-sync-profile`.
- Confirmed the repaired deploy path did not hit the previous `node_modules/@cubid/api/dist/index.mjs` bundling failure.
- Updated Session 46.1 metadata in `agent-context/todo.md`.

#### Tests and Validation Notes
- `gh run watch 25291992377 --repo FundLoop/fundloop-website --interval 20 --exit-status` passed.
- `gh run view 25291992377 --repo FundLoop/fundloop-website --log` showed the target functions deployed successfully.

#### Reflections
- The Session 46 repair fixed the failing push-triggered deploy path; the dev Supabase target is no longer blocked on CUBID package resolution.
- The workflow still emits GitHub's Node 20 action deprecation warning for upstream actions, which is not blocking but should be handled in a later CI hygiene pass if it persists.

#### Suggested Next Steps
- Start Session 47 beta readiness smoke from a clean local Supabase baseline.

---

### session v126: Address PR #40 Copilot documentation feedback
- timestamp: 2026-05-03T17:32:02-0400
- agent: **Codex (GPT-5)**
- branch: **codex/session-46-deploy-health**
- head: pending review-fix commit

#### Objective
Address Copilot feedback on PR #40 without changing the Session 46 deploy repair behavior.

#### Actions Taken
- Reworded the CUBID identity engineering doc so the `@cubid/core` and browser-package split is described as the current runtime model, not as something introduced by Session 14.

#### Tests and Validation Notes
- `pnpm dlx node@22.22.1 /opt/homebrew/bin/pnpm lint` passed.

#### Reflections
- The package split is important deploy truth, but the historical attribution needed to be precise so future agents do not misread old sessions.

#### Suggested Next Steps
- Push the review-fix commit, reply to the Copilot thread, resolve it, and re-check CI before moving to the Codex review gate.

---

### session v125: Repair CUBID Edge deploy package resolution
- timestamp: 2026-05-03T17:13:21-0400
- agent: **Codex (GPT-5)**
- branch: **codex/session-46-deploy-health**
- head: pending final commit

#### Objective
Implement Session 46 by repairing the post-merge `dev` Supabase deploy failure where `user-cubid-resolve-email` could not bundle `node_modules/@cubid/api/dist/index.mjs`.

#### Actions Taken
- Inspected the failed `dev` Supabase Deploy run for merge commit `1332f3f` and confirmed migrations applied before function bundling failed on the CUBID package import path.
- Added `@cubid/core@0.1.0` and moved server/Edge-facing CUBID identity resolution and snapshot normalization imports from `@cubid/api` to `@cubid/core`.
- Updated `supabase/functions/deno.json` so Supabase Deno resolves `@cubid/core` from `jsr:@cubid/core@0.1.0`.
- Kept the local `@cubid/api`, `@cubid/web2`, and `@cubid/web2-react` tarballs for browser compatibility flows that still need them.
- Updated deployment, Edge Function, and CUBID identity docs to record that Edge Functions must use `@cubid/core` rather than the old `node_modules/@cubid/api/dist/index.mjs` path.
- Added Session 46.1 as a narrow post-merge deploy-confirmation spillover, because the push-triggered dev deploy can only be verified after this repair lands on `dev`.

#### Tests and Validation Notes
- `pnpm install --frozen-lockfile` passed.
- `deno cache --config supabase/functions/deno.json supabase/functions/user-cubid-resolve-email/index.ts` passed.
- `deno cache --config supabase/functions/deno.json supabase/functions/user-cubid-sync-profile/index.ts` passed.
- `deno cache --config supabase/functions/deno.json supabase/functions/mcp-workflow-read/index.ts` passed.
- `pnpm lint` passed, then `pnpm dlx node@22.22.1 /opt/homebrew/bin/pnpm lint` also passed.
- `pnpm test` passed: 74 files and 287 tests; the Node 22 rerun also passed with the same file/test counts.
- `pnpm typecheck` passed, then `pnpm dlx node@22.22.1 /opt/homebrew/bin/pnpm typecheck` also passed.
- `pnpm build` passed, then `pnpm dlx node@22.22.1 /opt/homebrew/bin/pnpm build` also passed.

#### Reflections
- The PR dry-run was not enough to catch this because it did not deploy or bundle Edge Functions; the failure only appeared in the push-triggered deploy path.
- Using the JSR-published runtime-agnostic CUBID core package gives Supabase Edge a stable Deno-native import path and removes the brittle repo-root `node_modules` dependency from function bundling.

#### Suggested Next Steps
- Yeet this repair to `dev`; after merge, complete Session 46.1 by confirming the push-triggered dev Supabase Deploy run succeeds through all functions.

---

### session v124: Add the next roadmap tranche
- timestamp: 2026-05-03T13:50:16Z
- agent: **Codex (GPT-5)**
- branch: **codex/next-roadmap-pass**
- head: pending roadmap commit

#### Objective
Create a short, repo-grounded next-roadmap pass after PR #39 merged Sessions 37-45 and the prior execution roadmap reached its planned end.

#### Actions Taken
- Confirmed local `dev` was clean and aligned with `origin/dev` after approved cleanup.
- Reviewed the current backlog tail, recent session-log entries, and engineering docs signals from the merged operations/MCP stack.
- Added Sessions 46-52 to `agent-context/todo.md` covering deploy verification, beta smoke/blocker audit, seed persona hardening, MCP runtime packaging, operator read-contract consolidation, beta safety guardrails, and the dev-to-main release-candidate path.

#### Tests and Validation Notes
- No code validation was run because this was a planning-only backlog update.
- Git status was checked before editing and showed a clean branch baseline.

#### Reflections
- The roadmap has shifted from “build the missing product architecture” to “prove, harden, package, and promote the product safely.”
- Keeping the next tranche short should prevent the backlog from becoming another moth-bag, little irony gremlin that it is.

#### Suggested Next Steps
- Start with Session 46 to verify the post-merge dev deploy and Supabase function/migration health before adding more product scope.

---

### session v123: Address PR #39 MCP and Edge read review feedback
- timestamp: 2026-05-03T00:43:17Z
- agent: **Codex (GPT-5)**
- branch: **codex/session-37-40-mcp-observability**
- head: pending review-fix commit

#### Objective
Address the first automated review round on PR #39 without changing the public product scope of Sessions 37-45.

#### Actions Taken
- Updated `founder.projects.list` in `mcp-workflow-read` so organization `Founder`/`Admin` managers are listed consistently with project access checks.
- Changed explicit missing cycle-key reads to fail closed with `cycle_not_found` rather than silently aggregating unscoped metrics.
- Increased attempt-specific monthly-cycle event reads while keeping the default event list compact.
- Replaced capped latest-row reconciliation visibility with exact status counts.
- Switched the MCP stdio loop from newline-delimited JSON to Content-Length framed MCP messages.
- Removed TypeScript parameter properties from MCP runtime classes so the Node 22 executable entrypoint can run in strip-only TypeScript mode.
- Added focused parser serialization coverage for MCP stdio frames.

#### Tests and Validation Notes
- `pnpm test tests/mcp-server.test.ts tests/mcp-founder-tools.test.ts tests/mcp-member-operator-tools.test.ts` passed.
- `deno cache --config supabase/functions/deno.json supabase/functions/mcp-workflow-read/index.ts` passed.
- `FUNDLOOP_MCP_BEARER_TOKEN=x NEXT_PUBLIC_SUPABASE_URL=https://example.supabase.co NEXT_PUBLIC_SUPABASE_ANON_KEY=x node packages/mcp-server/src/server.ts </dev/null` exited successfully, with Node's expected typeless-package warning for the root shared TS module.
- `pnpm typecheck` passed.
- `pnpm lint` passed.

#### Reflections
- The MCP package remains lightweight, but it now speaks the framing expected by real MCP stdio clients.
- The Edge read gateway now avoids several misleading partial/overbroad operator results.

#### Suggested Next Steps
- Push the review-fix commit, let CI return green, then reply to and resolve the Copilot threads before handling the existing Codex review threads.

---

### session v122: Polish the public user and founder conversion handoff
- timestamp: 2026-05-01T09:13:05Z
- agent: **Codex (GPT-5)**
- branch: **codex/session-37-40-mcp-observability**
- head: pending final commit

#### Objective
Implement Session 45 by tightening the public user/founder journey polish now that the operational workspaces, identity model, monthly cycle pipeline, reporting, storage, and runbook foundations exist.

#### Actions Taken
- Added a reusable `JourneyConfidenceBand` marketing component with a stronger visual treatment and simple dual-CTA structure.
- Added the conversion band to the home, participation, and founders pages so each path reinforces what is real now and where the visitor should go next.
- Added localized English, French, and Spanish copy for the new public journey polish content.
- Updated i18n coverage to assert the new localized message domain.
- Updated backlog metadata for Session 45.

#### Tests and Validation Notes
- `pnpm test tests/i18n.test.ts` passed.
- `pnpm typecheck` passed.
- `pnpm lint` passed.

#### Reflections
- This is an intentional polish pass, not a full redesign: the public funnels now better communicate that the backend system has become operational without adding new workflow promises.
- Manual browser visual smoke is still a good follow-up before yeeting the stacked branch.

#### Suggested Next Steps
- Run a broader `pnpm test` / `pnpm build` pass and then yeet the stacked Sessions 37-45 branch for review.

---

### session v121: Add the operator operations runbook
- timestamp: 2026-05-01T09:09:31Z
- agent: **Codex (GPT-5)**
- branch: **codex/session-37-40-mcp-observability**
- head: pending final commit

#### Objective
Implement Session 44 by turning release health, cycle operations, identity sync, payment/payout incidents, and artifact evidence into explicit operator guidance.

#### Actions Taken
- Added `lib/operations/runbook.ts` as the structured source for operations domains, checks, escalation rules, live admin actions, and engineering references.
- Added `/[locale]/admin/operations` as an authenticated internal-operator runbook page.
- Linked the operations runbook from the admin dashboard.
- Added `docs/engineering/operations-runbook.md` and indexed it from the engineering docs README.
- Updated route inventory and navigation-shell docs to record the new operator route.
- Added focused unit coverage for the runbook data contract.
- Updated backlog metadata for Session 44.

#### Tests and Validation Notes
- `pnpm test tests/operations-runbook.test.ts` passed.
- `pnpm typecheck` passed.
- `pnpm lint` passed.

#### Reflections
- The app now has a first-class place for operators to answer “what should I check next?” without digging through chat history or tribal memory.
- The runbook intentionally points to existing operator surfaces rather than creating new mutation paths.

#### Suggested Next Steps
- Session 45 should do the final UX polish and conversion pass across user and founder journeys, especially copy, empty states, visual hierarchy, and multilingual polish.

---

### session v120: Standardize Supabase Storage artifact contracts
- timestamp: 2026-05-01T09:05:07Z
- agent: **Codex (GPT-5)**
- branch: **codex/session-37-40-mcp-observability**
- head: pending final commit

#### Objective
Implement Session 43 by turning Supabase Storage usage into a documented, reusable artifact model for zkAS, reporting, project media, onboarding uploads, bookkeeping exports, and audit proofs.

#### Actions Taken
- Added `lib/storage/artifacts.ts` with canonical bucket names, lifecycle metadata, artifact reference normalization, and path builders for cycle-bound and product-owned artifacts.
- Rewired active zkAS dataset, identity, run manifest, run result, and calculation-package paths to use the shared builders.
- Normalized monthly report artifact references through the shared storage reference helper.
- Added a forward migration that creates the remaining private product artifact buckets and normalizes existing zkAS/reporting bucket settings.
- Added storage artifact tests and updated engineering docs for monthly cycles, reporting, MCP artifact references, and the engineering docs index.
- Updated backlog metadata for Session 43.

#### Tests and Validation Notes
- `pnpm test tests/storage-artifacts.test.ts tests/monthly-cycle-calculation-package-command.test.ts tests/monthly-cycle-reports.test.ts` passed.
- `deno cache --config supabase/functions/deno.json supabase/functions/monthly-cycle-calculation-package/index.ts` passed.
- `pnpm typecheck` passed.
- `pnpm lint` passed.

#### Reflections
- Storage is now governed by a stable app contract rather than scattered string assembly.
- The buckets remain private and server/Edge-owned; future raw artifact downloads should be explicit Edge Function capabilities, not direct public bucket access.

#### Suggested Next Steps
- Session 44 should turn the repo’s deployment, operations, and incident posture into a practical runbook that references the new storage/deploy/cycle boundaries.

---

### session v119: Collapse remaining settings result surfaces into workspace IA
- timestamp: 2026-05-01T08:57:55Z
- agent: **Codex (GPT-5)**
- branch: **codex/session-37-40-mcp-observability**
- head: pending final commit

#### Objective
Implement Session 42 by removing the remaining settings-centered account/result assumptions now that workspace account, earnings, and reporting surfaces exist.

#### Actions Taken
- Converted `/settings/zkas` into a locale-preserving redirect to `/workspace/reporting`.
- Updated earnings, participation, zkAS actions, and admin copy so result/reporting links point at workspace reporting instead of settings.
- Updated stale account/profile menu links to use `/workspace` and `/workspace/account`.
- Updated organization-member leave flow to return users to `/workspace` rather than the old profile route.
- Updated route inventory, navigation, IA docs, translations, and backlog metadata.
- Added focused redirect coverage for `/settings`, `/settings/account`, and `/settings/zkas`.

#### Tests and Validation Notes
- `pnpm test tests/settings-route-redirects.test.ts tests/user-earnings-workspace.test.ts tests/public-user-journey.test.ts` passed.
- `pnpm typecheck` passed after fixing the updated dropdown icon import.
- `pnpm lint` passed after fixing the updated dropdown icon import.

#### Reflections
- Settings is now fully subordinate to the workspace IA rather than a competing product destination.
- The old raw zkAS route remains compatible as a redirect, but no shared surface should promote it as a primary path.

#### Suggested Next Steps
- Session 43 should audit artifact/media handling and align project assets, reports, zk artifacts, and MCP references around a consistent Supabase Storage model.

---

### session v118: Move MCP workflow reads behind an Edge Function
- timestamp: 2026-05-01T08:24:00Z
- agent: **Codex (GPT-5)**
- branch: **codex/session-37-40-mcp-observability**
- head: pending final commit

#### Objective
Implement Session 41 by moving the new high-value MCP workflow reads behind a typed Supabase Edge Function read gateway.

#### Actions Taken
- Added the `mcp-workflow-read` Edge Function contract and Supabase function.
- Implemented authenticated read operations for founder managed projects, founder project cycle status, project-member reporting status, operator cycle statuses, cycle observability, reconciliation visibility, and reporting coverage.
- Reworked the default MCP founder, project-member, and operator readers to call `mcp-workflow-read` through the shared Edge Function envelope instead of reading Supabase REST tables directly.
- Updated MCP, Edge Function, target architecture, and backlog docs.

#### Tests and Validation Notes
- `pnpm test tests/mcp-server.test.ts tests/mcp-founder-tools.test.ts tests/mcp-member-operator-tools.test.ts` passed.
- `pnpm typecheck` passed.
- `pnpm lint` passed.
- `deno cache --config supabase/functions/deno.json supabase/functions/mcp-workflow-read/index.ts` passed.

#### Reflections
- This does not migrate every app page read yet, but it moves the new protocol-facing high-value reads behind the backend boundary before MCP usage spreads.
- The reader interfaces remain stable, so web pages can adopt the same Edge-backed read gateway later without rewriting tool contracts.

#### Suggested Next Steps
- Session 42 should clean up remaining settings/account IA leftovers now that the main workspace and protocol surfaces are in place.

---

### session v117: Add project-member and operator MCP reads
- timestamp: 2026-05-01T08:16:06Z
- agent: **Codex (GPT-5)**
- branch: **codex/session-37-40-mcp-observability**
- head: pending final commit

#### Objective
Implement Session 40 by expanding the MCP server with project-member and operator-safe read workflows while avoiding broad internal mutation tools.

#### Actions Taken
- Added project-member and operator workflow reader boundaries plus Supabase REST-backed default readers.
- Added a project-member reporting-status MCP tool for visible project reporting and attribution status.
- Added read-only operator MCP tools for monthly cycle status, monthly-cycle observability, onchain reconciliation visibility, and reporting coverage.
- Wired the new readers and tools into the default MCP server context.
- Added focused tests for tool registration, project-member reads, operator reads, and missing-reader error behavior.
- Updated MCP, monthly-cycle, target architecture, and backlog docs.

#### Tests and Validation Notes
- `pnpm test tests/mcp-server.test.ts tests/mcp-founder-tools.test.ts tests/mcp-member-operator-tools.test.ts` passed.
- `pnpm typecheck` passed.
- `pnpm lint` passed.

#### Reflections
- The operator MCP surface is intentionally read-only for this pass. That keeps the protocol useful without opening risky internal state transitions too early.
- The reader interfaces are deliberately narrow so Session 41 can replace direct read implementations with Edge Function read contracts.

#### Suggested Next Steps
- Session 41 should move the most important MCP/web reads behind typed Edge Function read models, starting with founder workspace, user earnings, cycle status, and operator dashboards.

---

### session v116: Add founder MCP workflow tools
- timestamp: 2026-05-01T08:13:16Z
- agent: **Codex (GPT-5)**
- branch: **codex/session-37-40-mcp-observability**
- head: pending final commit

#### Objective
Implement Session 39 by adding the first founder-facing MCP workflows without bypassing web-app backend contracts.

#### Actions Taken
- Added a founder workflow reader boundary and a Supabase REST-backed default reader for managed project and project cycle status reads.
- Added explicit MCP tools for listing managed projects and reading a founder project's monthly cycle, payment, and route status.
- Added explicit MCP tools for project crypto route create/update and onchain receipt recording, all routed through existing Edge Function command names.
- Wired founder tools into the default MCP server registry.
- Added focused tests for founder tool registration, reader-backed status reads, Edge Function write routing, and missing-reader error behavior.
- Updated MCP, Edge Function, target architecture, and backlog docs.

#### Tests and Validation Notes
- `pnpm test tests/mcp-server.test.ts tests/mcp-founder-tools.test.ts` passed.
- `pnpm typecheck` passed.
- `pnpm lint` passed.

#### Reflections
- Founder MCP writes now reuse the same project payment command boundary as the web UI, which keeps the protocol surface from becoming a privileged shortcut.
- The reader boundary gives us a clean seam for Session 41's future read-model migration to Edge Functions.

#### Suggested Next Steps
- Session 40 should add project-member and operator-safe MCP workflows, especially cycle status, reporting access, reconciliation visibility, and observability lookup.

---

### session v115: Build the first MCP server skeleton
- timestamp: 2026-05-01T08:09:51Z
- agent: **Codex (GPT-5)**
- branch: **codex/session-37-40-mcp-observability**
- head: pending final commit

#### Objective
Implement Session 38 by adding the first MCP server foundation without creating a parallel backend path.

#### Actions Taken
- Added `packages/mcp-server` to the pnpm workspace.
- Added MCP auth context creation, protocol response helpers, tool registration/dispatch, a Supabase Edge Function command client, and a stdio JSON-RPC server entrypoint.
- Added base tools for health checks and allowlisted low-level Edge Function invocation.
- Added focused tests for auth, tool listing/calling, JSON-RPC handling, and allowlist enforcement.
- Added the long-lived MCP engineering doc and updated Edge Function and target architecture docs.

#### Tests and Validation Notes
- `pnpm test tests/mcp-server.test.ts` passed.
- `pnpm typecheck` passed.
- `pnpm lint` passed.

#### Reflections
- The low-level Edge Function invoker is useful for the skeleton, but it is intentionally allowlisted so later sessions can add safer domain-specific tools.
- The MCP server now has a place to grow while preserving the rule that the web app and agents share backend contracts.

#### Suggested Next Steps
- Session 39 should add founder-facing MCP workflows as explicit tools, starting with project/cycle reads and the safest existing founder commands.

---

### session v114: Extend monthly pipeline observability
- timestamp: 2026-05-01T08:06:35Z
- agent: **Codex (GPT-5)**
- branch: **codex/session-37-40-mcp-observability**
- head: pending final commit

#### Objective
Implement Session 37 by broadening monthly-cycle observability from lock-specific audit rows into an operator-facing event stream for the full monthly pipeline.

#### Actions Taken
- Added a forward migration that expands accepted `monthly_cycle_events.event_type` values for prep, payout execution, and reporting publication stages and adds event lookup indexes.
- Added `lib/observability/monthly-cycle-events.ts` with stage inference, summary building, filtered event loading, and attempt drill-down read models.
- Added `/admin/cycles/observability` for internal operators to inspect monthly cycle attempts, warnings, failures, stage summaries, and per-attempt event history.
- Linked the cycle observability page from the monthly cycles dashboard.
- Updated monthly-cycle, Edge Function, navigation, route-inventory, and backlog docs to record the canonical event stream.

#### Tests and Validation Notes
- `pnpm test tests/monthly-cycle-observability.test.ts tests/monthly-cycles.test.ts` passed.
- `pnpm typecheck` passed.
- `pnpm lint` passed.

#### Reflections
- This keeps monthly observability in the existing database-backed operating model instead of inventing a separate MCP/protocol log.
- Payment-specific wallet telemetry remains in `payment_flow_events`; cycle-stage workflow telemetry now has its own operator drill-down.

#### Suggested Next Steps
- Session 38 should build the first MCP server skeleton and read from the same app/Edge Function contracts rather than bypassing these observability boundaries.

---

### session v113: Address PR 38 automated review feedback
- timestamp: 2026-05-01T00:33:08Z
- agent: **Codex (GPT-5)**
- branch: **codex/supabase-deno-import-repair**
- head: pending final commit

#### Objective
Address actionable Copilot and Codex review feedback on PR #38 before moving through the remaining publish gates.

#### Actions Taken
- Added a forward migration with `monthly_cycle_reports` public and user-self select policies so request-scoped reporting reads are allowed under RLS.
- Extracted Solana deposit-address route detection into a shared Deno-safe helper used by both runtime config and Edge Function payment operation deps.
- Replaced per-row reconciliation sorting with a precomputed latest-status map in the user earnings read model.
- Localized the workspace reporting publication-pending fallback.
- Added runtime-config coverage for Solana deposit-address availability.

#### Tests and Validation Notes
- `pnpm dlx node@22.22.1 /opt/homebrew/bin/pnpm test tests/runtime-config.test.ts tests/user-earnings-workspace.test.ts tests/monthly-cycle-reports.test.ts` passed.
- `pnpm dlx node@22.22.1 /opt/homebrew/bin/pnpm typecheck` passed.
- `pnpm dlx node@22.22.1 /opt/homebrew/bin/pnpm lint` passed.
- `deno cache --config supabase/functions/deno.json supabase/functions/project-onchain-payment-submission-record/index.ts` passed.
- `supabase migration up` passed.

#### Reflections
- The RLS comment caught a real production-read blocker for authenticated user report reads.
- The Solana helper extraction is small, but it reduces drift risk across app and Edge Function runtime availability checks.

#### Suggested Next Steps
- Push this review-fix commit to PR #38, reply to the automated review threads, and wait for CI to return green.
- Continue the Copilot then Codex review gates until all actionable comments are resolved.

---

### session v112: Build monthly reporting publication surfaces
- timestamp: 2026-05-01T00:11:55Z
- agent: **Codex (GPT-5)**
- branch: **codex/supabase-deno-import-repair**
- head: pending final commit

#### Objective
Implement Session 36 by introducing a durable reporting publication model and role-specific report views for users, founders, public readers, and operators.

#### Actions Taken
- Added `monthly_cycle_report_audience`, `monthly_cycle_reports`, and the `monthly-cycle-reports` Supabase Storage bucket contract.
- Added `lib/reporting/monthly-cycle-reports.ts` with stable read models for public, user, founder/project, and operator cycle reporting views.
- Added `/workspace/reporting`, `/founder/projects/[slug]/reporting`, and `/admin/cycles/[cycleKey]/reporting`.
- Updated the public `/reports` page to list published public monthly report artifacts when they exist.
- Linked reporting from app-shell workspace navigation, founder project surfaces, and admin cycle rows.
- Updated localized copy, generated Supabase types, reporting docs, navigation docs, monthly-cycle docs, route inventory, backlog metadata, and focused tests.

#### Tests and Validation Notes
- `pnpm dlx node@22.22.1 /opt/homebrew/bin/pnpm test tests/monthly-cycle-reports.test.ts` passed.
- `pnpm dlx node@22.22.1 /opt/homebrew/bin/pnpm typecheck` passed.
- `pnpm dlx node@22.22.1 /opt/homebrew/bin/pnpm lint` passed.
- `pnpm dlx node@22.22.1 /opt/homebrew/bin/pnpm test` passed.
- `supabase migration up` initially timed out against local Postgres, then passed on retry once the local stack responded.
- `pnpm dlx node@22.22.1 /opt/homebrew/bin/pnpm check` passed.

#### Reflections
- Reporting now has a real database and storage artifact contract, but report generation remains intentionally deferred.
- The pages read published report metadata and existing zkAS/payout summaries without creating new operator mutation paths.

#### Suggested Next Steps
- Yeet this stacked branch so the deploy repair and Sessions 30-36 can be reviewed together.
- Session 37 should expand monthly-pipeline observability across lock, prep, calculation, verification, payout, and publication.

---

### session v111: Build user earnings and payout workspace
- timestamp: 2026-04-30T23:53:53Z
- agent: **Codex (GPT-5)**
- branch: **codex/supabase-deno-import-repair**
- head: pending final commit

#### Objective
Implement Session 35 by giving regular users a real money workspace that connects published monthly results to payout intent, route, batch, and reconciliation state without adding premature payout execution controls.

#### Actions Taken
- Added `/[locale]/workspace/earnings` as the signed-in user earnings and payout workspace.
- Added a server-only earnings read model that summarizes published allocations, payout intents, payout routes, batch status, reconciliation cues, pending distributions, and payout history.
- Updated the workspace home and app-shell navigation so earnings is the canonical user money destination while `/settings/zkas` remains a raw interim result-history link.
- Localized the new earnings workspace copy in English, French, and Spanish.
- Added focused read-model tests and updated navigation, payout, monthly-cycle, route-inventory, and backlog docs.

#### Tests and Validation Notes
- `pnpm dlx node@22.22.1 /opt/homebrew/bin/pnpm test tests/user-workspace.test.ts tests/user-earnings-workspace.test.ts` passed.
- `pnpm dlx node@22.22.1 /opt/homebrew/bin/pnpm typecheck` passed.
- `pnpm dlx node@22.22.1 /opt/homebrew/bin/pnpm lint` passed.
- `pnpm dlx node@22.22.1 /opt/homebrew/bin/pnpm test` passed.
- `deno cache --config supabase/functions/deno.json supabase/functions/monthly-cycle-payout-intents-create/index.ts` passed.
- `pnpm dlx node@22.22.1 /opt/homebrew/bin/pnpm check` passed.

#### Reflections
- The user side now has a durable earnings view tied to the payout domain, but payout route editing and actual execution remain intentionally outside this session.
- Keeping `/settings/zkas` as a raw history link lets the app preserve the old truthful result surface while the workspace becomes the user-facing mental model.

#### Suggested Next Steps
- Yeet this stacked branch so the deploy repair and Sessions 30-35 can be reviewed together.
- Session 36 should publish role-appropriate monthly reports and can treat `/workspace/earnings` as the user money source of truth.

---

### session v110: Build founder attribution submission workflow
- timestamp: 2026-04-30T23:11:55Z
- agent: **Codex (GPT-5)**
- branch: **codex/supabase-deno-import-repair**
- head: pending final commit

#### Objective
Implement Session 34 by adding a canonical founder attribution workflow that makes contribution-data submission readiness, template expectations, validation state, and upload history visible without duplicating the existing zkAS upload write path.

#### Actions Taken
- Added `/[locale]/founder/projects/[slug]/attribution` as the founder-facing attribution and contribution-data workflow.
- Extended the founder workspace read model with approved dataset counts, validation issue counts, and recent attribution submissions.
- Linked the attribution workflow from founder home, project index, project home, and monthly contribution workflow surfaces.
- Localized the new workflow copy in English, French, and Spanish.
- Updated monthly-cycle, navigation, route-inventory, and backlog docs to record the Session 34 attribution route and the current transitional zkAS upload ownership.

#### Tests and Validation Notes
- `pnpm dlx node@22.22.1 /opt/homebrew/bin/pnpm test tests/founder-workspace.test.ts` passed.
- `pnpm dlx node@22.22.1 /opt/homebrew/bin/pnpm typecheck` passed.
- `pnpm dlx node@22.22.1 /opt/homebrew/bin/pnpm lint` passed.
- `pnpm dlx node@22.22.1 /opt/homebrew/bin/pnpm test` passed.
- `deno cache --config supabase/functions/deno.json supabase/functions/project-onchain-payment-submission-record/index.ts` passed.
- `pnpm dlx node@22.22.1 /opt/homebrew/bin/pnpm check` passed.

#### Reflections
- The founder attribution route now gives project teams a structured monthly-cycle entry point while the existing `/projects/[slug]/zkas` route remains the actual upload and detail surface.
- This keeps Session 34 focused on workflow clarity and readiness instead of creating a second data-submission write path before zkAS upload writes are migrated.

#### Suggested Next Steps
- Yeet this stacked branch so the deploy repair and Sessions 30-34 can be reviewed together.
- Session 35 should build the user earnings and payout workspace on top of the monthly-cycle, calculation, and payout-domain work already in place.

---

### session v109: Build founder monthly contribution workflow
- timestamp: 2026-04-30T23:00:06Z
- agent: **Codex (GPT-5)**
- branch: **codex/supabase-deno-import-repair**
- head: pending final commit

#### Objective
Implement Session 33 by giving founders a monthly contribution workflow that organizes obligations, route readiness, submission state, and attribution handoff without moving the underlying payment write paths yet.

#### Actions Taken
- Added `/[locale]/founder/projects/[slug]/contributions` as the founder-facing monthly contribution workflow.
- Extended the founder workspace read model with economic-month contribution cycle summaries derived from existing payment obligations.
- Linked the new workflow from the founder home, project index, and per-project founder home while preserving existing payment and zkAS operation routes.
- Localized the new workflow copy in English, French, and Spanish.
- Updated navigation and route-inventory engineering docs plus backlog metadata to record the Session 33 route.

#### Tests and Validation Notes
- `pnpm dlx node@22.22.1 /opt/homebrew/bin/pnpm test tests/founder-workspace.test.ts` passed.
- `pnpm dlx node@22.22.1 /opt/homebrew/bin/pnpm typecheck` passed.
- `pnpm dlx node@22.22.1 /opt/homebrew/bin/pnpm lint` passed.
- `pnpm dlx node@22.22.1 /opt/homebrew/bin/pnpm test` passed.
- `deno cache --config supabase/functions/deno.json supabase/functions/project-onchain-payment-submission-record/index.ts` passed.
- `pnpm dlx node@22.22.1 /opt/homebrew/bin/pnpm check` passed.

#### Reflections
- The founder workflow now has a clean monthly cadence view, but payment creation, route management, and receipt submission remain on the already-hardened payment operations page.
- Grouping payments by economic month gives Session 34 and later reporting/payout work a clearer founder-facing anchor without creating new write surfaces prematurely.

#### Suggested Next Steps
- Yeet this stacked branch so the deploy repair and Sessions 30-33 can land together.
- Session 34 should build the project attribution/contribution-data submission workflow and can link from this monthly contribution page.

---

### session v108: Add fiat inbound and outbound execution stubs
- timestamp: 2026-04-30T22:49:32Z
- agent: **Codex (GPT-5)**
- branch: **codex/supabase-deno-import-repair**
- head: pending final commit

#### Objective
Implement Session 32 by adding intentional fiat inbound and outbound stubs behind the shared execution interface without implying that fiat funding or payouts are live.

#### Actions Taken
- Added fiat provider-not-configured deposit intent creation for product workflow planning.
- Added fiat receipt verification as an explicit `fiat_provider_not_configured` failure.
- Added fiat payout batch draft scaffolding with placeholder destination validation and `fundloop-fiat-payout-batch.v1` payload metadata.
- Kept fiat payout execution and reconciliation as explicit `capability_not_implemented` responses.
- Added execution-interface tests for fiat inbound intent creation, receipt verification failure, payout draft creation, and invalid fiat destination failure.
- Updated execution, payout, monthly-cycle, Edge Function, and backlog docs to record the Session 32 fiat scaffold.

#### Tests and Validation Notes
- `pnpm dlx node@22.22.1 /opt/homebrew/bin/pnpm test tests/execution-interface.test.ts` passed.
- `pnpm dlx node@22.22.1 /opt/homebrew/bin/pnpm typecheck` passed.
- `pnpm dlx node@22.22.1 /opt/homebrew/bin/pnpm lint` passed.
- `deno cache --config supabase/functions/deno.json supabase/functions/project-onchain-payment-submission-record/index.ts` passed.
- `pnpm dlx node@22.22.1 /opt/homebrew/bin/pnpm test` passed.
- `pnpm dlx node@22.22.1 /opt/homebrew/bin/pnpm check` passed.

#### Reflections
- Fiat now has the same execution-boundary shape as EVM and Solana, but the provider-not-configured metadata prevents the app from pretending a provider integration exists.
- Keeping receipt verification as a hard failure is safer than storing faux successful fiat receipts before a real processor contract is chosen.

#### Suggested Next Steps
- Yeet the stacked branch so the Supabase deploy repair and Sessions 30-32 can be reviewed together.
- Session 33 can now build founder monthly contribution workflows against a complete multi-rail abstraction rather than EVM-only assumptions.

---

### session v107: Add Solana payout adapter scaffolding
- timestamp: 2026-04-30T22:25:38Z
- agent: **Codex (GPT-5)**
- branch: **codex/supabase-deno-import-repair**
- head: pending final commit

#### Objective
Implement Session 31 by extending the outbound payout side of the execution interface so Solana can be modeled as a first-class payout rail without enabling live transfer execution yet.

#### Actions Taken
- Added Solana payout batch draft scaffolding that validates Solana destination addresses and Solana network metadata.
- Wrapped the generic deterministic payout draft with a Solana-specific `fundloop-solana-payout-batch.v1` payload, manual-transfer scaffold marker, network-key summary, and token-mint summary.
- Kept Solana payout execution and payout reconciliation as explicit `capability_not_implemented` responses.
- Added execution-interface tests for Solana payout draft success and invalid destination failure.
- Updated execution, payout, monthly-cycle, Edge Function, and backlog docs to record the Session 31 scaffold.

#### Tests and Validation Notes
- `pnpm dlx node@22.22.1 /opt/homebrew/bin/pnpm test tests/execution-interface.test.ts` passed.
- `pnpm dlx node@22.22.1 /opt/homebrew/bin/pnpm typecheck` passed.
- `pnpm dlx node@22.22.1 /opt/homebrew/bin/pnpm lint` passed.
- `deno cache --config supabase/functions/deno.json supabase/functions/project-onchain-payment-submission-record/index.ts` passed.
- `pnpm dlx node@22.22.1 /opt/homebrew/bin/pnpm test` passed.
- `pnpm dlx node@22.22.1 /opt/homebrew/bin/pnpm check` passed.

#### Reflections
- This keeps the payout side honest: Solana now has a real deterministic batch shape, but no code pretends outbound transfers or reconciliation are live.
- The shared builder remained useful; the Solana adapter only needed rail-specific destination validation and payload metadata.

#### Suggested Next Steps
- Yeet the stacked branch so the Supabase deploy repair and Sessions 30-31 can go through CI together.
- Session 32 can add fiat inbound/outbound stubs on the same execution boundary.

---

### session v106: Add Solana inbound contribution adapter
- timestamp: 2026-04-30T21:52:24Z
- agent: **Codex (GPT-5)**
- branch: **codex/supabase-deno-import-repair**
- head: pending final commit

#### Objective
Implement Session 30 by proving the shared execution interface can support Solana inbound contribution recording without duplicating the existing EVM payment subsystem.

#### Actions Taken
- Added Solana deposit-intent creation and signature/amount receipt-verification behavior behind `lib/execution`.
- Updated the project onchain payment submission command to select the execution adapter from the route chain ecosystem instead of hard-coding EVM.
- Added Solana reference data for `solana-mainnet`, SOL/USDC assets, and a `deposit_address` intake route that stays inactive unless a real treasury address is configured.
- Taught runtime deployment availability checks to allow configured Solana deposit-address routes outside the EVM wallet manifest.
- Updated execution-interface, Edge Function, route-inventory, and backlog docs to record the Session 30 adapter state.

#### Tests and Validation Notes
- `pnpm dlx node@22.22.1 /opt/homebrew/bin/pnpm test tests/execution-interface.test.ts tests/project-payment-operations-command.test.ts` passed.
- `pnpm dlx node@22.22.1 /opt/homebrew/bin/pnpm typecheck` passed.
- `pnpm dlx node@22.22.1 /opt/homebrew/bin/pnpm lint` passed.
- `supabase migration up` applied `20260430215000_solana_inbound_reference_data.sql` locally.
- `deno cache --config supabase/functions/deno.json supabase/functions/project-onchain-payment-submission-record/index.ts` passed.
- `pnpm dlx node@22.22.1 /opt/homebrew/bin/pnpm test` passed.
- `pnpm dlx node@22.22.1 /opt/homebrew/bin/pnpm build` passed.
- `pnpm dlx node@22.22.1 /opt/homebrew/bin/pnpm check` passed.

#### Reflections
- The storage model was already close: `chain_intake_contracts.collection_mode = deposit_address` gave Solana a home without new tables.
- The most important architectural cleanup was removing the remaining hard-coded EVM adapter choice from receipt recording.

#### Suggested Next Steps
- Yeet the stacked deploy-repair plus Session 30 branch to `dev` and confirm the Supabase deploy dry-run still sees the new migration and Edge Function graph cleanly.
- Session 31 can now add Solana payout adapter scaffolding without touching the inbound receipt-recording path again.

---

### session v105: Repair Deno-safe Supabase function imports
- timestamp: 2026-04-30T21:26:04Z
- agent: **Codex (GPT-5)**
- branch: **codex/supabase-deno-import-repair**
- head: pending final commit

#### Objective
Repair the post-merge dev Supabase deploy failure by making shared Edge Function import graphs Deno-safe.

#### Actions Taken
- Stopped a conflicting Smartrust local Supabase stack that was occupying the standard local Supabase ports.
- Started the FundLoop local Supabase stack and confirmed the merged migrations and seed replay locally.
- Added explicit `.ts` extensions to monthly-cycle Edge Function contract imports that are consumed by Supabase Edge Function bundling.
- Added explicit `.ts` extensions and relative type imports through the execution-interface module graph so Deno can resolve the EVM receipt path and future execution adapters without relying on Next/Vite aliases.

#### Tests and Validation Notes
- `supabase start` succeeded after stopping the conflicting Smartrust stack.
- `deno cache --config supabase/functions/deno.json supabase/functions/monthly-cycle-approval/index.ts supabase/functions/monthly-cycle-calculation-package/index.ts supabase/functions/monthly-cycle-lock/index.ts supabase/functions/monthly-cycle-payout-intents-create/index.ts supabase/functions/monthly-cycle-verification-review/index.ts supabase/functions/project-onchain-payment-submission-record/index.ts` passed.
- Local `supabase functions serve` smoke returned expected unauthenticated envelopes for `monthly-cycle-verification-review`, `monthly-cycle-payout-intents-create`, and `project-onchain-payment-submission-record` instead of module-resolution failures.
- `pnpm dlx node@22.22.1 /opt/homebrew/bin/pnpm test tests/monthly-cycle-calculation-package-contract.test.ts tests/monthly-cycle-verification-contract.test.ts tests/monthly-cycle-payout-intents-contract.test.ts tests/execution-interface.test.ts` passed.
- `pnpm dlx node@22.22.1 /opt/homebrew/bin/pnpm typecheck` passed.
- `pnpm dlx node@22.22.1 /opt/homebrew/bin/pnpm lint` passed.
- Strict `deno check` now resolves the module graph but still reports pre-existing implicit-`any` typing debt in shared function runtime helpers, so this repair uses Deno cache plus local serve smoke as the deployment-shape validation.

#### Reflections
- The remote failure was a classic Deno-vs-Next import boundary issue: TypeScript app imports tolerated extensionless local modules, but Supabase Edge bundling requires browser/Deno-style specifiers.
- Keeping this branch narrowly focused avoids turning a deploy repair into a broader function-runtime typing cleanup.

#### Suggested Next Steps
- Yeet this repair to `dev` and confirm the dev Supabase deploy workflow reaches the later monthly-cycle functions successfully.
- Follow up separately on strict Deno type-checking for shared Edge Function runtime helpers if we want `deno check` to become a formal CI gate.

---

### session v104: Address PR 37 automated review feedback
- timestamp: 2026-04-30T14:28:59Z
- agent: **Codex (GPT-5)**
- branch: **codex/session-23-cycle-prep-review**
- head: pending final commit

#### Objective
Harden the stacked monthly-cycle and execution-interface branch in response to automated Copilot and Codex PR review feedback before completing the yeet review gates.

#### Actions Taken
- Added a forward migration so `payment_flow_events.stage` accepts the new execution-interface receipt stages.
- Made calculation packaging retry-safe by marking partially-created runs failed after artifact or persistence failures, and returned the persisted package artifact hash for existing packages.
- Allowed finalized zkAS runs to satisfy monthly-cycle verification and approval checks.
- Tightened EVM receipt verification by rejecting mismatched embedded transaction hashes and preserving caller metadata with adapter-owned keys taking precedence.
- Made payout batch drafts sum rounded item amounts and canonicalize destination payload objects.
- Made monthly-cycle payout overview throw query errors instead of presenting them as missing cycles.
- Changed monthly-cycle creation for zkAS uploads to use an idempotent upsert/reselect flow.
- Added focused tests for the review-driven cases.

#### Tests and Validation Notes
- `pnpm test tests/monthly-cycle-calculation-package-command.test.ts tests/monthly-cycle-verification.test.ts tests/execution-interface.test.ts` passed once under the local default Node runtime, then the rerun was repeated with the repo-standard Node 22 wrapper after the default Node 25 runner hung.
- `pnpm lint` passed.
- `pnpm typecheck` passed.
- `pnpm dlx node@22.22.1 /opt/homebrew/bin/pnpm test tests/monthly-cycle-calculation-package-command.test.ts tests/monthly-cycle-verification.test.ts tests/execution-interface.test.ts` passed.
- `pnpm dlx node@22.22.1 /opt/homebrew/bin/pnpm typecheck` passed.

#### Reflections
- The comments were useful: most fixes were small, but they closed real operational traps around retryability, deterministic artifacts, and receipt provenance.
- The Node 22 wrapper remains the reliable local gate for this repo while the desktop default runtime is newer than the supported engine range.

#### Suggested Next Steps
- Push this review-fix commit, re-check CI, reply to and resolve the PR review comments, then continue the yeet gates through the existing Codex review.

---

### session v103: Move EVM inbound receipts behind execution interface
- timestamp: 2026-04-29T18:53:51-04:00
- agent: **Codex (GPT-5)**
- branch: **codex/session-23-cycle-prep-review**
- head: pending final commit

#### Objective
Implement Session 29 by refactoring the existing EVM inbound receipt-recording path behind the chain-abstracted execution interface without changing the founder-facing payment flow.

#### Actions Taken
- Extended the EVM execution adapter with receipt verification semantics for transaction hash presence, positive amount checks, and expected-vs-submitted amount matching.
- Updated `executeProjectOnchainPaymentSubmissionRecordCommand` so it creates an EVM deposit intent and verifies the submitted receipt through `lib/execution/` before inserting `onchain_payment_submissions`.
- Preserved the existing Edge Function, browser adapter, wallet UI, observability behavior, unresolved-submission guard, runtime deployment availability checks, and payment update behavior.
- Recorded execution-interface provenance in onchain submission metadata.
- Added focused tests for EVM receipt verification and updated the payment command test to assert execution-interface metadata on recorded submissions.
- Updated execution-interface, Edge Function, and navigation engineering docs.

#### Tests and Validation Notes
- `pnpm test tests/execution-interface.test.ts tests/project-payment-operations-command.test.ts` passed.
- `pnpm typecheck` passed.
- `pnpm lint` passed.
- `pnpm test` passed.
- `pnpm build` passed.
- `pnpm dlx node@22.22.1 /opt/homebrew/bin/pnpm check` passed.
- Direct local `pnpm` commands still emit the known Node 25 engine warning; the Node 22 wrapper gate passed.

#### Reflections
- This keeps the user-visible EVM flow stable while moving the backend acceptance boundary into the new rail adapter model.
- The wallet UI still uses wagmi/viem for browser transaction submission, which is appropriate for now; the backend command no longer needs to own EVM acceptance semantics inline.

#### Suggested Next Steps
- Yeet the stacked monthly-cycle/execution branch once the user is ready.
- Implement Session 30 by adding the first Solana inbound contribution adapter behind the same deposit interfaces.

---

### session v102: Build chain-abstracted execution interface
- timestamp: 2026-04-29T15:36:35-04:00
- agent: **Codex (GPT-5)**
- branch: **codex/session-23-cycle-prep-review**
- head: f86fae0a6809c3dd7e7ba4d175b362c5e94d822e

#### Objective
Implement Session 28 by adding the backend-facing execution boundary that future EVM, Solana, and fiat adapters will implement without moving the existing live EVM payment flow yet.

#### Actions Taken
- Added `lib/execution/` with FundLoop-centric contracts for deposit intent creation, deposit receipt verification, payout batch creation, payout execution, and payout reconciliation.
- Added an execution adapter registry for `evm`, `solana`, and `fiat_stub`.
- Added an EVM scaffold that can produce a FundLoop-facing deposit intent from an existing route snapshot while leaving receipt verification and payout execution explicit as unsupported.
- Added Solana and fiat-stub scaffold adapters with deterministic payout batch draft support and explicit unsupported execution/reconciliation responses.
- Added a deterministic payout batch draft builder that validates same rail/currency, requires routed positive intents, sorts items stably, and produces a stable execution payload.
- Added focused execution-interface tests.
- Updated payout, monthly-cycle, Edge Function, and navigation engineering docs with the new adapter boundary.

#### Tests and Validation Notes
- `pnpm test tests/execution-interface.test.ts` passed.
- `pnpm lint` passed.
- `pnpm typecheck` passed.
- `pnpm test` passed.
- `pnpm build` passed.
- `pnpm dlx node@22.22.1 /opt/homebrew/bin/pnpm check` passed.

#### Reflections
- The boundary is intentionally boring in the best way: workflows can now ask for FundLoop concepts like deposits, payout batches, and reconciliation without knowing whether the rail is EVM, Solana, or fiat.
- Keeping unsupported capabilities explicit should prevent future agents from mistaking scaffolding for live payout execution.

#### Suggested Next Steps
- Implement Session 29 by moving the existing EVM inbound payment path behind the execution adapter without changing user-facing payment behavior.
- Continue to keep payout execution itself deferred until the rail adapter sessions have made the execution semantics concrete.

---

### session v101: Create outbound payout domain model
- timestamp: 2026-04-29T15:27:56-04:00
- agent: **Codex (GPT-5)**
- branch: **codex/session-23-cycle-prep-review**
- head: 83264aadee313bb6f6b806e999b67c1c60c960e1

#### Objective
Implement Session 27 by introducing the outbound payout domain model and the first command that turns approved monthly-cycle user results into concrete payout work items.

#### Actions Taken
- Added payout route, payout intent, payout batch, batch item, and payout reconciliation tables with lifecycle enums, indexes, RLS, and monthly-cycle event support.
- Added `monthly-cycle-payout-intents-create` typed Edge Function contracts, browser/server adapters, and Supabase function handler.
- Added `lib/monthly-cycles/monthly-cycle-payout-intents-command.ts` to create idempotent payout intents from positive published user results, classify missing-route intents as drafts, and advance approved cycles into `distribution`.
- Added `/[locale]/admin/cycles/[cycleKey]/payouts` plus an operator action button and links from the monthly-cycle overview/result-review surfaces.
- Added the payout overview read model and focused command/contract tests.
- Regenerated `types/supabase.ts` from the local migrated Supabase schema and made two existing RPC call sites explicit about generated-type compatibility for nullable runtime arguments.
- Updated monthly-cycle, payout, Edge Function, navigation, and route-inventory engineering docs.

#### Tests and Validation Notes
- `supabase migration up` applied `20260429140700_payout_domain.sql` locally.
- `supabase gen types typescript --local > types/supabase.ts` completed against the local schema.
- `pnpm test tests/monthly-cycle-payout-intents-contract.test.ts tests/monthly-cycle-payout-intents-command.test.ts` passed.
- `pnpm lint` passed.
- `pnpm typecheck` passed.
- `pnpm test` passed.
- `pnpm build` passed and included `/[locale]/admin/cycles/[cycleKey]/payouts`.
- `pnpm dlx node@22.22.1 /opt/homebrew/bin/pnpm check` passed.
- `supabase status` confirmed the FundLoop local stack is running.
- Direct local `pnpm` commands still emit the known Node 25 engine warning; the Node 22 wrapper gate passed.

#### Reflections
- The outbound money model is now separate from founder payment collection, which makes the monthly-cycle handoff much easier to reason about.
- Missing user payout preferences are represented as draft payout intents rather than blocking the entire distribution stage.

#### Suggested Next Steps
- Yeet the stacked monthly-cycle branch to `dev` once the user is ready.
- Implement Session 28 by adding the chain-abstracted execution interface that will consume payout intents and create rail-specific batches.

---

### session v100: Add monthly-cycle verification and approval review
- timestamp: 2026-04-29T14:05:47-04:00
- agent: **Codex (GPT-5)**
- branch: **codex/session-23-cycle-prep-review**
- head: 918818d805546db7292fcc7cf8bc915d0af59838

#### Objective
Implement Session 26 by adding the cleanup, verification, and approval stages for calculated monthly-cycle results without starting distribution or payout creation yet.

#### Actions Taken
- Added `/[locale]/admin/cycles/[cycleKey]/verification` as the operator workspace for result cleanup checks, cycle verification, and approval for distribution.
- Added `lib/monthly-cycles/monthly-cycle-verification.ts` to compare completed zkAS output against result rows, artifact hashes, run verification state, failed-run warnings, and allocation totals.
- Added `monthly-cycle-verification-review` and `monthly-cycle-approval` typed Edge Function commands with browser adapters and Supabase function handlers.
- Added the monthly-cycle verification command module that records required-note decisions, writes audit events, moves clean cycles to `verification`, records cleanup-needed notes without advancing, and moves verified cycles to `approval`.
- Linked cycle overview and cycle zkAS pages into the new result-review workspace.
- Updated monthly-cycle, Edge Function, navigation, and route-inventory engineering docs.
- Added focused contract, read-model, and command tests.

#### Tests and Validation Notes
- `pnpm test tests/monthly-cycle-verification.test.ts tests/monthly-cycle-verification-contract.test.ts tests/monthly-cycle-calculation-package-command.test.ts` passed.
- `pnpm lint` passed.
- `pnpm typecheck` passed.
- `pnpm test` passed.
- `pnpm build` passed and included `/[locale]/admin/cycles/[cycleKey]/verification`.
- `pnpm dlx node@22.22.1 /opt/homebrew/bin/pnpm check` passed.
- `supabase status` confirmed the FundLoop local stack is running.
- Direct local `pnpm` commands still emit the known Node 25 engine warning; the Node 22 wrapper gate passed.

#### Reflections
- Monthly-cycle results now have an explicit operational checkpoint between calculation and distribution instead of relying on hidden run-level verification state alone.
- The approval command intentionally stops at `approval`; payout intent creation belongs to Session 27.

#### Suggested Next Steps
- Yeet the stacked Session 23-26 branch to `dev`.
- Implement Session 27 by creating the outbound payout domain model that consumes approved monthly-cycle outputs.

---

### session v99: Add deterministic monthly calculation packaging
- timestamp: 2026-04-29T13:54:51-04:00
- agent: **Codex (GPT-5)**
- branch: **codex/session-23-cycle-prep-review**
- head: pending final commit

#### Objective
Implement Session 25 on the existing stacked branch by adding a deterministic calculation-package command and artifact flow for locked monthly cycles.

#### Actions Taken
- Added the `monthly-cycle-calculation-package` typed Edge Function contract, browser/server adapters, and Supabase Edge Function.
- Added `lib/monthly-cycles/monthly-cycle-calculation-package-command.ts` to package cycle-linked approved datasets, the approved identity artifact, and confirmed payments into deterministic calculation artifacts.
- Wrote package artifacts to Supabase Storage under `zkas-runs/{cycleKey}/cycle-{cycleId}/calculation-package.v1.json` and locked run manifests under `zkas-runs/{cycleKey}/run-{runId}/run-manifest.v1.json`.
- Created locked `zkas_runs` rows, linked `zkas_run_datasets` and `zkas_run_payments`, marked datasets as included, and advanced the cycle to `calculation`.
- Added a client packaging button on `/[locale]/admin/cycles/[cycleKey]/zkas` that calls the Edge Function and refreshes the operator view.
- Updated monthly-cycle, Edge Function, navigation, and route-inventory engineering docs.
- Added contract and command tests for payload validation, invalid Edge responses, successful packaging, invalid cycle states, missing inputs, duplicate datasets, and ambiguous identity artifacts.

#### Tests and Validation Notes
- `pnpm test tests/monthly-cycle-calculation-package-contract.test.ts tests/monthly-cycle-calculation-package-command.test.ts tests/monthly-cycle-zkas.test.ts tests/monthly-cycle-prep.test.ts` passed.
- `pnpm lint` passed.
- `pnpm typecheck` passed.
- `pnpm test` passed.
- `pnpm build` passed.
- `pnpm dlx node@22.22.1 /opt/homebrew/bin/pnpm check` passed.
- `supabase status` confirmed the FundLoop local stack is running.
- Direct local `pnpm` commands still emit the known Node 25 engine warning; the Node 22 wrapper gate passed.

#### Reflections
- The calculation package now gives the monthly pipeline a durable handoff artifact instead of relying on operators to mentally connect prep review to manual zkAS run creation.
- The cycle package hash is the stable audit artifact. The current run manifest remains run-scoped because the existing execution engine consumes `run_id`.

#### Suggested Next Steps
- Yeet the stacked Session 23-25 branch to `dev`.
- Implement Session 26 by adding verification and approval stages around calculated outputs before distribution/payout work begins.

---

### session v98: Refactor zkAS around monthly-cycle contract
- timestamp: 2026-04-29T13:22:19-04:00
- agent: **Codex (GPT-5)**
- branch: **codex/session-23-cycle-prep-review**
- head: pending final commit

#### Objective
Implement Session 24 on the existing stacked feature branch by making zkAS read and write paths visibly attach to the first-class monthly-cycle contract, and clarify branch expectations in `AGENTS.md`.

#### Actions Taken
- Updated `AGENTS.md` to clarify that feature work belongs on feature branches, but related numbered sessions can be stacked on the same branch with separate commits and session-log entries.
- Added `lib/monthly-cycles/monthly-cycle-zkas.ts` as the server-owned cycle zkAS read model, deriving `not_locked`, `missing_inputs`, `ready_for_packaging`, `calculation_started`, and `published` postures from cycle-linked rows.
- Added `/[locale]/admin/cycles/[cycleKey]/zkas` as the operator view for cycle-linked datasets, identity artifacts, runs, run results, published user results, and project summaries.
- Linked monthly cycles and prep review into the new cycle zkAS stage while keeping existing `/admin/zkas` upload and run consoles as the action surfaces for now.
- Updated zkAS server actions so newly uploaded datasets, identity artifacts, draft runs, run results, and published outputs resolve and write `monthly_cycle_id` where the current schema supports it.
- Updated monthly-cycle, navigation-shell, and route-inventory engineering docs to record that zkAS is now anchored to the monthly cadence.
- Added focused tests for the new monthly-cycle zkAS read model.

#### Tests and Validation Notes
- `pnpm test tests/monthly-cycle-zkas.test.ts tests/monthly-cycle-prep.test.ts tests/monthly-cycles.test.ts` passed.
- `pnpm lint` passed.
- `pnpm typecheck` passed.
- `pnpm test` passed.
- `pnpm build` passed and included `/[locale]/admin/cycles/[cycleKey]/zkas`.
- `pnpm dlx node@22.22.1 /opt/homebrew/bin/pnpm check` passed.
- `supabase status` confirmed the FundLoop local stack is running.
- SQL smoke against local Supabase confirmed recent `monthly_cycles` rows are queryable with cycle-linked zkAS dataset/run counts.
- Direct local `pnpm` commands still emit the known Node 25 engine warning; the Node 22 wrapper gate passed.

#### Reflections
- This keeps Session 24 appropriately bounded: zkAS is now cycle-visible and writes attach to cycle rows, but calculation packaging and verification commands remain deferred.
- The old `/admin/zkas` routes still matter as operational consoles. The new cycle page gives operators the missing monthly-cadence mental model without forcing a risky route move.

#### Suggested Next Steps
- Yeet the stacked Session 23/24 branch to `dev`.
- Implement Session 25 by turning the ready cycle/zkAS posture into a deterministic calculation package and artifact flow.

---

### session v97: Add monthly-cycle prep review workspace
- timestamp: 2026-04-29T12:58:12-04:00
- agent: **Codex (GPT-5)**
- branch: **codex/session-23-cycle-prep-review**
- head: pending final commit

#### Objective
Repair the local Supabase health issue noted in Session 22 and implement Session 23 by adding a read-only prep and exception review workspace on top of locked monthly-cycle manifests.

#### Actions Taken
- Stopped the competing `Genero` Supabase containers that were preventing this repo from finding `supabase_db_fundloop`.
- Started the FundLoop local Supabase stack and applied pending local migrations, including the Session 22 lock migration.
- Added `lib/monthly-cycles/monthly-cycle-prep.ts` with a server-owned prep read model that evaluates locked manifests into `not_locked`, `blocked`, `needs_review`, or `ready` postures.
- Added `/[locale]/admin/cycles/[cycleKey]/prep` as the operator prep and exception review workspace.
- Linked locked/non-open cycles from `/[locale]/admin/cycles` into the prep review route.
- Surfaced prep blockers and warnings for missing manifests, hash mismatches, unresolved onchain submissions, missing zkAS inputs, missing identity artifacts, and CUBID identity snapshot issues.
- Added informational live-row drift checks so operators can see current DB differences without treating live rows as the calculation source of truth.
- Updated monthly-cycle, navigation, and route-inventory engineering docs.
- Added focused unit tests for the prep review model.

#### Tests and Validation Notes
- Local Supabase repair and migration smoke passed:
  - `supabase start` restored the FundLoop stack after stopping competing containers.
  - `supabase migration up` applied `20260428093000_monthly_cycle_lock.sql`.
  - SQL smoke confirmed `public.monthly_cycles` has 17 local rows and `public.monthly_cycle_events` exists.
- `pnpm test tests/monthly-cycle-prep.test.ts tests/monthly-cycles.test.ts` passed.
- `pnpm lint` passed.
- `pnpm test` passed.
- `pnpm typecheck` passed.
- `pnpm build` passed.
- `pnpm dlx node@22.22.1 /opt/homebrew/bin/pnpm check` passed.
- Commands run directly under the local shell still emit the known Node 25 engine warning; the Node 22 wrapper gate passed.

#### Reflections
- Prep now gives operators a concrete review posture without prematurely adding transition commands or calculation artifacts.
- Keeping live drift informational reinforces the intended contract: downstream calculation should use the immutable lock manifest, not mutable current rows.

#### Suggested Next Steps
- Yeet Session 23 to `dev`.
- Implement Session 24: align zkAS datasets, run manifests, and publication outputs more tightly with the monthly-cycle contract.

---

### session v96: Address PR 36 Copilot lock review
- timestamp: 2026-04-29T04:43:27-04:00
- agent: **Codex (GPT-5)**
- branch: **codex/session-22-monthly-cycle-lock**
- head: pending final commit

#### Objective
Address Copilot review feedback on PR #36 before requesting or acting on the Codex review phase.

#### Actions Taken
- Made monthly-cycle audit event insertion explicit by returning insert errors and failing lock attempts when the audit write cannot be recorded.
- Reattached onchain submissions by their payment's monthly cycle rather than by submission timestamp, preventing late prior-cycle submissions from being assigned to the wrong economic month.
- Shared unresolved onchain submission status logic so the admin overview counts `confirming` rows the same way the lock command blocks them.
- Replaced locale-sensitive manifest ordering with a stable string comparator for lock-manifest inputs.
- Added the missing `server-only` guard to the server Edge Function adapter.
- Updated `/admin/cycles` to use locale-aware navigation and active-locale currency formatting.
- Added regression tests for audit insert failures and late submitted onchain receipts.

#### Tests and Validation Notes
- `pnpm test tests/monthly-cycle-lock-command.test.ts tests/monthly-cycle-lock-contract.test.ts tests/monthly-cycle-lock-button.test.tsx tests/monthly-cycles.test.ts` passed.
- `pnpm typecheck` passed.
- `pnpm lint` passed.
- Full gates will be rerun before pushing the review-fix commit.

#### Reflections
- The review found exactly the right class of issues for this domain: determinism, audit guarantees, and month attribution. Tightening those now keeps the lock manifest trustworthy before downstream sessions start depending on it.

#### Suggested Next Steps
- Push the review-fix commit, confirm CI returns green, then resolve/comment on the Copilot threads before moving to the Codex review gate.

---

### session v95: Add monthly-cycle lock workflow
- timestamp: 2026-04-28T04:42:45-04:00
- agent: **Codex (GPT-5)**
- branch: **codex/session-22-monthly-cycle-lock**
- head: pending final commit

#### Objective
Implement Session 22 by adding the first monthly-cycle mutation: an audited end-of-month lock command that freezes an open cycle into a deterministic manifest for later prep, calculation, payout, and reporting work.

#### Actions Taken
- Added a forward migration for monthly-cycle lock fields and `monthly_cycle_events` audit records.
- Added the typed `monthly-cycle-lock` Edge Function contract, browser/server adapters, Deno function entrypoint, and shared domain command.
- Implemented lock behavior that reattaches same-month operational rows, snapshots confirmed payments, onchain reconciliation state, approved zkAS inputs, and active participants' CUBID identity summary, then stores a SHA-256 manifest hash.
- Blocked unresolved onchain submissions by default and added a strongly worded admin override modal that requires an explicit reason before retrying.
- Updated `/[locale]/admin/cycles` from read-only overview to a lock-capable operator surface for open cycles.
- Updated monthly-cycle, Edge Function, navigation, and route inventory docs, plus Session 22 backlog metadata.

#### Tests and Validation Notes
- `pnpm test tests/monthly-cycle-lock-contract.test.ts tests/monthly-cycle-lock-button.test.tsx tests/monthly-cycle-lock-command.test.ts tests/monthly-cycles.test.ts` passed.
- `pnpm lint` passed.
- `pnpm test` passed.
- `pnpm typecheck` passed.
- `pnpm build` passed.
- `pnpm dlx node@22.22.1 /opt/homebrew/bin/pnpm check` passed.
- `git diff --check` passed.
- Local Supabase migration smoke was attempted, but `supabase start` tore the stack down because analytics/realtime/studio did not become healthy and `supabase_db_fundloop` was not available afterward.
- The local shell still emits the repo's existing Node 25 engine warning for commands run without the Node 22 wrapper; the Node 22 `pnpm check` gate passed.

#### Reflections
- The lock point now creates the first durable handoff artifact in the monthly cadence. That makes downstream prep and calculation sessions much safer because they can depend on a frozen manifest rather than live mutable rows.
- The unresolved-onchain override is intentionally available but uncomfortable, which fits the bookkeeping risk: operators can proceed when needed, but the reason is permanently attached to the cycle.

#### Suggested Next Steps
- Repair the local Supabase health issue separately so migration smoke can be rerun before or during the PR.
- Implement Session 23: cycle prep and exception review workspace using the locked manifest as the input boundary.

---

### session v94: Smoke monthly-cycle migration locally
- timestamp: 2026-04-28T03:14:30-04:00
- agent: **Codex (GPT-5)**
- branch: **codex/session-21-monthly-cycles**
- head: pending final commit

#### Objective
Resolve the local Supabase availability issue and rerun the Session 21 migration smoke against the local FundLoop stack.

#### Actions Taken
- Confirmed FundLoop was unavailable because a different local Supabase stack, `everfund`, was running while FundLoop expected `supabase_db_fundloop`.
- Stopped the `everfund` Supabase stack and removed one leftover unhealthy `supabase_analytics_everfund` container that was still holding port `54327`.
- Started the FundLoop local Supabase stack.
- Applied pending local migrations, including `20260428000500_monthly_cycles.sql`.
- Queried the local database to verify the `monthly_cycle_status` enum, backfilled `monthly_cycles` rows, and linked monthly-cycle payment rows.

#### Tests and Validation Notes
- `supabase migration up` passed locally.
- Local SQL smoke passed:
  - `monthly_cycle_status` exists.
  - `public.monthly_cycles` contains 17 backfilled rows.
  - `public.payments` has 5 rows linked with `monthly_cycle_id`.
  - `public.zkas_runs` has 0 linked rows in the current local data set, which is expected because this local seed has no zkAS run rows requiring linkage.

#### Reflections
- The earlier smoke blocker was environmental rather than a migration failure: stale `everfund` containers were occupying the local Supabase ports.

#### Suggested Next Steps
- Yeet Session 21 to `dev`.
- Keep the FundLoop local Supabase stack running only while actively smoke testing, or stop it before switching repos to avoid future project-id port conflicts.

---

### session v93: Introduce first-class monthly cycles
- timestamp: 2026-04-27T20:13:22-04:00
- agent: **Codex (GPT-5)**
- branch: **codex/session-21-monthly-cycles**
- head: pending final commit

#### Objective
Implement Session 21 by adding a durable monthly-cycle domain model and a read-only operator overview that future lock, prep, zkAS, payout, and reporting work can attach to.

#### Actions Taken
- Added a forward Supabase migration for `monthly_cycle_status`, `monthly_cycles`, nullable `monthly_cycle_id` foreign keys across payment/onchain/zkAS/monthly stats tables, backfill logic, and lookup indexes.
- Added `lib/monthly-cycles/` with month parsing, status labels, a pure admin overview builder, and a server-side loader that degrades partial read failures into warnings.
- Added `/[locale]/admin/cycles` as a read-only operator page and linked it from the admin dashboard and app-shell admin subnav.
- Updated generated Supabase types, route/navigation docs, the engineering docs index, and a new monthly-cycle engineering reference.
- Added focused monthly-cycle unit tests for month parsing, empty state handling, linked summaries, lifecycle counts, and warning preservation.

#### Tests and Validation Notes
- `pnpm test tests/monthly-cycles.test.ts` passed.
- `pnpm typecheck` passed.
- `pnpm lint` passed.
- `pnpm test` passed.
- `pnpm build` passed.
- `pnpm dlx node@22.22.1 /opt/homebrew/bin/pnpm check` passed.
- Local Supabase migration smoke was not run because the local Supabase DB container is not currently available (`supabase_db_fundloop` missing).
- The local shell is on Node 25, so pnpm emitted the existing repo engine warning for `>=22 <23`; validation still completed successfully.

#### Reflections
- Monthly cadence now has an explicit database object and operator read model instead of relying on scattered month strings and period dates.
- The nullable FK rollout keeps current workflows stable while later sessions tighten lock and transition semantics.

#### Suggested Next Steps
- Yeet Session 21 to `dev`.
- Implement Session 22: the first monthly-cycle mutation, `monthly-cycle-lock`, behind a typed Edge Function command.

---

### session v92: Address PR 35 review comments
- timestamp: 2026-04-27T19:49:10-04:00
- agent: **Codex (GPT-5)**
- branch: **codex/docs-context-cleanup**
- head: pending final commit

#### Objective
Address actionable Copilot review feedback on PR #35 before merge.

#### Actions Taken
- Removed trailing whitespace from the backlog execution-rules header.
- Clarified the README Edge Function section by listing concrete command slugs instead of mixing command names with domain descriptions.

#### Tests and Validation Notes
- Validation was scoped to the documentation-only review fixes.
- `git diff --check` passed after the edits.

#### Reflections
- The follow-up keeps the cleanup PR focused while making the Edge Function inventory more useful for future agents.

#### Suggested Next Steps
- Resolve the addressed Copilot threads and continue PR review follow-through.

---

### session v91: Delete stale wallet readiness branch
- timestamp: 2026-04-27T19:33:21-04:00
- agent: **Codex (GPT-5)**
- branch: **codex/docs-context-cleanup**
- head: pending final commit

#### Objective
Finish branch hygiene by deleting the remaining stale `codex/wallet-production-readiness` branch after analysis showed it had no salvage-worthy unique work.

#### Actions Taken
- Rechecked local branches and confirmed `codex/docs-context-cleanup` was the active cleanup branch.
- Deleted `codex/wallet-production-readiness`.
- Verified the only remaining local `codex/*` branch is `codex/docs-context-cleanup`.
- Updated `agent-context/repo-status.md` to mark branch hygiene complete.

#### Tests and Validation Notes
- No runtime tests were run because this pass only deleted a local branch and updated cleanup documentation.
- `git branch` confirmed no stale local `codex/*` branches remain.

#### Reflections
- The branch list is now intentionally small: only `dev` and the active cleanup branch remain locally.

#### Suggested Next Steps
- Yeet the cleanup branch to `dev`, then continue with Session 21.

---

### session v90: Document environment lanes and testing ownership
- timestamp: 2026-04-27T19:18:50-04:00
- agent: **Codex (GPT-5)**
- branch: **codex/docs-context-cleanup**
- head: pending final commit

#### Objective
Complete the environment and testing guidance item from the repository cleanup audit.

#### Actions Taken
- Added `docs/engineering/env-and-testing.md` to define local, remote preview/dev, and production Supabase environment lanes.
- Documented env-file conventions for `.env.example`, `.env.local`, and optional ignored `.env.remote.local`.
- Added a concise testing ownership table that maps common change types to their expected validation lanes.
- Updated `README.md`, `AGENTS.md`, and `docs/engineering/README.md` to point agents and contributors at the new guide.
- Updated `agent-context/repo-status.md` to mark environment conventions and testing strategy guidance complete.

#### Tests and Validation Notes
- Validation was documentation-focused.
- `git diff --check` passed.
- Reference search confirmed the new environment/testing guide is linked from the README, AGENTS guide, and engineering docs index.

#### Reflections
- The repo now has a single place to answer “which Supabase am I using?” and “which tests own this kind of change?”, which should reduce accidental remote coupling and over/under-testing.

#### Suggested Next Steps
- Decide whether to yeet the cleanup branch now or do one more pass on the remaining divergent `codex/wallet-production-readiness` branch.

---

### session v89: Prune merged local feature branches
- timestamp: 2026-04-27T19:14:00-04:00
- agent: **Codex (GPT-5)**
- branch: **codex/docs-context-cleanup**
- head: pending final commit

#### Objective
Complete the branch-hygiene item from the repository cleanup audit by removing local `codex/*` branches that are clearly merged into `dev`.

#### Actions Taken
- Checked local `codex/*` branches against `origin/dev` and GitHub PR state.
- Deleted the safe merged local branches:
  - `codex/participation-marketing-refresh` from merged PR #17
  - `codex/supabase-function-entrypoints` from merged PR #28
  - `codex/supabase-function-bundling-repair` from merged PRs #29 and #30
  - `codex/supabase-cubid-deno-repair` from merged PR #31
- Left `codex/docs-context-cleanup` because it is the active cleanup branch.
- Left `codex/wallet-production-readiness` because it has no GitHub PR and diverges from `dev`, so it is not mechanically safe to delete without a separate decision.
- Updated `agent-context/repo-status.md` with the branch-hygiene outcome and remaining recommendation.

#### Tests and Validation Notes
- Verified each deleted branch was listed as merged into `origin/dev` and had a merged PR where available.
- No runtime tests were run because this pass only deleted local Git branches and updated cleanup documentation.

#### Reflections
- The local branch list is now small enough to reason about: one active cleanup branch plus one older divergent wallet branch that needs a human/archive decision.

#### Suggested Next Steps
- Decide whether to archive or delete `codex/wallet-production-readiness` after confirming no unique work needs to be salvaged.
- Yeet the cleanup branch once the repo-cleanup bundle is complete.

---

### session v88: Remove ignored local build artifacts
- timestamp: 2026-04-27T18:46:11-04:00
- agent: **Codex (GPT-5)**
- branch: **codex/docs-context-cleanup**
- head: pending final commit

#### Objective
Complete the local artifact hygiene item from the repository cleanup audit without touching tracked source files or dependency installs.

#### Actions Taken
- Removed ignored local build/cache artifacts:
  - `.next`
  - `.playwright-cli`
  - `output`
  - `.DS_Store`
  - `tsconfig.tsbuildinfo`
  - `supabase/functions/node_modules`
- Preserved tracked files such as `supabase/functions/deno.lock`.
- Preserved installed dependencies under root `node_modules` and `contracts/node_modules` so local development remains ready.
- Updated `agent-context/repo-status.md` to mark artifact hygiene complete.

#### Tests and Validation Notes
- Verified `git status` stayed clean except for the tracked `repo-status` and session-log updates.
- No runtime tests were run because this pass only removed ignored local artifacts.

#### Reflections
- This reclaimed local build/cache space while avoiding dependency reinstall churn.

#### Suggested Next Steps
- Continue the cleanup branch with branch hygiene or yeet the docs/context plus artifact-status cleanup when ready.

---

### session v87: Move durable architecture docs out of agent context
- timestamp: 2026-04-27T18:42:11-04:00
- agent: **Codex (GPT-5)**
- branch: **codex/docs-context-cleanup**
- head: pending final commit

#### Objective
Complete the first repo-cleanup documentation bundle by keeping `agent-context/` lightweight, moving long-lived architecture docs into engineering docs, and tightening the Edge Function backend-boundary guidance.

#### Actions Taken
- Moved the backgrounder, current-state architecture, and target-state architecture docs from `agent-context/` into `docs/engineering/`.
- Updated `agent-context/README.md`, `docs/engineering/README.md`, route/IA docs, and the backlog header so planning links point at the new canonical engineering-doc locations.
- Refreshed the README Edge Function section so it reflects the current migrated command domains, CUBID Edge Function paths, and the temporary package/import-map state.
- Tightened `AGENTS.md` to state the repo-wide Edge Function command rule for new writes, the migration posture for legacy direct writes, and the preferred boundary for workflow/agent-facing reads.
- Updated `agent-context/repo-status.md` to reflect that Session 20 has landed and that the docs/context cleanup items are now resolved.

#### Tests and Validation Notes
- Repo-wide reference search confirmed no live docs still point to moved architecture files under `agent-context/`; remaining matches are historical session-log entries.
- Validation is documentation-focused; no runtime behavior changed.

#### Reflections
- Keeping durable architecture under `docs/engineering/` makes `agent-context/` much less noisy for implementation agents while preserving the planning trail.

#### Suggested Next Steps
- Continue with Session 21 now that the active context surface is lighter and the Edge Function backend-boundary rule is explicit.

---

### session v86: Preserve admin confirmation domain errors
- timestamp: 2026-04-27T17:04:48-04:00
- agent: **Codex (GPT-5)**
- branch: **codex/session-20-admin-edge-functions**
- head: pending final commit

#### Objective
Address the late Codex review feedback that the query-failure guard could hide expected missing-record domain errors in admin payment confirmation.

#### Actions Taken
- Changed the payment and confirmed-status prerequisite reads from `.single()` to `.maybeSingle()` so missing rows stay in the intended `payment_not_found` and `status_not_configured` branches.
- Added regression tests proving no-row payment and no-row confirmed-status lookups preserve those specific error codes.

#### Tests and Validation Notes
- `pnpm test -- admin-payment-operations-command` passed.
- `pnpm lint` passed.
- `pnpm typecheck` passed.
- Local pnpm commands emitted the existing Node engine warning because this shell is using Node 25 while the repo expects Node 22.

#### Reflections
- This was a useful guardrail after the earlier query-error hardening: transport/query failures and expected absence cases now remain distinct.

#### Suggested Next Steps
- Push the fix, reply to and resolve the Codex thread, then wait for the final CI pass to return green.

---

### session v85: Address Codex Edge bundling review
- timestamp: 2026-04-27T16:59:31-04:00
- agent: **Codex (GPT-5)**
- branch: **codex/session-20-admin-edge-functions**
- head: pending final commit

#### Objective
Address Codex review feedback on PR #34 by making the admin payment Edge Function bundle path Deno-safe.

#### Actions Taken
- Removed the admin operation handler's dependency on the broader wallet runtime config module and replaced it with a small Edge-local deployment-environment resolver.
- Added Deno-compatible JSON import attributes to the wallet deployment manifests so shared runtime config can be resolved in Deno contexts.
- Replaced the onchain supported-chain import from `wagmi/chains` with `viem/chains`, avoiding an unnecessary React/wagmi dependency in Edge function graphs.
- Added explicit Supabase function import-map entries for `viem`, `viem/chains`, and `zod`.
- Made the admin Supabase client type import relative and extensioned so Deno can resolve it.
- Added `supabase/functions/deno.lock` for deterministic Deno npm resolution and ignored the generated Supabase function `node_modules` cache.

#### Tests and Validation Notes
- `deno info --config supabase/functions/deno.json supabase/functions/admin-payment-receipt-confirm/index.ts` resolved cleanly with no missing, unsupported, or unmapped imports.
- `deno info --config supabase/functions/deno.json supabase/functions/admin-onchain-payment-reconciliation-run/index.ts` resolved cleanly with no missing, unsupported, or unmapped imports.
- `pnpm lint` passed.
- `pnpm typecheck` passed.
- `pnpm test -- admin-payment-operations-command onchain-reconciliation-route runtime-config` passed.
- Local pnpm commands emitted the existing Node engine warning because this shell is using Node 25 while the repo expects Node 22.

#### Reflections
- The review surfaced a deploy-time boundary issue that local app tests would not catch; keeping Edge import graphs explicitly Deno-visible should prevent the post-merge Supabase deploy from failing late.

#### Suggested Next Steps
- Push the fix, reply to the Codex thread with the commit reference, resolve it, and wait for CI to return green one last time.

---

### session v84: Address Copilot review on admin payment edge migration
- timestamp: 2026-04-27T16:49:34-04:00
- agent: **Codex (GPT-5)**
- branch: **codex/session-20-admin-edge-functions**
- head: pending final commit

#### Objective
Address Copilot's review feedback on PR #34 before requesting the next review phase.

#### Actions Taken
- Changed the internal reconciliation route so malformed JSON returns a 400 instead of being treated like an empty request body.
- Added explicit Supabase query-error handling for admin payment confirmation prerequisites so operational read failures are no longer misclassified as missing records.
- Removed the redundant manual-confirmation update against `onchain_payment_submissions`, avoiding a race-prone confirmation path that the command already rejects.
- Normalized the shared Edge `authenticateRequest()` success shape with `mode: "user"` so admin operation handlers can branch consistently across user and internal-secret auth modes.
- Added focused regression coverage for malformed internal reconciliation requests, prerequisite query failures, and the removed onchain submission update.

#### Tests and Validation Notes
- `pnpm test -- admin-payment-operations-command onchain-reconciliation-route` passed.
- `pnpm lint` passed.
- `pnpm typecheck` passed.
- Local commands emitted the existing Node engine warning because this shell is using Node 25 while the repo expects Node 22.

#### Reflections
- The review comments were good operational-hardening catches around error classification and race safety, not broad design changes.

#### Suggested Next Steps
- Push the fixes, reply to each Copilot thread with the commit reference, resolve the threads, and re-check CI before requesting Codex review.

---

### session v83: Record repository cleanup audit
- timestamp: 2026-04-27T16:36:55-04:00
- agent: **Codex (GPT-5)**
- branch: **codex/session-20-admin-edge-functions**
- head: pending final commit

#### Objective
Capture a lightweight repository cleanup audit before publishing the current Session 20 branch, so follow-up agents can distinguish safe hygiene from work that should wait until the branch lands.

#### Actions Taken
- Added `agent-context/repo-status.md` with a concise status matrix covering docs, agent context, CUBID packaging, CI, Supabase deploy, Edge Function compliance, local artifacts, and branch hygiene.
- Reconciled the Session 20 session-log head now that the implementation commit exists locally.
- Kept the cleanup pass non-destructive: no branches were deleted, no ignored build artifacts were removed, and no product code was changed.

#### Tests and Validation Notes
- `git status` was inspected to verify the only new cleanup artifact before this session-log entry was `agent-context/repo-status.md`.
- No runtime tests were run because this is documentation and repository hygiene only.

#### Reflections
- The repo is in a healthy enough state to publish the active branch, but the cleanup audit makes clear that Session 20 should land before the next roadmap implementation starts.

#### Suggested Next Steps
- Push this branch, open a draft PR into `dev`, and let the normal CI/review loop validate the combined Session 20 and cleanup-audit work.

---

### session v82: Move admin payment operations behind Edge Functions
- timestamp: 2026-04-26T18:17:29-04:00
- agent: **Codex (GPT-5)**
- branch: **codex/session-20-admin-edge-functions**
- head: e6d4dc5c22229a832125c8181b3c1be2cae084a0 - feat(payments): migrate admin payment ops to edge commands

#### Objective
Complete Session 20 by moving the remaining admin payment confirmation and reconciliation write flows behind typed Supabase Edge Function commands, while also removing the temporary FundLoop-local CUBID Deno mirror and documenting the remaining Cubid publication follow-up.

#### Actions Taken
- Added the new admin payment command layer in `lib/payments/admin-payment-operations-command.ts` with shared observability writes for `admin_confirmation` and the new `admin_reconciliation` flow.
- Added typed contracts and adapters for:
  - `admin-payment-receipt-confirm`
  - `admin-onchain-payment-reconciliation-run`
- Added the corresponding Supabase Edge Function entrypoints plus a shared admin operation handler and dual auth mode support for:
  - authenticated internal-admin Supabase users
  - secret-gated internal system callers through `x-fundloop-cron-secret`
- Reworked `app/actions/project-payment-actions.ts` so the admin mutation exports are now thin compatibility wrappers around the new server invokers.
- Reworked `components/admin/payments-console.tsx` and `components/admin/reconciliation-run-button.tsx` so the browser UI now calls the browser Edge adapters directly instead of importing server actions.
- Reworked `/api/internal/payments/reconcile-onchain` into a thin secret-gated wrapper around the reconciliation Edge Function using a new privileged internal server invoker helper.
- Extended `payment_flow_events` via a forward migration so observability now supports:
  - `flow = 'admin_reconciliation'`
  - `actor_role = 'system'`
- Finished the Deno-safe shared-runtime refactor by:
  - exporting a runtime-agnostic env helper
  - removing remaining hidden Node assumptions from reconciliation/admin-client helpers
  - adding an internal-admin allowlist helper shared across Next and Edge runtimes
- Removed the repo-local Supabase-function CUBID mirror and changed `supabase/functions/deno.json` to resolve `@cubid/api` from the installed package entrypoint under the repo root `node_modules/`.
- Prepared the adjacent Cubid SDK v2 source tree for npm/JSR publication:
  - added `packages/api/jsr.json`
  - added `packages/api/README.md`
  - added a Deno check script and explicit `.ts` source specifiers for Deno importability
  - documented Supabase Edge / Deno usage in the Cubid README
  - actual npm/JSR publication was blocked here because publish auth was not available and the local Cubid SDK directory was not a git checkout in this workspace
- Updated engineering docs for the new admin command pattern, secret-gated internal route behavior, and the post-mirror CUBID import mapping.

#### Tests and Validation Notes
- `pnpm typecheck` passed.
- `pnpm test -- admin-payment-operations-contract admin-payment-operations-command onchain-reconciliation-route admin-payments-console reconciliation-run-button project-payment-observability-actions` passed.
- `deno info --config supabase/functions/deno.json supabase/functions/user-cubid-resolve-email/index.ts` resolved cleanly against the installed `@cubid/api` package entrypoint.
- `deno info --config supabase/functions/deno.json supabase/functions/user-cubid-sync-profile/index.ts` resolved cleanly against the installed `@cubid/api` package entrypoint.
- `pnpm lint` passed.
- `pnpm test` passed.
- `pnpm typecheck` passed.
- `pnpm build` passed.
- `go run github.com/rhysd/actionlint/cmd/actionlint@latest .github/workflows/supabase-deploy.yml` passed.

#### Reflections
- The admin payment write path now follows the same typed Edge Function contract model as the founder payment and onboarding domains, which makes the remaining operator/backend migrations much more mechanical.
- Removing the function-local CUBID mirror is a real simplification, but the final ideal state still depends on publishing `@cubid/api` to npm and JSR so FundLoop can stop depending on an installed-package path mapping.

#### Suggested Next Steps
- Publish `@cubid/api` from the Cubid repo to npm and JSR, then switch `supabase/functions/deno.json` from the installed package path to the canonical `jsr:` import.
- Continue with Session 21 or the next operator/payment-cycle domain now that both founder and internal payment writes share the same Edge command architecture.

---

### session v81: Exclude Supabase helper directories from function deployment
- timestamp: 2026-04-26T16:02:58-04:00
- agent: **Codex (GPT-5)**
- branch: **codex/supabase-skip-vendor-dir**
- head: pending final commit

#### Objective
Fix the follow-up `dev` Supabase deploy failure after PR #32 by teaching the deploy workflow to skip helper-only directories such as `_vendor` when enumerating Edge Functions.

#### Actions Taken
- Updated `.github/workflows/supabase-deploy.yml` so the function deploy loop ignores both `_shared` and `_vendor`.
- Updated the Supabase deployment and Edge Function docs to record that helper directories participate in bundling but are not deployable functions.

#### Tests and Validation Notes
- `go run github.com/rhysd/actionlint/cmd/actionlint@latest .github/workflows/supabase-deploy.yml` passed.
- `ruby -e 'require "yaml"; YAML.load_file(".github/workflows/supabase-deploy.yml"); puts "yaml ok"'` passed.
- `git diff --check` passed.
- End-to-end confirmation will come from the PR dry-run plus the post-merge `dev` Supabase deploy workflow.

#### Reflections
- The Cubid import-path repair is holding; this second failure is just a deployment enumerator assumption that no longer matches the repo layout.
- Keeping helper directories prefixed and documented reduces the chance of repeating this class of workflow mistake as more function-local runtime assets are added.

#### Suggested Next Steps
- Validate the workflow, land this narrow follow-up, and confirm the next `dev` Supabase deploy runs green end to end.

---

### session v80: Vendor a Deno-visible CUBID API shim for Supabase deploys
- timestamp: 2026-04-26T15:56:07-04:00
- agent: **Codex (GPT-5)**
- branch: **codex/supabase-cubid-vendor-repair**
- head: pending final commit

#### Objective
Fix the remaining `dev` Supabase deploy failure by replacing the CI-fragile `node_modules` import-map path for `@cubid/api` with a repo-tracked Deno-visible runtime mirror.

#### Actions Taken
- Repointed `supabase/functions/deno.json` so `@cubid/api` resolves to a repo-owned file under `supabase/functions/_vendor/` instead of a runner-specific `node_modules` path.
- Added a minimal runtime-compatible `@cubid/api` mirror for the Supabase Edge Function graph covering the CUBID methods used by the onboarding and identity sync commands.
- Updated the Supabase deployment and Edge Function engineering docs to record that unpublished packages used by Edge Functions must resolve to repo-tracked Deno-visible files.

#### Tests and Validation Notes
- `deno info --config supabase/functions/deno.json supabase/functions/user-cubid-resolve-email/index.ts` resolved cleanly and loaded the vendored CUBID API mirror.
- `deno info --config supabase/functions/deno.json supabase/functions/user-cubid-sync-profile/index.ts` resolved cleanly and loaded the vendored CUBID API mirror.
- `pnpm dlx node@22.22.1 /opt/homebrew/bin/pnpm lint` passed.
- `pnpm dlx node@22.22.1 /opt/homebrew/bin/pnpm test` passed.
- `pnpm dlx node@22.22.1 /opt/homebrew/bin/pnpm build` passed.
- `pnpm dlx node@22.22.1 /opt/homebrew/bin/pnpm typecheck` passed after the build regenerated `.next/types`.
- `git diff --check` passed.

#### Reflections
- The failure mode was path determinism inside the Supabase bundling container, not the CUBID command logic itself.
- FundLoop is now insulated from pnpm layout differences, but the healthier long-term fix is still to publish a first-class Deno/Edge-consumable `@cubid/api` package from the Cubid repo.

#### Suggested Next Steps
- Run the standard repo gates, push this repair branch, open a PR to `dev`, and confirm both the PR dry-run and the post-merge `dev` Supabase deploy succeed end to end.

---

### session v79: Map vendored CUBID packages for Supabase Deno bundling
- timestamp: 2026-04-26T15:49:30-04:00
- agent: **Codex (GPT-5)**
- branch: **codex/supabase-cubid-deno-repair**
- head: pending final commit

#### Objective
Fix the remaining `dev` Supabase deploy failure after payment and onboarding functions were already deploying successfully by making the CUBID Edge Function bundle path Deno-compatible.

#### Actions Taken
- Removed the unused server-side `@cubid/web2` coupling from `lib/cubid/server-client.ts` so shared Edge Function code only depends on the API package.
- Added explicit Deno import mappings in `supabase/functions/deno.json` for:
  - `@cubid/api`
  - `@supabase/supabase-js`
- Updated the Edge Function and Supabase deployment docs to capture the rule that vendored bare package specifiers must be mapped explicitly for the Supabase Deno bundler.

#### Tests and Validation Notes
- `deno info --config supabase/functions/deno.json supabase/functions/user-cubid-resolve-email/index.ts` resolved cleanly with no missing import-map dependencies.
- `deno info --config supabase/functions/deno.json supabase/functions/user-cubid-sync-profile/index.ts` resolved cleanly with no missing import-map dependencies.
- `pnpm dlx node@22.22.1 /opt/homebrew/bin/pnpm lint` passed.
- `pnpm dlx node@22.22.1 /opt/homebrew/bin/pnpm typecheck` passed.
- `pnpm dlx node@22.22.1 /opt/homebrew/bin/pnpm test` passed.
- `pnpm dlx node@22.22.1 /opt/homebrew/bin/pnpm build` passed.
- `go run github.com/rhysd/actionlint/cmd/actionlint@latest .github/workflows/supabase-deploy.yml` passed.
- `git diff --check` passed.

#### Reflections
- The deploy repair is now down to a narrow runtime integration boundary with the vendored CUBID packages rather than a broader workflow or schema problem.
- Longer term, publishing Deno-friendly `@cubid/api` and `@cubid/web2` packages from the Cubid repo would remove the need for local import-map wiring in downstream Edge runtimes.

#### Suggested Next Steps
- Push this branch, open a PR to `dev`, confirm the Supabase dry-run stays green, merge, and watch the push-triggered `dev` Supabase deploy until the CUBID functions deploy cleanly too.

---

### session v78: Broaden Supabase deploy workflow path triggers
- timestamp: 2026-04-26T05:25:30-04:00
- agent: **Codex (GPT-5)**
- branch: **codex/supabase-function-bundling-repair**
- head: pending final commit

#### Objective
Ensure the Supabase deploy workflow actually runs when shared Edge Function dependencies change outside `supabase/functions/`, `supabase/migrations/`, or the workflow file itself.

#### Actions Taken
- Expanded the `Supabase Deploy` workflow `pull_request` and `push` path filters to include:
  - `lib/**`
  - `types/**`
  - `package.json`
  - `pnpm-lock.yaml`
  - `vendor/cubid/**`
- Kept the existing Supabase-specific path filters intact so direct schema/function changes still route the same way.

#### Tests and Validation Notes
- `go run github.com/rhysd/actionlint/cmd/actionlint@latest .github/workflows/supabase-deploy.yml` passed.
- `ruby -e 'require "yaml"; YAML.load_file(".github/workflows/supabase-deploy.yml"); puts "workflow yaml parsed"'` passed.

#### Reflections
- Shared command logic living under `lib/` is now part of the effective Edge Function deployment surface, so the workflow trigger contract needed to reflect the real architecture instead of just the filesystem location of entrypoints.

#### Suggested Next Steps
- Push this trigger-scope follow-up to PR #30 so the Supabase dry-run reruns on the PR, then merge and watch the real `dev` deploy again.

---

### session v77: Remove Next-only server markers from Edge Function shared modules
- timestamp: 2026-04-26T05:20:30-04:00
- agent: **Codex (GPT-5)**
- branch: **codex/supabase-function-bundling-repair**
- head: pending final commit

#### Objective
Fix the latest `dev` deploy failure after PR #29 by removing Next-only `server-only` imports from modules that are shared with Supabase Edge Functions.

#### Actions Taken
- Removed `import "server-only"` from the shared onboarding and CUBID command modules that the Edge Function deploy step bundles.
- Removed the same marker from the shared CUBID server client helper used by the sync command.
- Updated the Edge Function engineering doc to state that Next-only runtime markers must stay on Next-only wrappers rather than shared modules imported by Edge Functions.

#### Tests and Validation Notes
- A reachability script confirmed there are no remaining `server-only` markers in the 46 TypeScript files reachable from `supabase/functions/`.
- `pnpm dlx node@22.22.1 /opt/homebrew/bin/pnpm lint` passed.
- `pnpm dlx node@22.22.1 /opt/homebrew/bin/pnpm typecheck` passed.
- `pnpm dlx node@22.22.1 /opt/homebrew/bin/pnpm test` passed.
- `pnpm dlx node@22.22.1 /opt/homebrew/bin/pnpm build` passed.

#### Reflections
- The remote deploy path is now failing on genuinely incremental runtime-compatibility issues rather than broad workflow design problems, which means the repair work is converging.

#### Suggested Next Steps
- Push this follow-up to the same repair branch, confirm the PR checks stay green, and rerun the push-triggered `dev` Supabase deploy until every tracked function deploys successfully.

---

### session v76: Fix pnpm bootstrap in Supabase deploy workflow
- timestamp: 2026-04-26T05:16:30-04:00
- agent: **Codex (GPT-5)**
- branch: **codex/supabase-function-bundling-repair**
- head: pending final commit

#### Objective
Repair the follow-up PR dry-run failure from Session v75 so the Supabase deploy workflow can bootstrap Node tooling before the database dry-run executes.

#### Actions Taken
- Removed `cache: pnpm` from the `actions/setup-node@v4` step in `supabase-deploy.yml`.
- Kept `corepack enable` as the pnpm bootstrap path so deploy runs can still execute `pnpm install --frozen-lockfile` before Edge Function bundling.

#### Tests and Validation Notes
- `go run github.com/rhysd/actionlint/cmd/actionlint@latest .github/workflows/supabase-deploy.yml` passed.
- `ruby -e 'require "yaml"; YAML.load_file(".github/workflows/supabase-deploy.yml"); puts "workflow yaml parsed"'` passed.

#### Reflections
- The Deno bundle repair was sound; the PR dry-run caught a separate workflow bootstrap assumption before it could waste another full deploy cycle.

#### Suggested Next Steps
- Push this workflow-only follow-up to PR #29, confirm the PR dry-run turns green, then merge and watch the real `dev` deploy run again.

---

### session v75: Repair Supabase Edge Function bundling for remote deploys
- timestamp: 2026-04-26T05:11:00-04:00
- agent: **Codex (GPT-5)**
- branch: **codex/supabase-function-bundling-repair**
- head: pending final commit

#### Objective
Fix the remaining `Supabase Deploy` failure on `dev` after the entrypoint repair by making the shared Edge Function import graph and CI bundle environment Deno-compatible.

#### Actions Taken
- Rewrote the shared Edge Function dependency graph to use explicit `.ts` and `.json` local import specifiers anywhere the Supabase Deno bundle step reaches into `lib/`.
- Replaced `@/` alias usage in the CUBID snapshot/sync modules that are imported by Edge Functions with explicit relative imports.
- Added `allowImportingTsExtensions` to the root TypeScript config so the app-side typecheck and build continue to accept the Deno-safe import specifiers.
- Added `supabase/functions/deno.json` with `nodeModulesDir` enabled so vendored package dependencies remain available during Supabase function bundling.
- Updated the Supabase deploy workflow to install repo dependencies before deploying Edge Functions.
- Updated the Edge Function and Supabase deployment engineering docs to capture the Deno import rules and bundle dependency install requirement.

#### Tests and Validation Notes
- `pnpm dlx node@22.22.1 /opt/homebrew/bin/pnpm lint` passed.
- `pnpm dlx node@22.22.1 /opt/homebrew/bin/pnpm typecheck` passed.
- `pnpm dlx node@22.22.1 /opt/homebrew/bin/pnpm test` passed.
- `pnpm dlx node@22.22.1 /opt/homebrew/bin/pnpm build` passed.
- `go run github.com/rhysd/actionlint/cmd/actionlint@latest .github/workflows/supabase-deploy.yml` passed.
- `ruby -e 'require "yaml"; YAML.load_file(".github/workflows/supabase-deploy.yml"); puts "workflow yaml parsed"'` passed.
- `git diff --check` passed.
- A reachability script confirmed every TypeScript file in the Supabase function dependency graph now uses explicit `.ts` or `.json` local specifiers.
- Local `supabase functions serve` smoke was blocked because the currently running local Supabase containers are under the older `everfund` project id while `supabase/config.toml` now targets `fundloop`, so the CLI reported the local stack as not running for this worktree.

#### Reflections
- The real deploy path is now healthy for migrations, directory enumeration, and entrypoint naming; the last unstable layer was the Deno bundler reaching app-shared modules that still assumed Node-style resolution and preinstalled dependencies.

#### Suggested Next Steps
- Push this branch, open a PR to `dev`, confirm the PR-scoped dry-run stays green, merge, and watch the follow-up push-triggered `Supabase Deploy` run until Edge Function deployment succeeds end to end.

---

### session v74: Align Supabase function entrypoints with CLI deploy expectations
- timestamp: 2026-04-26T04:57:45-04:00
- agent: **Codex (GPT-5)**
- branch: **codex/supabase-function-entrypoints**
- head: pending final commit

#### Objective
Fix the remaining `Supabase Deploy` failure on `dev` by aligning the function tree with the Supabase CLI's expected entrypoint naming.

#### Actions Taken
- Renamed every tracked Supabase function entrypoint from `index.js` to `index.ts`.
- Renamed the shared Edge Function helpers under `supabase/functions/_shared/` from `.js` to `.ts` and updated all relative imports.
- Excluded `supabase/functions/` from the root Next.js TypeScript program so Deno-targeted Edge Function sources do not get typechecked as part of the app runtime.
- Updated the Edge Functions engineering doc to capture the `index.ts` convention and the explicit per-function deploy behavior.

#### Tests and Validation Notes
- `pnpm dlx node@22.22.1 /opt/homebrew/bin/pnpm lint` passed.
- `pnpm dlx node@22.22.1 /opt/homebrew/bin/pnpm typecheck` passed after excluding the Deno-targeted function tree from the app TypeScript program.
- `git diff --check` passed.
- `find supabase/functions -mindepth 1 -maxdepth 2 -type f | sort` confirmed every tracked deployable function now uses an `index.ts` entrypoint and the shared helpers live under `.ts` filenames.

#### Reflections
- The deploy workflow fixes were correct; the remaining issue was the function source layout itself, not the CI routing or migration path.

#### Suggested Next Steps
- Validate the renamed function tree locally and statically, PR it into `dev`, and confirm the next push-triggered `Supabase Deploy` run succeeds end-to-end.

---

### session v73: Repair Supabase function deploy enumeration
- timestamp: 2026-04-26T04:48:22-04:00
- agent: **Codex (GPT-5)**
- branch: **codex/supabase-function-deploy-repair**
- head: pending final commit

#### Objective
Fix the push-triggered Supabase deploy workflow after the migration repair landed but Edge Function deployment still failed on `dev`.

#### Actions Taken
- Changed the workflow's Edge Function deploy step to enumerate every directory under `supabase/functions/` except `_shared` and deploy each function explicitly.
- Updated the Supabase deployment engineering doc to match the per-function deploy behavior required by the current Supabase CLI.

#### Tests and Validation Notes
- `ruby -e 'require "yaml"; YAML.load_file(".github/workflows/supabase-deploy.yml"); puts "workflow yaml parsed"'` passed.
- `go run github.com/rhysd/actionlint/cmd/actionlint@latest .github/workflows/supabase-deploy.yml` passed.
- `git diff --check` passed.
- `find supabase/functions -mindepth 1 -maxdepth 1 -type d ! -name '_shared' -exec basename {} \; | sort` returned the expected deployable function list.

#### Reflections
- The migration repair was correct; the remaining failure was a CLI-behavior mismatch in the workflow, not another remote schema problem.

#### Suggested Next Steps
- Validate the updated workflow statically, PR it into `dev`, and confirm the follow-up push-triggered `Supabase Deploy` run completes both migrations and function deploys.

---

### session v72: Repair Supabase deploy path for remote sequence drift
- timestamp: 2026-04-26T04:40:39-04:00
- agent: **Codex (GPT-5)**
- branch: **codex/supabase-deploy-repair**
- head: pending final commit

#### Objective
Repair the new remote Supabase deploy workflow so pending migrations apply cleanly against the existing dev remote and the workflow runs fully non-interactively.

#### Actions Taken
- Added `--yes` to Supabase workflow `db push` calls for both PR dry-runs and push/manual deploys.
- Reworked the pending `crypto_contract`, `zkas_access`, and `zkas_published_result` reference-row migrations to reserve deterministic IDs, update existing rows safely, and reset identity sequences explicitly instead of relying on the remote's current identity sequence.
- Updated the Supabase deployment engineering doc to reflect the non-interactive `db push` contract.

#### Tests and Validation Notes
- `ruby -e 'require "yaml"; YAML.load_file(".github/workflows/supabase-deploy.yml"); puts "workflow yaml parsed"'` passed.
- `go run github.com/rhysd/actionlint/cmd/actionlint@latest .github/workflows/supabase-deploy.yml` passed.
- `git diff --check` passed.
- `supabase db reset --local --yes` applied every migration through `20260417193000_onchain_reconciliation_atomic_update.sql` and seeded `supabase/seed.sql`; the post-reset container restart briefly tripped a local storage readiness error before recovering.
- `supabase status` returned healthy local URLs after the reset finished settling.

#### Reflections
- `ref_payment_methods` was only the first visible failure; patching the other pending reference-row inserts on the same branch avoids a second and third remote deploy failure immediately after the first repair lands.
- The later rekey migrations already established the right deterministic-ID pattern, so pulling that logic forward was the least risky repair.

#### Suggested Next Steps
- Push this branch, open a PR to `dev`, and confirm the PR-scoped `Supabase dry-run` stays green against the dev target.
- Merge once the dry-run and validation checks pass, then watch the follow-up push-triggered `Supabase Deploy` run on `dev` until database migrations and function deploy both succeed.

---

### session v71: Address Codex review feedback on PR 25
- timestamp: 2026-04-21T02:05:24-04:00
- agent: **Codex (GPT-5)**
- branch: **codex/session-19-payment-edge-functions**
- head: pending final commit

#### Objective
Address Codex review feedback on PR #25 about Edge Function runtime deployment manifest selection.

#### Actions Taken
- Updated the payment operation Edge Function shared runtime to import and use the tracked local, preview, and production wallet deployment manifests.
- Preserved the local manifest JSON override behavior for local development while avoiding the disabled base fallback for preview and production.

#### Tests and Validation Notes
- `pnpm dlx node@22.22.1 /opt/homebrew/bin/pnpm lint` passed.
- `pnpm dlx node@22.22.1 /opt/homebrew/bin/pnpm test -- project-payment-operations-command` passed.
- `git diff --check` passed.
- `pnpm dlx node@22.22.1 /opt/homebrew/bin/pnpm typecheck` passed.
- `pnpm dlx node@22.22.1 /opt/homebrew/bin/pnpm build` passed.

#### Reflections
- Sharing the tracked manifests with the Edge Function keeps app runtime and function runtime availability decisions aligned as deployments are enabled.

#### Suggested Next Steps
- Push this Codex review fix, reply to the thread with the commit reference, and resolve the review thread.
- Re-check CI and review state after the push.

---

### session v70: Address Copilot review feedback on PR 25
- timestamp: 2026-04-21T01:49:08-04:00
- agent: **Codex (GPT-5)**
- branch: **codex/session-19-payment-edge-functions**
- head: pending final commit

#### Objective
Address Copilot review comments on PR #25 for payment operation reliability and Supabase deploy reproducibility.

#### Actions Taken
- Returned `reference_data_unavailable` for participant admin lookup failures instead of falling through to permission denial.
- Returned `reference_data_unavailable` for receipt-recording reference query failures instead of surfacing misleading payment, route, or status errors.
- Added a compensating update that marks an inserted onchain submission `failed` if the subsequent payment update fails.
- Guarded Edge Function runtime availability checks against unsupported network keys before reading Deno environment variables.
- Pinned the Supabase CLI version used by the deploy workflow and documented deliberate CLI updates.
- Added regression coverage for participant lookup errors, receipt reference lookup errors, and failed-payment-update compensation.

#### Tests and Validation Notes
- `pnpm dlx node@22.22.1 /opt/homebrew/bin/pnpm test -- project-payment-operations-command` passed.
- `pnpm dlx node@22.22.1 /opt/homebrew/bin/pnpm lint` passed.
- `ruby -e 'require "yaml"; YAML.load_file(".github/workflows/supabase-deploy.yml"); puts "workflow yaml parsed"'` passed.
- `go run github.com/rhysd/actionlint/cmd/actionlint@latest .github/workflows/supabase-deploy.yml` passed.
- `git diff --check` passed.
- `pnpm dlx node@22.22.1 /opt/homebrew/bin/pnpm typecheck` passed.
- `pnpm dlx node@22.22.1 /opt/homebrew/bin/pnpm build` passed.

#### Reflections
- The receipt-recording path still deserves a future RPC for full atomicity, but marking the inserted submission failed prevents the unresolved unique index from blocking retries if the second write fails.
- Pinning the Supabase CLI keeps deploy behavior reproducible while preserving a clear update path during tooling triage.

#### Suggested Next Steps
- Push this review-fix commit, reply to each Copilot thread with the commit reference, and resolve the threads.
- Re-run CI on PR #25 before requesting Codex review.

---

### session v69: Align Supabase deploy workflow with GitHub environment names
- timestamp: 2026-04-21T01:29:27-04:00
- agent: **Codex (GPT-5)**
- branch: **codex/session-19-payment-edge-functions**
- head: pending final commit

#### Objective
Update the new Supabase deploy workflow to use the repository's existing GitHub environment names.

#### Actions Taken
- Changed the Supabase deploy workflow environment expression from `production`/`supabase-dev` to `Production`/`Preview`.
- Updated the Supabase deployment and Edge Function engineering docs to reference the actual environment names.

#### Tests and Validation Notes
- `ruby -e 'require "yaml"; YAML.load_file(".github/workflows/supabase-deploy.yml"); puts "workflow yaml parsed"'` passed.
- `go run github.com/rhysd/actionlint/cmd/actionlint@latest .github/workflows/supabase-deploy.yml` passed.
- `git diff --check` passed.

#### Reflections
- Matching the existing GitHub environment names avoids accidental environment auto-creation and makes the approval gate immediately usable.

#### Suggested Next Steps
- Push the branch and verify the first PR run attaches to the `Preview` environment and the first main deploy waits on `Production` approval.

---

### session v68: Add Supabase remote deployment workflow
- timestamp: 2026-04-21T00:51:17-04:00
- agent: **Codex (GPT-5)**
- branch: **codex/session-19-payment-edge-functions**
- head: pending final commit

#### Objective
Add a dedicated GitHub Actions workflow for safe remote Supabase migration dry-runs and branch-routed deployments of migrations plus Edge Functions.

#### Actions Taken
- Added `.github/workflows/supabase-deploy.yml` with PR dry-runs for `dev` and `main`, push deployments for `dev` and `main`, manual dry-run/deploy dispatch, and a `production` environment gate for main deploys.
- Routed dev and main targets through separate session-pooler URL secrets and parsed the Supabase project ref from the standard `postgres.<project-ref>` pooler username.
- Kept remote deploy behavior scoped to `supabase db push` and `supabase functions deploy`, with no seed, reset, or function-secret management.
- Added `docs/engineering/supabase-deployments.md` and linked it from the engineering index and Edge Functions docs.

#### Tests and Validation Notes
- `ruby -e 'require "yaml"; YAML.load_file(".github/workflows/supabase-deploy.yml"); puts "workflow yaml parsed"'` passed.
- `go run github.com/rhysd/actionlint/cmd/actionlint@latest .github/workflows/supabase-deploy.yml` passed.
- `git diff --check` passed.
- Secret-name and Supabase path-filter grep checks matched the documented workflow contract.
- `pnpm dlx node@22.22.1 /opt/homebrew/bin/pnpm lint` passed.
- `pnpm dlx node@22.22.1 /opt/homebrew/bin/pnpm test` passed.
- `pnpm dlx node@22.22.1 /opt/homebrew/bin/pnpm typecheck` passed.

#### Reflections
- Avoiding secret-valued step outputs keeps the workflow friendlier to GitHub masking behavior while still letting the project ref flow to function deployment.
- Keeping PRs dry-run only gives review branches signal without mutating shared Supabase databases.

#### Suggested Next Steps
- Add the required GitHub secrets and configure the `production` environment approval gate before relying on main deploys.
- After this branch lands, open a Supabase-only PR to confirm dry-run behavior against the dev target.

---

### session v67: Triage safe dependency updates after Session 19
- timestamp: 2026-04-20T17:30:23-04:00
- agent: **Codex (GPT-5)**
- branch: **codex/session-19-payment-edge-functions**
- head: c952828

#### Objective
Run the dedicated safe dependency triage pass requested with Session 19, updating latest stable patch and minor package versions while holding major TypeScript and ESLint upgrades.

#### Actions Taken
- Updated app/runtime dependencies including Next, React, Supabase SSR/client packages, TanStack Query, wagmi, viem, lucide-react, react-hook-form, Recharts, and related UI/runtime packages.
- Updated dev/runtime tooling within current major lines, including Tailwind/PostCSS, Vite, Vitest, jsdom, eslint-config-next, and Node 22 typings.
- Preserved the vendored local CUBID tarball dependencies and intentionally deferred TypeScript 6 and ESLint 10.
- Updated `pnpm-lock.yaml` with the resolved package graph.
- Backfilled the Session 19 todo/session-log head now that the implementation commit is known.

#### Tests and Validation Notes
- `pnpm outdated --format json` now reports only intentionally held major lines: `@types/node` latest major 25, ESLint 10, and TypeScript 6.
- `pnpm dlx node@22.22.1 /opt/homebrew/bin/pnpm lint` passed.
- `pnpm dlx node@22.22.1 /opt/homebrew/bin/pnpm test` passed.
- `pnpm dlx node@22.22.1 /opt/homebrew/bin/pnpm typecheck` passed.
- `pnpm dlx node@22.22.1 /opt/homebrew/bin/pnpm build` passed.

#### Reflections
- Running validation under Node 22 was the right source of truth because the ambient shell is currently Node 25 and intentionally outside the repo engine range.
- Keeping TypeScript and ESLint majors out of this pass preserved the dependency goal without turning Session 19 into a toolchain migration.

#### Suggested Next Steps
- Yeet this branch into `dev` and let CI verify the updated dependency graph plus the new Edge Function import paths.
- Plan a future toolchain-only pass if the project wants to evaluate TypeScript 6 or ESLint 10.

---

### session v66: Migrate founder payment operation writes to Edge Functions
- timestamp: 2026-04-20T17:27:41-04:00
- agent: **Codex (GPT-5)**
- branch: **codex/session-19-payment-edge-functions**
- head: 0e9890c

#### Objective
Complete Session 19 by moving founder payment-route write operations and onchain receipt recording behind typed Supabase Edge Function commands while keeping the current payment UI and read paths stable.

#### Actions Taken
- Added typed contracts and browser/server adapters for project crypto route create, update, move, enable/disable, and onchain receipt recording commands.
- Extracted the founder payment operation domain logic into a shared command module for project-admin authorization, route validation, default promotion, deployment availability checks, receipt validation, and receipt-recording observability.
- Added one Supabase Edge Function per new command using the existing bearer-token authentication and service-role-after-auth pattern.
- Rewired the route manager and crypto payment dialog to call browser Edge Function adapters directly, leaving server actions as compatibility wrappers.
- Updated engineering docs and route inventory to record the Session 19 backend boundary change.

#### Tests and Validation Notes
- `pnpm test -- project-payment-operations project-payment-observability-actions project-crypto-payment-dialog project-crypto-routes` passed with the ambient Node 25 shell.
- `pnpm lint` passed with the ambient Node 25 shell.
- `pnpm test` passed with the ambient Node 25 shell.
- `pnpm typecheck` passed with the ambient Node 25 shell.
- `pnpm build` passed with the ambient Node 25 shell.

#### Reflections
- Dependency-injecting deployment availability kept the shared command module usable from both Next server code and Deno Edge Functions without importing the full wallet runtime stack into Deno.
- Keeping reads in place made this migration reviewable while still removing the highest-risk remaining client-to-server-action writes from the founder payment flow.

#### Suggested Next Steps
- Run the safe dependency triage pass as a separate commit on this branch.
- After dependency validation, yeet the branch to `dev` and let CI exercise the Edge Function import paths.

---

### session v65: Address PR 24 founder workspace review comments
- timestamp: 2026-04-20T16:50:06-04:00
- agent: **Codex (GPT-5)**
- branch: **codex/session-18-founder-workspace**
- head: pending final commit

#### Objective
Address automated review feedback on PR #24 from Copilot and Codex for the founder workspace read model and organization redirect route typing.

#### Actions Taken
- Changed the founder workspace builder to group read rows by `project_id` once before mapping managed projects, avoiding repeated per-project scans across payments, methods, participants, datasets, run summaries, and monthly stats.
- Changed aggregate `latestPublishedMonth` to choose the maximum non-null `YYYY-MM` month across all managed projects instead of the first project with a report.
- Added a regression test proving aggregate reporting selects the latest month across projects.
- Updated the organization redirect route props to include the dynamic `[id]` param even though the handler redirects without using it.

#### Tests and Validation Notes
- `pnpm test -- founder-workspace` passed.
- `pnpm lint` passed.
- `pnpm typecheck` passed.
- `pnpm dlx node@22.22.1 /opt/homebrew/bin/pnpm test -- founder-workspace` passed.
- `pnpm dlx node@22.22.1 /opt/homebrew/bin/pnpm lint` passed.
- `pnpm dlx node@22.22.1 /opt/homebrew/bin/pnpm typecheck` passed.

#### Reflections
- The reviewer suggestions were practical and tightened both correctness and scaling characteristics without changing the UI contract.

#### Suggested Next Steps
- Push this review-fix commit and resolve the corresponding PR review threads.
- Re-check CI after the push before requesting/awaiting final approval.

---

### session v64: Add authenticated local founder seed and smoke Session 18
- timestamp: 2026-04-20T16:28:45-04:00
- agent: **Codex (GPT-5)**
- branch: **codex/session-18-founder-workspace**
- head: pending final commit

#### Objective
Add a deterministic authenticated founder fixture to the local seed and rerun the Session 18 founder workspace smoke against a real signed-in founder session.

#### Actions Taken
- Added a local-only Supabase Auth fixture for `maya@fundloop.example.com` with password `FundLoopFounder123!`, matched to the deterministic public user `00000000-0000-4000-8000-000000000101`.
- Documented the authenticated founder smoke fixture in `docs/engineering/local-seed.md`.
- Extended the local seed test to assert the Auth user and identity fixture stay present.
- Reset the local FundLoop Supabase database and verified the seeded founder can sign in through `/api/internal/e2e/login`.
- Used Playwright CLI to authenticate as Maya and smoke `/en/founder`, `/en/founder/projects`, `/en/founder/projects/civic-mesh`, `/en/organizations/test`, and the founder project home dark-mode toggle.

#### Tests and Validation Notes
- `supabase start --exclude logflare --ignore-health-check` succeeded after the analytics/logflare container failed the default health check.
- `supabase db reset` passed after adjusting the Auth seed to avoid generated columns and null token-string fields.
- `pnpm lint` passed.
- `pnpm test -- local-public-seed` passed with the ambient Node 25 shell.
- `pnpm dlx node@22.22.1 /opt/homebrew/bin/pnpm test -- local-public-seed` passed.
- Browser smoke verified authenticated founder pages render with zero console errors and the expected founder nav, project data, project-home links, organization redirect, and dark theme class.

#### Reflections
- The founder workspace is now smoke-testable locally without relying on an ad hoc browser session.
- Supabase Auth seed rows are pickier than the column nullability suggests; generated `confirmed_at` and token columns need local-compatible handling.

#### Suggested Next Steps
- Yeet the Session 18 branch into `dev` for review.
- Consider adding an explicit Playwright spec for the seeded founder workspace fixture once the PR is open.

---

### session v63: Build the founder and project workspace home
- timestamp: 2026-04-20T13:53:17-04:00
- agent: **Codex (GPT-5)**
- branch: **codex/session-18-founder-workspace**
- head: 67243d2

#### Objective
Implement Session 18 by turning the founder workspace entry points into operational homes while keeping existing contribution and zkAS operation routes in place.

#### Actions Taken
- Added a server-only founder workspace read model that summarizes managed projects, setup readiness, payment status, attribution/reporting state, growth stats, team counts, and non-fatal warnings using `getNavigationContext().managedProjects` as the access boundary.
- Rebuilt `/[locale]/founder` and `/[locale]/founder/projects`, and added `/[locale]/founder/projects/[slug]` as the first canonical per-project founder home.
- Retired the mock organization detail page by redirecting `/[locale]/organizations/[id]` to `/[locale]/founder/projects`.
- Localized the new founder workspace copy in English, French, and Spanish.
- Updated engineering navigation and route-inventory docs, plus Session 18 backlog metadata.

#### Tests and Validation Notes
- `pnpm test -- founder-workspace` passed with the ambient Node 25 shell; it also executed the full Vitest suite.
- `pnpm lint` passed with the ambient Node 25 shell.
- `pnpm test` passed with the ambient Node 25 shell.
- `pnpm typecheck` passed with the ambient Node 25 shell.
- `pnpm build` passed with the ambient Node 25 shell.
- `pnpm dlx node@22.22.1 /opt/homebrew/bin/pnpm lint` passed.
- `pnpm dlx node@22.22.1 /opt/homebrew/bin/pnpm test` passed.
- `pnpm dlx node@22.22.1 /opt/homebrew/bin/pnpm typecheck` passed.
- `pnpm dlx node@22.22.1 /opt/homebrew/bin/pnpm build` passed.
- Manual unauthenticated smoke against local Next verified `/en/founder` and `/en/founder/projects` redirect to `/en/join`, and `/en/organizations/test` redirects to `/en/founder/projects`.
- Authenticated founder light/dark smoke was not completed because no seeded authenticated founder browser session was available in this turn.

#### Reflections
- The founder side now has the same operational center of gravity that Session 17 created for regular users, without prematurely moving the payment or zkAS routes.
- The read-model-first approach kept the route pages straightforward and gave us useful unit coverage around the most important access and summary behavior.

#### Suggested Next Steps
- Yeet this branch into `dev` for review.
- Session 19 can now start migrating project payment and route write paths while linking from the founder workspace remains stable.

---

### session v62: Address PR 23 Codex workspace read-model review comments
- timestamp: 2026-04-20T04:07:11-04:00
- agent: **Codex (GPT-5)**
- branch: **codex/session-17-user-workspace**
- head: 39da952

#### Objective
Address the chatgpt-codex-connector review comments on PR #23 around workspace discovery sparsity and participation counters.

#### Actions Taken
- Changed the workspace discovery query so joined project IDs are excluded before the recommendation limit is applied.
- Changed participation metrics to count only participant rows that hydrate to non-deleted project rows.
- Added an explicit unavailable-project-details flag so the workspace can avoid claiming there are no joined projects when project-detail reads fail.
- Added read-model tests for soft-deleted/unhydrated project exclusion and temporary joined-project detail failures.

#### Tests and Validation Notes
- `pnpm dlx node@22.22.1 /opt/homebrew/bin/pnpm exec vitest run tests/user-workspace.test.ts` passed.
- `pnpm dlx node@22.22.1 /opt/homebrew/bin/pnpm lint` passed.
- `pnpm dlx node@22.22.1 /opt/homebrew/bin/pnpm typecheck` passed.

#### Reflections
- The workspace home should be optimistic but not misleading: counters should reflect visible, non-deleted projects, while read failures need a distinct temporary state.

#### Suggested Next Steps
- Push the Codex fixes, reply to the Codex threads with the commit reference, and resolve those threads.

### session v61: Address PR 23 Copilot workspace review comments
- timestamp: 2026-04-20T03:54:49-04:00
- agent: **Codex (GPT-5)**
- branch: **codex/session-17-user-workspace**
- head: 6257ba7

#### Objective
Address the Copilot review comments on PR #23 before requesting the next Codex review pass.

#### Actions Taken
- Changed the workspace CUBID Passport link to use `navigationContext.cubidPassportOrigin` with the production Passport origin as a fallback.
- Made workspace result publish-date formatting timezone-stable by formatting dates in UTC.
- Reworked the participation empty-state branch so users with joined projects do not see "no joined projects" when project detail hydration is temporarily unavailable.
- Added localized copy for the temporary participation-detail-unavailable state in English, French, and Spanish.

#### Tests and Validation Notes
- `pnpm dlx node@22.22.1 /opt/homebrew/bin/pnpm lint` passed.
- `pnpm dlx node@22.22.1 /opt/homebrew/bin/pnpm typecheck` passed.
- `pnpm dlx node@22.22.1 /opt/homebrew/bin/pnpm exec vitest run tests/user-workspace.test.ts` passed.

#### Reflections
- These fixes keep the workspace aligned with environment-specific CUBID configuration and avoid misleading user states when supporting reads partially fail.

#### Suggested Next Steps
- Push the Copilot fixes, reply to the three Copilot threads with the commit reference, and resolve those threads.

### session v60: Build the regular-user workspace home
- timestamp: 2026-04-20T03:24:45-04:00
- agent: **Codex (GPT-5)**
- branch: **codex/session-17-user-workspace**
- head: 13c9fa3

#### Objective
Complete Session 17 by turning `/workspace` into a useful signed-in user home that summarizes identity readiness, profile completion, participation, discovery, and current published results without pulling full payout/reporting routes forward.

#### Actions Taken
- Added a server-only user workspace read model under `lib/workspace/` that gathers participation rows, joined projects, public project recommendations, published zkAS results, run labels, and non-fatal warning state.
- Rebuilt `/[locale]/workspace` around clear workspace sections for identity readiness, profile completion, participation footprint, discovery, current results visibility, and conditional founder shortcuts.
- Localized the new workspace copy in English, French, and Spanish.
- Added focused coverage for the workspace read model and updated engineering docs to record `/workspace` as the real Session 17 user home while `/settings/zkas` remains the interim detailed result history.
- Updated Session 17 status metadata in `agent-context/todo.md`.

#### Tests and Validation Notes
- `pnpm exec vitest run tests/user-workspace.test.ts` passed.
- `pnpm lint`, `pnpm test`, `pnpm typecheck`, and `pnpm build` passed.
- Re-ran the full gate set through `pnpm dlx node@22.22.1 /opt/homebrew/bin/pnpm ...`; lint, test, typecheck, and build all passed in the repo's expected Node 22 runtime.
- Smoke-checked `GET /en/workspace` against `next start` on port `3107`; unauthenticated access returned a `307` redirect to `/en/join`.
- Did not complete an authenticated browser smoke in this session; the signed-in page behavior is covered by build, model tests, and existing app-shell redirect behavior.

#### Reflections
- Keeping detailed results under `/settings/zkas` preserves the current truthful endpoint while giving users a much better workspace summary now.
- The read model intentionally degrades partial Supabase read failures into warnings and empty states because the signed-in home should remain useful even if one supporting table is temporarily unavailable.

#### Suggested Next Steps
- Start Session 18 to give founders and project members the same level of workspace orientation around managed projects, contribution operations, and project growth.

### session v59: Reconcile completed Edge Function backlog metadata
- timestamp: 2026-04-20T03:19:55-04:00
- agent: **Codex (GPT-5)**
- branch: **codex/session-17-user-workspace**
- head: 0fb3eff1635824c53009b1dc7e23c05de5c05157

#### Objective
Correct stale backlog metadata for Sessions 04 and 05 so future agents do not re-run already-completed Edge Function contract and project payment draft migration work.

#### Actions Taken
- Marked Session 04 complete in `agent-context/todo.md` using the existing `session v38` timestamp, branch, head, and reference.
- Marked Session 05 complete in `agent-context/todo.md` using the existing `session v39` timestamp, branch, head, and reference.
- Kept this pass limited to backlog hygiene; no product code or Edge Function implementation changed.

#### Tests and Validation Notes
- Not run; documentation metadata only.

#### Reflections
- The Edge Function contract and first payment draft command are already present in the repo and documented in `docs/engineering/edge-functions.md`; leaving the backlog as `Not started` would invite duplicate implementation work.

#### Suggested Next Steps
- Start Session 17 on this branch by rebuilding `/workspace` into the signed-in user workspace home.

### session v58: Address PR 22 reconciliation RPC review comments
- timestamp: 2026-04-19T21:54:03-04:00
- agent: **Codex (GPT-5)**
- branch: **codex/address-wallet-review-comments**
- head: 8797552

#### Objective
Address the first review pass on PR #22 after the cleanup branch was opened against `dev`, focusing on the reconciliation finalizer RPC security and session-log metadata.

#### Actions Taken
- Changed `public.finalize_onchain_payment_reconciliation(...)` from `SECURITY DEFINER` to `SECURITY INVOKER`.
- Added an explicit `auth.role() = 'service_role'` guard so broad function execution grants cannot mutate payment or submission state.
- Added function-level grants that revoke execution from broad roles and grant execution only to `service_role`.
- Matched `p_payment_status_id` to the schema `integer` type used by `payments.status_id`.
- Tightened the submission update so the target submission must be linked to the provided payment id before either terminal update proceeds.
- Replaced the stale `head: TBD` in the prior session-log entry with the actual `07d8bf8` commit hash.

#### Tests and Validation Notes
- `pnpm dlx node@22.22.1 /opt/homebrew/bin/pnpm exec vitest run tests/onchain-reconciliation-route.test.ts tests/payment-reconciliation.test.ts tests/project-payment-observability-actions.test.ts` passed
- `pnpm dlx node@22.22.1 /opt/homebrew/bin/pnpm lint` passed
- `pnpm dlx node@22.22.1 /opt/homebrew/bin/pnpm typecheck` passed

#### Reflections
- The RPC is still the right transaction boundary, but the privilege model needed to be explicit because SQL functions can outlive the assumptions of their initial app caller.

#### Suggested Next Steps
- Reply to and resolve the PR #22 Copilot/Codex review threads with this commit reference.
- Request a fresh `@Codex review` after the current review threads are closed and CI is green.

### session v57: Address PR 21 CUBID onboarding review comments
- timestamp: 2026-04-17T20:25:13-04:00
- agent: **Codex (GPT-5)**
- branch: **codex/address-wallet-review-comments**
- head: 07d8bf8

#### Objective
Address the outstanding review threads from PR #21 after the CUBID onboarding work merged, focusing on trust-boundary fixes and reproducible dependency cleanup.

#### Actions Taken
- Removed internal session-planning wording from the CUBID browser bridge unsupported-operation error.
- Verified the outdated package and lockfile comments were already addressed on the merged tip by switching `@cubid/*` dependencies to repo-vendored tarballs under `vendor/cubid/`.
- Extended the shared Edge Function command runtime to return the authenticated Supabase client alongside the service-role client.
- Changed `project-onboarding-publish` so the project publish RPC runs through the authenticated client while privileged reads/writes remain on the admin client.
- Added an optional `rpcSupabase` command input for `executeProjectOnboardingPublishCommand(...)` and covered that handoff in command tests.
- Preserved existing `users.invited_by_code` during user publish when the draft does not provide a new invite code.
- Enforced signed-in email matching in the CUBID resolve and sync Edge Functions so client-provided email overrides cannot link or sync another email identity.

#### Tests and Validation Notes
- `pnpm dlx node@22.22.1 /opt/homebrew/bin/pnpm exec vitest run tests/project-onboarding-commands.test.ts tests/user-onboarding-commands.test.ts tests/onboarding-edge-adapters.test.ts tests/cubid-resolve-email-command.test.ts tests/cubid-read-model.test.ts` passed
- `pnpm dlx node@22.22.1 /opt/homebrew/bin/pnpm lint` passed
- `pnpm dlx node@22.22.1 /opt/homebrew/bin/pnpm typecheck` passed

#### Reflections
- The project publish path now preserves the intended split: service role for privileged server-owned data access, user JWT for the RPC that depends on `auth.uid()`.
- The CUBID email guard is deliberately duplicated across resolve and sync because both are user-facing identity writes and should share the same trust boundary.

#### Suggested Next Steps
- Reply to and resolve the seven PR #21 review threads with the relevant commit references.
- Open a fresh cleanup PR from `codex/address-wallet-review-comments` into `dev` after all review threads are closed.

### session v56: Address PR 20 public discovery review comments
- timestamp: 2026-04-17T20:22:03-04:00
- agent: **Codex (GPT-5)**
- branch: **codex/address-wallet-review-comments**
- head: f4ce96d

#### Objective
Address the outstanding review threads from PR #20 after the public funnel and discovery work merged, focusing on truthful public rendering and consistent discovery semantics.

#### Actions Taken
- Removed the stray opening YAML frontmatter delimiter from `agent-context/session-log.md` so the log renders as normal Markdown.
- Updated public project participant totals to count only active users, matching project detail visibility.
- Reworked public user-directory project slug derivation to use a precomputed `projectId -> slug` map instead of filtering all projects for every user.
- Added an all-project membership guard so the users directory only includes active public users who participate in at least one public project.
- Changed the FAQ closing CTA eyebrow to a dedicated localized CTA label instead of reusing the hero eyebrow.
- Changed blog-post rendering so missing publish/create timestamps show an explicit pending publication label rather than pretending the post was published today.
- Noted that the PR #20 doc-link comments were already fixed by the preceding PR #19 cleanup commit, `7a53688`.

#### Tests and Validation Notes
- `pnpm dlx node@22.22.1 /opt/homebrew/bin/pnpm lint` passed
- `pnpm dlx node@22.22.1 /opt/homebrew/bin/pnpm typecheck` passed

#### Reflections
- The directory count and membership fixes keep list and detail pages aligned around the same public/active participation rules.
- The blog timestamp fallback was a small but important honesty fix: no fabricated dates, even for edge-case content.

#### Suggested Next Steps
- Reply to and resolve the nine PR #20 review threads with the relevant commit references.
- Continue the same review-fix-resolve loop with the outstanding PR #21 comments.

### session v55: Address PR 19 shell and planning-doc review comments
- timestamp: 2026-04-17T20:19:02-04:00
- agent: **Codex (GPT-5)**
- branch: **codex/address-wallet-review-comments**
- head: 7a53688

#### Objective
Address the outstanding review threads from PR #19 after the app-shell and locale-routing work merged, keeping the fixes focused on review cleanup rather than additional shell refactors.

#### Actions Taken
- Converted the active planning, engineering, README, and local-seed documentation links from machine-local `/Users/...` targets to repo-relative links.
- Left historical session-log command paths intact because those entries describe prior local validation commands rather than navigable documentation.
- Updated `docs/engineering/i18n.md` to record that FundLoop is on Next.js 16 and intentionally uses the active `proxy.ts` convention rather than adding deprecated `middleware.ts`.
- Hardened `lib/navigation-context.ts` so Supabase read errors are no longer silently ignored.
- Added explicit navigation-context logging for auth, profile, CUBID snapshot, participant, organization, project, interest, occupation, and location reads.
- Kept navigation fallbacks conservative when reads fail so the app shell can still render while avoiding inflated founder/admin/project access from partial data.

#### Tests and Validation Notes
- `pnpm dlx node@22.22.1 /opt/homebrew/bin/pnpm lint` passed
- `pnpm dlx node@22.22.1 /opt/homebrew/bin/pnpm typecheck` passed
- `rg -n '/Users/botmaster/src/fundloop|/Users/' README.md agent-context docs i18n proxy.ts lib/navigation-context.ts` now only reports historical session-log entries.

#### Reflections
- The middleware review note was correct for older Next.js versions but stale for this repo’s Next.js 16 baseline. Documenting the convention is safer than adding a conflicting `middleware.ts`.
- Navigation context should stay resilient, but explicit logging gives future agents and operators a trail when role-aware shell state falls back because a read failed.

#### Suggested Next Steps
- Reply to and resolve the eight PR #19 review threads with this commit reference.
- Continue the same review-fix-resolve loop with the outstanding PR #20 comments.

### session v54: Address PR 18 payment and onchain reconciliation review comments
- timestamp: 2026-04-17T20:08:59-0400
- agent: **Codex (GPT-5)**
- branch: **codex/address-wallet-review-comments**
- head: 36cfd26

#### Objective
Address the outstanding review threads from PR #18 after the wallet payments and Edge Function groundwork was approved and merged, without reopening the original stacked branch.

#### Actions Taken
- Converted the PR #18 doc links called out in review from machine-local `/Users/...` targets to repo-relative links in:
  - `docs/engineering/README.md`
  - `README.md`
- Added runtime validation and string-to-number coercion for the internal onchain reconciliation route body in `app/api/internal/payments/reconcile-onchain/route.ts`.
- Added route coverage proving valid numeric strings are accepted and invalid numeric filters return `400` before reaching reconciliation.
- Hardened `recordOnchainPaymentSubmission(...)` so the submitted onchain decimal amount must match the canonical `payments.payment_amount` before a submission is stored.
- Added the forward-only migration `supabase/migrations/20260417193000_onchain_reconciliation_atomic_update.sql` with `public.finalize_onchain_payment_reconciliation(...)`.
- Switched reconciliation finalization in `lib/onchain/payment-reconciliation.ts` to call the new RPC so terminal submission state and linked payment state update inside one database transaction.
- Updated `types/supabase.ts` with the new RPC signature.

#### Tests and Validation Notes
- `pnpm dlx node@22.22.1 /opt/homebrew/bin/pnpm exec vitest run tests/onchain-reconciliation-route.test.ts tests/payment-reconciliation.test.ts tests/project-payment-observability-actions.test.ts` passed
- `pnpm dlx node@22.22.1 /opt/homebrew/bin/pnpm typecheck` passed

#### Reflections
- The two P1 review comments were tightly coupled: canonical amount validation prevents underpayment snapshots from entering the reconciliation queue, and atomic finalization prevents payment/submission status drift once reconciliation starts.
- The RPC keeps the application-level logic readable while giving Postgres ownership of the transactional boundary.

#### Suggested Next Steps
- Reply to and resolve the five PR #18 review threads with this commit reference.
- Continue the same review-fix-resolve loop with the outstanding PR #19 comments.

### session v53: Remove duplicate bootstrap from the founder CUBID project gate
- timestamp: 2026-04-17T19:37:49-0400
- agent: **Codex (GPT-5)**
- branch: **codex/wallet-pr4-onboarding-cubid**
- head: a391c27

#### Objective
Fix the next PR #21 validate failure after the user-flow repair landed. The new CI failure was in `tests/project-signup-flow.test.tsx`, where the founder CUBID-resolution flow could lose the linked state before the test saw the updated `cubid-user-1` UI.

#### Actions Taken
- Pulled the fresh PR #21 GitHub Actions logs and isolated the failure to the project onboarding CUBID-resolution test rather than the user onboarding flow fixed in session v52.
- Confirmed `components/project-signup-flow.tsx` still used the old bootstrap pattern where the onboarding-state effect depended on `authUserId` while also mutating `authUserId`, making duplicate bootstrap requests possible during initial auth hydration.
- Added explicit auth bootstrap state plus request-id guarding in `components/project-signup-flow.tsx` so `getOnboardingState()` now runs once per auth event and stale async responses cannot overwrite the active onboarding state.
- Added synchronous screen-ref updates around resume/back/continue transitions so a late response cannot revert the active project screen.
- Tightened `tests/project-signup-flow.test.tsx` so the founder-linking regression also asserts the onboarding bootstrap only runs once before the CUBID-linked state is rendered.

#### Tests and Validation Notes
- `pnpm exec vitest run tests/project-signup-flow.test.tsx` passed
- `pnpm test` passed
- `pnpm dlx node@22.22.1 /opt/homebrew/bin/pnpm exec vitest run tests/project-signup-flow.test.tsx` passed

#### Reflections
- The second CI failure was the project-flow twin of the user-flow bug from session v52. Fixing them at the same bootstrap boundary is cleaner than trying to special-case each test assertion.
- Matching the affected test against Node 22 was worthwhile here because the bug only surfaced reliably in GitHub Actions before the guard landed.

#### Suggested Next Steps
- Push the follow-up commit so PR #21 can rerun validate on the merge commit with both onboarding bootstrap fixes present.
- If another onboarding CI failure appears, audit the remaining flow components for effects that both depend on and mutate auth-derived state.

### session v52: Remove duplicate onboarding bootstrap from the user resume flow
- timestamp: 2026-04-17T19:30:00-0400
- agent: **Codex (GPT-5)**
- branch: **codex/wallet-pr4-onboarding-cubid**
- head: d185055

#### Objective
Fix the remaining PR #21 validate failure by making the user onboarding resume flow deterministic in CI, where `tests/user-signup-flow.test.tsx` could lose the transition from the resume screen to review/publish during initial authenticated hydration.

#### Actions Taken
- Traced the failing PR #21 validate job to `tests/user-signup-flow.test.tsx`, specifically the resume-to-review publish path in `components/user-signup-flow.tsx`.
- Identified that the component was re-running `getOnboardingState()` during initial hydration because the bootstrap effect depended on `authUserId`, which the bootstrap itself updates.
- Added explicit auth bootstrap state in `components/user-signup-flow.tsx` so onboarding state loads once per auth event instead of recursively re-triggering during mount hydration.
- Added request-id guarding plus a synchronous `currentScreenRef` write path so late async onboarding responses cannot overwrite a user-initiated screen transition back to `resume` or `welcome`.
- Replaced the flaky regression case in `tests/user-signup-flow.test.tsx` with a deterministic assertion that initial authenticated hydration only bootstraps once and still resumes into the review/publish screen.

#### Tests and Validation Notes
- `pnpm exec vitest run tests/user-signup-flow.test.tsx` passed
- `pnpm test` passed
- Local validation ran under Node 25 because that is the host shell default on this machine; the repo still declares Node 22 as the supported baseline for CI.

#### Reflections
- The CI failure was a state-bootstrap design problem, not a simple DOM timing issue in the test. Fixing the duplicate bootstrap path in the component is lower risk than adding more waits around an unstable transition.
- Keeping a synchronous screen ref alongside React state is justified here because the bug depends on async responses observing stale UI state between render commits.

#### Suggested Next Steps
- Push the branch so PR #21 can rerun the validate workflow with the bootstrap fix.
- If CI still shows environment-specific variance, run the full Node 22 validation path locally to match the repository baseline exactly.

### session v51: Vendor CUBID tarballs so CI and Vercel can install the onboarding stack
- timestamp: 2026-04-16T18:17:23-0400
- agent: **Codex (GPT-5)**
- branch: **codex/wallet-pr4-onboarding-cubid**
- head: TBD

#### Objective
Repair the stacked onboarding/CUBID tip branch after PR #21 failed in GitHub Actions and Vercel because the branch depended on local sibling-repo tarballs that do not exist in CI.

#### Actions Taken
- Copied the local CUBID SDK tarballs into a tracked repo directory at `vendor/cubid/`:
  - `cubid-api-0.1.0.tgz`
  - `cubid-web2-0.1.0.tgz`
  - `cubid-web2-react-0.1.0.tgz`
- Updated `package.json` so both `dependencies` and `pnpm.overrides` now point at the vendored tarballs instead of `../cubid/cubid-sdk-v2/dist-packs/*`.
- Regenerated `pnpm-lock.yaml` from the repo root so the lockfile now resolves the vendored in-repo tarballs.
- Reproduced the CI validation sequence from the FundLoop worktree to verify the branch no longer depends on the sibling `cubid-sdk-v2` checkout.

#### Tests and Validation Notes
- `pnpm --dir /Users/botmaster/src/fundloop-pr-stack install --frozen-lockfile` passed
- `pnpm --dir /Users/botmaster/src/fundloop-pr-stack lint` passed
- `pnpm --dir /Users/botmaster/src/fundloop-pr-stack test` passed
- `pnpm --dir /Users/botmaster/src/fundloop-pr-stack typecheck` passed
- `pnpm --dir /Users/botmaster/src/fundloop-pr-stack build` passed
- `pnpm --dir /Users/botmaster/src/fundloop-pr-stack/contracts test` passed
- Local validation ran under Node 25 because that is the host shell default on this machine; Hardhat warned about the unsupported runtime, but the repo's CI workflow uses `.nvmrc` and pins Node 22, which is the supported path for GitHub Actions and Vercel.

#### Reflections
- The original CUBID package wiring was acceptable for local multi-repo development but not for a standalone checkout. Vendoring the tarballs is the smallest change that makes the stacked PR portable without widening the scope to package publishing or workspace restructuring.
- Because the tarballs are tiny, checking them into the repo is materially lower risk than trying to publish private packages in the middle of a stacked review.

#### Suggested Next Steps
- Push the repair commit to `codex/wallet-pr4-onboarding-cubid` so PR #21 can rerun CI and Vercel with the vendored artifacts.
- If reviewers want a longer-term dependency strategy, follow up later with either published private packages or a first-class monorepo package boundary after the current stack lands.

### session v50: Fold CUBID authority and profile/account ownership into one refactor pass
- timestamp: 2026-04-15T15:22:50-0400
- agent: **Codex (GPT-5)**
- branch: **codex/wallet-production-readiness**
- head: TBD

#### Objective
Complete the folded Sessions 15 and 16 by making CUBID the explicit authority for identity-owned fields, extending the normalized snapshot/read-model contract with authoritative names, refactoring onboarding and account/profile surfaces around that ownership split, and adding a first read-only operator identity-health page.

#### Actions Taken
- Added the forward-only migration `supabase/migrations/20260415170500_cubid_primary_name.sql` so `public.cubid_identity_snapshots` now stores `primary_name`.
- Updated `types/supabase.ts` and the normalized CUBID types under `lib/cubid/types.ts` so the app contract now includes snapshot-backed `primaryName`.
- Extended the CUBID sync pipeline:
  - `lib/cubid/snapshot.ts`
  - `lib/cubid/sync-profile-command.ts`
  - `lib/edge-functions/user-cubid-sync-profile-contract.ts`
  so snapshot sync now derives and persists `primary_name` alongside email, phone, score, stamp arrays, and fail-soft sync metadata.
- Reworked the shared identity read-model in `lib/cubid/read-model.ts` to expose:
  - managed identity fields with `synced`, `pending`, and `legacy_local_fallback` states
  - explicit identity ownership groups
  - the updated hybrid completion model
- Updated `lib/profile-completion.ts` so local completion now tracks FundLoop-owned profile fields instead of treating editable full name as local.
- Extended `lib/navigation-context.ts`, `app/actions/onboarding-actions.ts`, and `lib/public-discovery.ts` so signed-in and public surfaces can render:
  - CUBID-managed identity
  - FundLoop-managed profile/preferences
  - trust/status cues and snapshot-backed names
- Refactored onboarding ownership:
  - `components/user-signup-flow.tsx`
  - `components/onboarding/user-profile-preview.tsx`
  - `components/onboarding/extended-cubid-identity-step.tsx`
  so user onboarding no longer treats full name as a locally editable field and instead presents it as CUBID-managed identity with display name and profile headline remaining local.
- Refactored signed-in account/profile surfaces:
  - `components/account/cubid-identity-panel.tsx`
  - `components/account/account-settings-panel.tsx`
  - `components/account/fundloop-profile-panel.tsx`
  - `app/[locale]/(app)/workspace/page.tsx`
  - `app/[locale]/(app)/workspace/account/page.tsx`
  - `app/[locale]/(app)/founder/account/page.tsx`
  so the UI now separates CUBID-managed identity from FundLoop-managed profile/preferences and explains pending or legacy fallback states explicitly.
- Updated public participant surfaces:
  - `app/[locale]/(public)/users/page.tsx`
  - `app/[locale]/(public)/users/[id]/page.tsx`
  so they prefer display name as the public headline, show verified/legal name secondarily when available, and surface lightweight CUBID trust/status cues without turning the pages into operator dashboards.
- Added the first read-only operator identity-health page at `app/[locale]/(app)/admin/identity/page.tsx` and linked it from `app/[locale]/(app)/admin/page.tsx`.
- Fixed the unauthenticated behavior on `/admin/identity` so it now degrades to an access-denied view instead of throwing a 500.
- Updated the durable docs:
  - `docs/engineering/cubid-identity.md`
  - `docs/engineering/route-inventory.md`
- Added and refreshed coverage for the folded Sessions 15 and 16 behavior:
  - `tests/cubid-read-model.test.ts`
  - `tests/admin-identity-page.test.tsx`
  - updates to `tests/navigation-context.test.ts`
  - `tests/account-settings-panel.test.tsx`
  - `tests/cubid-sync-profile-command.test.ts`
  - `tests/onboarding-edge-contracts.test.ts`
  - `tests/public-user-journey.test.ts`
  - `tests/user-signup-flow.test.tsx`

#### Tests and Validation Notes
- `pnpm dlx node@22.22.1 /opt/homebrew/bin/pnpm lint` passed
- `pnpm dlx node@22.22.1 /opt/homebrew/bin/pnpm test` passed
- `pnpm dlx node@22.22.1 /opt/homebrew/bin/pnpm typecheck` passed
- `pnpm dlx node@22.22.1 /opt/homebrew/bin/pnpm build` passed
- `pnpm dlx node@22.22.1 /opt/homebrew/bin/pnpm check` passed
- Manual production-smoke checks against `next start -p 3001` verified:
  - `/en/users` returned `200` and rendered the new CUBID trust labels
  - `/en/users/00000000-0000-4000-8000-000000000101` returned `200` and rendered the verified-name / CUBID-score identity copy
  - `/en/workspace/account` redirected unauthenticated users to `/en/join`
  - `/en/founder/account` redirected unauthenticated users to `/en/join`
  - `/en/admin/identity` rendered an access-denied state instead of throwing a server error when accessed without operator auth
- I attempted to restart the local Supabase stack for a richer authenticated smoke, but `supabase start` failed because local port `54322` is already allocated by another Supabase project (`everfund`). Because of that environment conflict, I did not complete a trustworthy signed-in browser smoke of the new workspace/account identity panels in this session.

#### Reflections
- Session 14 established the snapshot contract; this folded pass is where the product stops pretending that FundLoop is the canonical editor of identity. The important UX change is not just new data fields, but a clearer promise about who owns what.
- The most useful shared abstraction here is the managed-identity read model. It keeps onboarding, account pages, and public participant views aligned without having each surface parse raw snapshot payloads or reinvent fallback rules.
- The new `/admin/identity` page is intentionally read-only and scoped. It provides operator visibility into stale or failed CUBID sync state without jumping ahead into cross-user sync or intervention workflows.

#### Suggested Next Steps
- Once the local Supabase port conflict is resolved, run a signed-in browser smoke for:
  - `/workspace`
  - `/workspace/account`
  - `/founder/account`
  - `/admin/identity`
  using a linked or verified test user so the new ownership split can be checked visually end to end.
- Session 17 can now build the real user workspace home on top of the clearer identity contract and completion model instead of inheriting the old mixed profile assumptions.
- Future CUBID/operator sessions can extend `/admin/identity` with controlled resync tooling, but only after the current read-only health contract has seen real operator use.

### session v49: Add the CUBID snapshot model and extended profile-completion loop
- timestamp: 2026-04-15T14:49:45-0400
- agent: **Codex (GPT-5)**
- branch: **codex/wallet-production-readiness**
- head: TBD

#### Objective
Complete Session 14 by adding a durable CUBID snapshot model, a typed snapshot-sync command, optional extended identity completion in user onboarding, and richer workspace/account surfaces that show hybrid profile completion without blocking publish on phone or extra provider stamps.

#### Actions Taken
- Added the forward-only migration `supabase/migrations/20260415101500_cubid_identity_snapshots.sql` for `public.cubid_identity_snapshots`, including normalized stamp arrays, raw payload storage, sync timestamps, and sync-error fields.
- Updated `types/supabase.ts` so the generated app contract now includes `cubid_identity_snapshots`.
- Switched the repo to the local CUBID v2 package contract through local tarball dependencies in `package.json` / `pnpm-lock.yaml`:
  - `@cubid/api`
  - `@cubid/web2`
  - `@cubid/web2-react`
- Built the Session 14 CUBID server layer under `lib/cubid/`:
  - `server-client.ts` for server-side SDK clients
  - `snapshot.ts` for identity/stamp normalization
  - `read-model.ts` for shared snapshot + completion shaping
  - `sync-profile-command.ts` for fail-soft snapshot sync and `users` strengthening
  - `passport.ts` and `browser-web2-client.ts` for safe browser-side web2 handoff
- Fixed the earlier Session 13 type drift by updating `resolve-email-command.ts` to return the lightweight link-state contract instead of the full snapshot type.
- Added the new typed Edge Function boundary for snapshot refresh:
  - `lib/edge-functions/user-cubid-sync-profile-contract.ts`
  - `lib/edge-functions/user-cubid-sync-profile.ts`
  - `lib/edge-functions/user-cubid-sync-profile-server.ts`
  - `supabase/functions/user-cubid-sync-profile/index.js`
- Added authenticated internal CUBID browser-bridge routes so secrets stay server-side:
  - `app/api/internal/cubid/phone/start/route.ts`
  - `app/api/internal/cubid/phone/verify/route.ts`
  - `app/api/internal/cubid/stamps/add/route.ts`
- Extended the read models in:
  - `app/actions/onboarding-actions.ts`
  - `lib/navigation-context.ts`
  so they now carry:
  - snapshot-backed identity fields
  - hybrid profile-completion percentage
  - missing completion items
  - non-secret CUBID Passport config needed by the browser bridge
- Added the optional `extended_identity` onboarding screen in `lib/onboarding.ts`, then updated:
  - `components/user-signup-flow.tsx`
  - `components/onboarding/extended-cubid-identity-step.tsx`
  so signed-in users can verify phone inline, open provider allow flows through `@cubid/web2-react`, refresh the snapshot, and still skip forward without blocking publish.
- Upgraded account/workspace identity UX:
  - `components/account/cubid-identity-panel.tsx`
  - `components/account/account-settings-panel.tsx`
  - `app/[locale]/(app)/workspace/page.tsx`
  - `app/[locale]/(app)/workspace/account/page.tsx`
  - `app/[locale]/(app)/founder/account/page.tsx`
  to show snapshot-backed state, completion percentage, missing items, phone/provider progress, and refresh controls.
- Updated durable docs and configuration:
  - `.env.example`
  - `docs/engineering/edge-functions.md`
  - `docs/engineering/cubid-identity.md`
  - `docs/engineering/README.md`
- Added or updated coverage for the new Session 14 behavior:
  - `tests/cubid-sync-profile-command.test.ts`
  - `tests/onboarding-edge-contracts.test.ts`
  - `tests/public-user-journey.test.ts`
  - `tests/navigation-context.test.ts`
  - `tests/account-settings-panel.test.tsx`
  - `tests/user-signup-flow.test.tsx`

#### Tests and Validation Notes
- Focused validation passed:
  - `pnpm exec vitest run tests/public-user-journey.test.ts tests/navigation-context.test.ts tests/account-settings-panel.test.tsx tests/user-signup-flow.test.tsx tests/onboarding-edge-contracts.test.ts tests/cubid-sync-profile-command.test.ts`
  - `pnpm typecheck`
- Full repo gates were still pending at the time of this log update and were run afterward as part of the session closeout.
- I did not run a live credentialed browser smoke against real CUBID Passport in this session. The browser bridge, Edge Function path, and snapshot read models are validated through tests and repo gates, but a real end-to-end phone/provider flow still depends on configured local CUBID credentials and a valid `CUBID_STAMP_PAGE_ID`.

#### Reflections
- Session 13 established the lightweight identity gate; Session 14 is the point where FundLoop gains a durable identity snapshot contract that later payout, reporting, and monthly-cycle work can build on.
- The important security decision here was to keep the browser on a narrow bridge: Edge Functions for sync, internal route handlers for phone/stamp actions, and no `CUBID_API_KEY` in client code.
- The current package wiring intentionally uses the local sibling CUBID v2 workspace through local tarball references. That works cleanly for this machine and session, but it remains an environment-sensitive dependency contract rather than a portable public-registry install.

#### Suggested Next Steps
- Run a real local browser smoke with working `CUBID_DAPP_ID`, `CUBID_API_KEY`, and `CUBID_STAMP_PAGE_ID` to verify:
  - resolve email -> sync snapshot
  - phone OTP -> persisted phone stamp
  - provider allow flow return -> refreshed snapshot
- Session 15 can now focus on hardening the external sync semantics and operator visibility because the normalized storage contract already exists.
- Session 16 should continue the UI cleanup by making more profile/account fields explicitly “CUBID authority” versus “local preference.”

### session v48: Make onboarding and workspace identity-first with direct CUBID email resolution
- timestamp: 2026-04-15T08:57:52-0400
- agent: **Codex (GPT-5)**
- branch: **codex/wallet-production-readiness**
- head: TBD

#### Objective
Complete Session 13 by making CUBID linkage a first-class prerequisite in FundLoop: add a minimal explicit identity status to `public.users`, resolve or auto-create a CUBID user from the authenticated email through direct API calls, enforce linkage before user or project publish, and surface that state in onboarding plus workspace/account without installing the full `cubid-sdk`.

#### Actions Taken
- Added the forward-only migration `supabase/migrations/20260415154500_cubid_identity_status.sql` to introduce `public.cubid_identity_status`, add `users.cubid_identity_status`, and backfill existing users to `linked` or `unlinked` based on current CUBID linkage.
- Updated `types/supabase.ts` so the generated app contract now includes the new enum and user column.
- Built a lightweight direct CUBID client under `lib/cubid/`:
  - `config.ts` for env loading
  - `resolve-by-email.ts` for `create_user`, `identity/fetch_identity`, and `score/fetch_score`
  - `resolve-email-command.ts` for fail-soft persistence into `public.users`
- Added the typed Edge Function command boundary for CUBID linkage:
  - `lib/edge-functions/user-cubid-resolve-email-contract.ts`
  - `lib/edge-functions/user-cubid-resolve-email.ts`
  - `lib/edge-functions/user-cubid-resolve-email-server.ts`
  - `supabase/functions/user-cubid-resolve-email/index.js`
- Extended `lib/navigation-context.ts` and `app/actions/onboarding-actions.ts` so read models now carry:
  - `cubidIdentityStatus`
  - `cubidId`
  - `primaryEmailIdentity`
  - `cubidScore`
- Enforced linkage inside the actual publish commands:
  - `executeUserOnboardingPublishCommand(...)` now rejects publish with `cubid_identity_required` when the user is still `unlinked`
  - `executeProjectOnboardingPublishCommand(...)` now rejects publish with `cubid_identity_required` when the current founder/member is still `unlinked`
- Added `"cubid"` as the first onboarding screen for both user and project flows in `lib/onboarding.ts`, then updated:
  - `components/user-signup-flow.tsx`
  - `components/project-signup-flow.tsx`
  so onboarding now shows the signed-in email, resolves CUBID identity through the browser Edge Function adapter, and blocks progress/publish until linkage succeeds.
- Added the new identity UI primitives:
  - `components/onboarding/cubid-identity-step.tsx`
  - `components/account/cubid-identity-panel.tsx`
- Updated workspace/account surfaces so identity state is visible after sign-in:
  - `app/[locale]/(app)/workspace/page.tsx`
  - `app/[locale]/(app)/workspace/account/page.tsx`
  - `app/[locale]/(app)/founder/account/page.tsx`
  - `components/account/account-settings-panel.tsx`
- Expanded the locale packs (`en`, `fr`, `es`) and updated the durable docs:
  - `.env.example`
  - `docs/engineering/edge-functions.md`
  - `docs/engineering/navigation-shell.md`
- Added and refreshed coverage for the new identity flow:
  - `tests/cubid-resolve-by-email.test.ts`
  - `tests/cubid-resolution-command.test.ts`
  - `tests/account-settings-panel.test.tsx`
  - plus updates to onboarding, adapter, navigation-context, and publish-command tests

#### Tests and Validation Notes
- `pnpm dlx node@22.22.1 /opt/homebrew/bin/pnpm exec vitest run tests/cubid-resolve-by-email.test.ts tests/cubid-resolution-command.test.ts tests/onboarding-edge-contracts.test.ts tests/onboarding-edge-adapters.test.ts tests/user-onboarding-commands.test.ts tests/project-onboarding-commands.test.ts tests/navigation-context.test.ts tests/user-signup-flow.test.tsx tests/project-signup-flow.test.tsx tests/account-settings-panel.test.tsx` passed during focused development
- `pnpm dlx node@22.22.1 /opt/homebrew/bin/pnpm check` passed
- I did not run a live browser smoke against the real CUBID API in this session. The code-level integration, publish gating, and workspace/account behavior are validated through tests and full repo gates, but a real external-credential smoke remains pending a configured local session with known-good CUBID credentials.

#### Reflections
- The biggest architectural shift here is that identity is no longer implicit. Onboarding, publish, workspace, and account all now share one explicit state model: `unlinked`, `linked`, or `verified`.
- Using direct HTTP calls instead of installing `cubid-sdk` kept this session intentionally narrow and reviewable while still establishing the real external dependency shape that later sessions can deepen.
- One important compromise remains visible in the data model: `public.users.primary_email_identity` is still constrained by the existing app/auth schema, so Session 13 treats it as an app-side identity reference instead of overwriting it with arbitrary CUBID-side identifiers. A richer canonical snapshot model still belongs in the next CUBID sessions.

#### Suggested Next Steps
- Session 14 should introduce the fuller CUBID-linked snapshot model so FundLoop can distinguish local auth/session state from the durable external identity record more cleanly.
- Once CUBID credentials are configured in a stable local environment, run an authenticated browser smoke for:
  - user onboarding resolve -> publish
  - project onboarding resolve -> publish
  - workspace/account status transitions after linkage
- After the richer snapshot model exists, revisit how `primary_email_identity` and future CUBID-managed fields should be represented so FundLoop clearly separates identity authority from local preferences.

### session v47: Move onboarding write flows to typed Edge Function commands
- timestamp: 2026-04-15T01:08:08-0400
- agent: **Codex (GPT-5)**
- branch: **codex/wallet-production-readiness**
- head: TBD

#### Objective
Complete Session 12 by moving onboarding draft-save, clear, and publish writes out of `app/actions/onboarding-actions.ts` and into typed Supabase Edge Function commands, while bundling the pending local blog-seed fixture cleanup into the same commit.

#### Actions Taken
- Extracted the onboarding mutation logic into server-only command modules under `lib/onboarding/`:
  - `user-onboarding-commands.ts`
  - `project-onboarding-commands.ts`
  - `command-utils.ts`
- Added six onboarding command contracts and adapters under `lib/edge-functions/` for:
  - user draft upsert
  - user draft clear
  - user publish
  - project draft upsert
  - project draft clear
  - project publish
- Added six matching Supabase Edge Functions under `supabase/functions/`, plus the shared command runtime helper, following the existing authenticated-client plus service-role-after-auth pattern used by the payment draft command.
- Reduced `app/actions/onboarding-actions.ts` to the intentional read surface (`getOnboardingState`, `searchProjectsForTeamMember`) plus thin compatibility wrappers that delegate writes through the server Edge adapters.
- Switched `components/user-signup-flow.tsx` and `components/project-signup-flow.tsx` to use the browser Edge adapters for welcome-start saves, autosave, clear/start-over, and publish, while preserving the existing toast, resume, close, and project-flow handoff behavior.
- Added coverage for onboarding contracts, command modules, Edge adapters, and the client signup flows:
  - `tests/onboarding-edge-contracts.test.ts`
  - `tests/user-onboarding-commands.test.ts`
  - `tests/project-onboarding-commands.test.ts`
  - `tests/onboarding-edge-adapters.test.ts`
  - `tests/user-signup-flow.test.tsx`
  - `tests/project-signup-flow.test.tsx`
- Folded the previously dirty local-fixture cleanup into this same session by adding deterministic published blog posts to `supabase/seed.sql`, documenting the stable smoke targets in `docs/engineering/local-seed.md`, and extending `tests/local-public-seed.test.ts`.
- Updated `docs/engineering/edge-functions.md` to record onboarding writes as the second migrated Edge Function domain.
- Fixed one follow-on local runtime issue exposed during smoke by making `lib/navigation-context.ts` fall back to the authenticated SSR Supabase client when the local service-role env is absent, and added a regression case in `tests/navigation-context.test.ts`.

#### Tests and Validation Notes
- `pnpm dlx node@22.22.1 /opt/homebrew/bin/pnpm exec vitest run tests/navigation-context.test.ts tests/onboarding-edge-contracts.test.ts tests/user-onboarding-commands.test.ts tests/project-onboarding-commands.test.ts tests/onboarding-edge-adapters.test.ts tests/user-signup-flow.test.tsx tests/project-signup-flow.test.tsx` passed
- `pnpm dlx node@22.22.1 /opt/homebrew/bin/pnpm exec vitest run tests/local-public-seed.test.ts` passed earlier during the bundled seed work and remains part of this checkpoint
- `pnpm dlx node@22.22.1 /opt/homebrew/bin/pnpm check` passed
- Local HTTP smoke confirmed:
  - `/en?onboarding=user` returned `200`
  - `/en/blog/why-monthly-cadence-matters` returned `200`
  - the guarded `/api/internal/e2e/login` route successfully authenticated the disposable local smoke user
- Full browser write-path smoke was only partially completed. The local environment was serving an older `everfund` Supabase stack that lacked `user_onboarding_drafts`, and when I attempted to switch over to a fresh local `fundloop` stack the Docker daemon was no longer available. That prevented a trustworthy end-to-end verification of the actual draft-write and publish requests against the intended local schema in this session.

#### Reflections
- The core architectural win here is that onboarding now follows the same command-style Edge Function pattern as the payment draft write path, which makes the founder/user lifecycle flows much more consistent with the target architecture.
- The local smoke uncovered a useful non-obvious bug outside the new onboarding code: shared navigation was hard-failing public authenticated pages when the service-role env was missing. Fixing that now makes the app shell more robust in local and preview environments.
- The remaining gap is environmental rather than architectural. The code-level migration is validated through tests and build checks, but the local Supabase runtime needs to be healthy and on the correct schema before the true browser write-path smoke can be called complete.

#### Suggested Next Steps
- Bring the local Docker/Supabase stack back up under the repo’s actual `fundloop` project ID, then rerun the authenticated browser smoke for:
  - user draft save/resume/publish
  - user publish -> project handoff
  - project draft save/resume/publish
- Once Session 12’s live smoke is clean, move on to Session 13’s CUBID-first identity requirements work using the new onboarding write architecture as the foundation.

### session v46: Consolidate the remaining public routes into the modern localized shell
- timestamp: 2026-04-15T00:16:00-0400
- agent: **Codex (GPT-5)**
- branch: **codex/wallet-production-readiness**
- head: TBD

#### Objective
Complete Session 11 by retiring the remaining legacy public routes, adding the canonical public reports hub, rebuilding the old-shell public pages onto the current localized marketing shell, and updating the route/docs metadata so the public site feels intentional instead of transitional.

#### Actions Taken
- Replaced `/[locale]/about`, `/[locale]/api`, and `/[locale]/analytics` with permanent redirects into their IA-approved canonical destinations, and retired the old mock invitation route by redirecting `/[locale]/invitations/[token]` into `/[locale]/join?invite=...`.
- Added the new `/[locale]/reports` public transparency surface and rebuilt `/[locale]/documentation` into the merged docs hub for about/product context, protocol and integration direction, and support-article browsing.
- Reworked the remaining old-shell public pages onto the modern localized public shell:
  - `blog`
  - `blog/[slug]`
  - `ecosystem`
  - `faq`
  - `terms`
  - `privacy`
  - `cookies`
- Added the new server-side `lib/public-content.ts` helper so blog and documentation content now load through the same fail-soft server pattern used by the newer public discovery routes.
- Updated `lib/public-site.ts`, the footer, and the relevant locale message packs so public resources now promote `reports` and `documentation#protocol-and-integrations` instead of the retired standalone `analytics` and `api` pages.
- Updated `docs/engineering/navigation-shell.md`, `docs/engineering/route-inventory.md`, and `agent-context/todo.md` so the long-lived docs reflect the new public-route truth.
- Added and refreshed coverage in:
  - `tests/public-route-redirects.test.ts`
  - `tests/ecosystem-page.test.tsx`
  - `tests/footer.test.tsx`
  - `tests/i18n.test.ts`

#### Tests and Validation Notes
- `pnpm dlx node@22.22.1 /opt/homebrew/bin/pnpm lint` passed
- `pnpm dlx node@22.22.1 /opt/homebrew/bin/pnpm test` passed
- `pnpm dlx node@22.22.1 /opt/homebrew/bin/pnpm typecheck` passed
- `pnpm dlx node@22.22.1 /opt/homebrew/bin/pnpm build` passed
- Local production smoke on port `3001` confirmed:
  - `/en/about` -> `308` to `/en/documentation#about-fundloop`
  - `/en/api` -> `308` to `/en/documentation#protocol-and-integrations`
  - `/en/analytics` -> `308` to `/en/reports`
  - `/en/invitations/test-token` -> `308` to `/en/join?invite=test-token`
  - `/en/documentation`, `/en/reports`, `/en/blog`, `/en/faq`, `/fr/documentation`, and `/es/blog` all returned `200`
- Headless browser smoke verified light/dark mode rendering for `/en/reports` and `/en/documentation`, including the expected titles and the `dark` class toggle on the document element.
- One local-content caveat remains: the current local dataset did not expose any published blog posts during this smoke pass, so the rebuilt blog listing rendered its empty state rather than a real article card and there was no live blog-detail route to verify in-browser.

#### Reflections
- The most important part of this session was not visual cleanup by itself; it was collapsing the remaining transitional public routes into canonical destinations so the public site now tells one coherent story.
- Moving docs and blog content onto a server-side helper also closes an architectural gap: the old browser-only content pages were out of step with the rest of the public shell and made the site feel more like a stitched-together prototype than one product.

#### Suggested Next Steps
- Session 12 should now migrate the onboarding draft save/publish flows to Edge Functions while the public acquisition paths and documentation surface are stable.
- When local content fixtures improve again, add one real blog post/article smoke target so the rebuilt blog detail route stays covered alongside the public discovery fixtures.

### session v45: Remove hard 500s from query-driven public and admin pages after local reset
- timestamp: 2026-04-14T23:44:52-0400
- agent: **Codex (GPT-5)**
- branch: **codex/wallet-production-readiness**
- head: TBD

#### Objective
Fix the remaining local runtime errors exposed after the local Supabase reset, specifically the hard `500` failures on query-driven pages such as `/[locale]/projects`, `/[locale]/users`, and `/[locale]/admin/payments/observability`, then recommit the resulting dirty files with a fresh session-log entry.

#### Actions Taken
- Fixed the public discovery/server helper regression introduced during local-seed follow-up work by restoring the `react` `cache` import for the still-cached detail/profile readers while leaving the directory readers uncached.
- Added explicit item/index typing on the public project and user detail pages so `tsc --noEmit` stays clean after the local public-discovery changes.
- Marked the query-driven pages as `dynamic = "force-dynamic"` and restored proper awaited `searchParams` handling on:
  - `app/[locale]/(public)/projects/page.tsx`
  - `app/[locale]/(public)/users/page.tsx`
  - `app/[locale]/(app)/admin/payments/observability/page.tsx`
  - `app/[locale]/(app)/projects/[slug]/zkas/page.tsx`
- Verified that the hard 500s are gone for the affected routes in local dev after restarting the app server.

#### Tests and Validation Notes
- `pnpm dlx node@22.22.1 /opt/homebrew/bin/pnpm check` passed
- `pnpm dlx node@22.22.1 /opt/homebrew/bin/pnpm exec vitest run tests/local-public-seed.test.ts tests/public-user-journey.test.ts tests/i18n.test.ts` passed
- Local dev smoke after restarting Next with the corrected `.env.local`:
  - `/en/projects` returned `200`
  - `/en/users` returned `200`
  - `/en/projects/civic-mesh` returned `200`
  - `/en/users/00000000-0000-4000-8000-000000000101` returned `200`
  - `/en/admin/payments/observability` returned `200`
- One remaining local-environment caveat is still visible in server logs: Node-side calls to the local Supabase API can report `TypeError: fetch failed` on this machine, so the public discovery pages currently rely on their fail-soft empty-state behavior rather than consistently rendering seeded data during local smoke.

#### Reflections
- The crash source was not the curated seed itself; it was the combination of query-driven pages and the local dev/runtime path around `searchParams` plus a follow-up helper regression.
- The pages are now operationally safer because they no longer hard-fail under this local setup, even when the local Supabase API connectivity remains flaky from the Next server process.

#### Suggested Next Steps
- Investigate why Node-side requests from the app process to `http://127.0.0.1:54321` are still intermittently failing even though `supabase status` reports the stack as running.
- Once that connectivity issue is resolved, rerun the local public discovery smoke and verify the deterministic seeded names appear in `/projects` and `/users`, not just that the routes stay up.

### session v44: Add deterministic local public discovery fixtures for browser smoke tests
- timestamp: 2026-04-14T23:26:09-0400
- agent: **Codex (GPT-5)**
- branch: **codex/wallet-production-readiness**
- head: TBD

#### Objective
Make the local Supabase seed more reliable for public discovery work by adding a small deterministic fixture set for project and user detail pages, so local resets always produce known browser smoke targets without depending on incidental snapshot rows.

#### Actions Taken
- Appended a clearly labeled deterministic fixture block to `supabase/seed.sql` with three stable public projects (`civic-mesh`, `mutual-aid-atlas`, `open-transit-ledger`), four public users, and linked participant rows that exercise both project and user discovery surfaces.
- Bumped the tracked `projects_id_seq1` and `users_sequential_id_seq` setvals in the seed so future local inserts remain above the new curated fixture IDs.
- Added `tests/local-public-seed.test.ts` to lock in the presence of the curated slugs, user ids, and sequence bumps in the tracked seed artifact.
- Added `docs/engineering/local-seed.md` and updated `docs/engineering/README.md` plus `README.md` so local developers and future agent sessions have a stable list of post-reset smoke routes to target.

#### Tests and Validation Notes
- `pnpm dlx node@22.22.1 /opt/homebrew/bin/pnpm exec vitest run tests/local-public-seed.test.ts` passed
- `pnpm dlx node@22.22.1 /opt/homebrew/bin/pnpm check` passed
- I did not run `supabase db reset` in this session because the local Supabase CLI currently reports no active `supabase_db_fundloop` container on this machine, so the seed changes were validated through the tracked artifact, tests, and repo-wide quality gates instead of a live reset replay.

#### Reflections
- The seed did not need a wholesale replacement; the valuable change was to layer a tiny, intentional fixture set on top of the broader snapshot-style data so discovery smoke tests have something stable to target.
- Keeping the fixture doc separate from the seed itself should make later Playwright and public-route work less brittle because the expected local targets are now explicit instead of tribal knowledge.

#### Suggested Next Steps
- Once the local Supabase stack is healthy again, run `supabase db reset` and manually smoke the curated `/projects/*` and `/users/*` routes against the new fixture set.
- If we add more public discovery filtering or richer profile modules later, extend this deterministic fixture set rather than relying on whichever remote-style rows happen to exist in the seed.

### session v43: Rebuild the user discovery and participation funnel into one coherent public path
- timestamp: 2026-04-14T23:09:00-0400
- agent: **Codex (GPT-5)**
- branch: **codex/wallet-production-readiness**
- head: TBD

#### Objective
Complete Session 10 by turning the user side of FundLoop into one coherent public-to-workspace path: rebuild `/[locale]/participation` as the canonical participant funnel, modernize the public projects and people directories, and make onboarding, CUBID identity, and current results visibility feel like one system instead of scattered pages.

#### Actions Taken
- Rebuilt `app/[locale]/(public)/participation/page.tsx` into a stronger localized user funnel with explicit sections for why users join, cross-project discovery, CUBID-backed identity expectations, current results visibility, and the honest “what happens next” path.
- Replaced the old browser-fetched `app/[locale]/(public)/projects/page.tsx` and `app/[locale]/(public)/users/page.tsx` implementations with server-rendered public discovery pages using query-string filters, locale-aware links, localized metadata, and auth-aware user CTA handoff.
- Replaced `app/[locale]/(public)/projects/[slug]/page.tsx` and `app/[locale]/(public)/users/[id]/page.tsx` with public profile/detail surfaces that feel like part of the same product, removed the old `components/project-detail-page.tsx`, and kept founder-only project controls secondary to the public discovery story.
- Added `lib/public-user-journey.ts` to centralize the public CTA truth for signed-out users, signed-in inactive users, and active users, and added `lib/public-discovery.ts` as the server-side data layer for public projects/users discovery and detail queries.
- Hardened the new public discovery data layer so server-side Supabase failures degrade into empty-state public pages with compact warnings instead of throwing render-time exceptions.
- Expanded the English, French, and Spanish message packs with new participation, projects, project-detail, users, and user-detail copy plus localized metadata and home-page participant entry-path updates.
- Added test coverage in `tests/public-user-journey.test.ts` and refreshed `tests/i18n.test.ts` to lock in the new localized route copy, then updated `docs/engineering/navigation-shell.md`, `docs/engineering/route-inventory.md`, and `agent-context/todo.md` to reflect the completed Session 10 architecture.

#### Tests and Validation Notes
- `pnpm dlx node@22.22.1 /opt/homebrew/bin/pnpm check` passed
- `pnpm dlx node@22.22.1 /opt/homebrew/bin/pnpm exec vitest run tests/public-user-journey.test.ts tests/i18n.test.ts` passed
- Local dev smoke against the rebuilt public user path confirmed:
  - `/en/participation` returned `200`
  - `/en/projects` returned `200`
  - `/en/users` returned `200`
  - `/fr/participation` returned `200`
  - `/es/participation` returned `200`
  - `/en/participation` rendered the locale-preserving onboarding CTA href (`/en?onboarding=user`) and the public projects CTA href (`/en/projects`)
- The local seed did not expose public project/user detail rows during this smoke, so representative detail-route browser verification remains dependent on richer local fixture data.
- Local server-side Supabase fetches can still fail in some env setups; the new public discovery pages now fail soft into empty-state UI with warning-level logs rather than surfacing render errors to users.

#### Reflections
- The biggest improvement in this session was not only the new page art direction, but the shift from “public directory utilities” to one joined-up user story: discover, verify, participate, then keep an eye on current visibility from the workspace.
- The server-first rewrite exposed a real local-env gap that the older browser-fetch versions masked. Hardening the public discovery layer now should make later Edge Function and workspace sessions safer because public pages no longer assume perfect server connectivity.

#### Suggested Next Steps
- Session 11 should finish the remaining public-page cleanup while the new founder and participant funnels are both fresh and aligned.
- Session 17 can now build the real signed-in user workspace home on top of a much clearer public acquisition and discovery story.

---

### session v42: Rebuild the founder acquisition funnel into one canonical public path
- timestamp: 2026-04-14T22:26:48-0400
- agent: **Codex (GPT-5)**
- branch: **codex/wallet-production-readiness**
- head: TBD

#### Objective
Complete Session 09 by turning the lightweight `/[locale]/founders` placeholder into the real founder acquisition funnel, collapsing the legacy pledge/pricing story into that route, and tightening the surrounding public-shell copy so founders see one coherent path into project onboarding.

#### Actions Taken
- Rebuilt `app/[locale]/(public)/founders/page.tsx` as a long-form localized founder funnel using the existing marketing primitives, with explicit sections for the founder promise, commitment model, support model, monthly cadence, identity/KYC expectations, inside-FundLoop operations, and the onboarding handoff.
- Replaced the legacy `app/[locale]/(public)/pledge/page.tsx` and `app/[locale]/(public)/pricing/page.tsx` pages with permanent localized redirects to `/[locale]/founders#commitment` and `/[locale]/founders#support-model`.
- Updated the localized message dictionaries in English, French, and Spanish so founder copy, metadata, footer CTA text, and the home-page founder entry path all align to the new funnel.
- Simplified the home-page founder entry card to point to `/founders` instead of acting like a second founder landing page, while keeping explicit “start now” CTAs routed into `/?onboarding=project`.
- Updated shared public links and copy so the resource/footer surfaces now promote the founder path rather than a standalone pricing page, and cleaned adjacent founder-facing references in the FAQ and older project-signup copy.
- Added redirect coverage in `tests/founder-route-redirects.test.ts`, refreshed i18n/footer tests for the new founder-path model, and updated the engineering docs in `docs/engineering/navigation-shell.md` and `docs/engineering/route-inventory.md`.

#### Tests and Validation Notes
- `pnpm dlx node@22.22.1 /opt/homebrew/bin/pnpm lint` passed
- `pnpm dlx node@22.22.1 /opt/homebrew/bin/pnpm test` passed
- `pnpm dlx node@22.22.1 /opt/homebrew/bin/pnpm typecheck` passed
- `pnpm dlx node@22.22.1 /opt/homebrew/bin/pnpm build` passed
- `pnpm dlx node@22.22.1 /opt/homebrew/bin/pnpm check` passed
- Local production smoke confirmed:
  - `/en/pledge` responds with `308` to `/en/founders#commitment`
  - `/en/pricing` responds with `308` to `/en/founders#support-model`
  - `/en/founders` renders the new founder funnel with the locale-preserving onboarding CTA and the shared footer/resource links pointing to `/founders`
  - `/fr/founders` renders the updated localized founder funnel and metadata
- I attempted an additional headless Playwright interaction smoke against the onboarding CTA, but the ad hoc inline runner hung in this environment, so the final founder-path smoke was completed against the local production server via redirect and rendered-HTML verification instead.

#### Reflections
- The key product move in this session was treating `/founders` as the only public founder mental model instead of leaving “pricing,” “pledge,” and founder onboarding spread across three different stories.
- Reusing the existing marketing-shell primitives kept the page visually stronger without introducing a parallel design system or one-off founder-only components that would become hard to maintain later.

#### Suggested Next Steps
- Session 10 should now give the participant side the same treatment so the public site has equally clear, first-class paths for both founders and regular users.
- Session 11 can finish the remaining public cleanup with far less risk now that the founder narrative is consolidated and the old pledge/pricing routes are already retired safely.

---

### session v41: Split the public and app shells around the new workspace IA
- timestamp: 2026-04-14T22:10:57-0400
- agent: **Codex (GPT-5)**
- branch: **codex/wallet-production-readiness**
- head: TBD

#### Objective
Complete Session 08 by turning the information architecture decisions into a real shell split: lightweight public navigation, a product-style authenticated shell, canonical workspace entry routes, and the removal of the most confusing legacy entry points.

#### Actions Taken
- Split the localized App Router tree into `app/[locale]/(public)` and `app/[locale]/(app)` route groups so public pages keep marketing chrome while authenticated product routes share a dedicated app shell.
- Added `lib/navigation-context.ts` as the shared server-side navigation contract, deriving authenticated user state, founder/project access, internal-admin access, and managed-project summaries from the repo’s existing Supabase truth.
- Rebuilt the shared navigation layer with a simpler IA-aligned public navbar, a new authenticated app shell, a shared auth/account control component, and a generalized mobile menu.
- Added the first canonical shell entry routes at `/[locale]/workspace`, `/[locale]/workspace/account`, `/[locale]/founder`, `/[locale]/founder/projects`, `/[locale]/founder/account`, and `/[locale]/founders`.
- Redirected legacy route entry points away from the old mixed hubs by replacing `/[locale]/my-profile`, `/[locale]/settings`, and `/[locale]/settings/account` with route-level redirects to the new workspace destinations.
- Updated the admin landing page so it no longer promotes missing child routes and instead links only to real operator destinations.
- Localized the new shell labels and workspace/founder entry-page copy in English, French, and Spanish.
- Added long-lived engineering documentation for the new shell split in `docs/engineering/navigation-shell.md` and updated `docs/engineering/route-inventory.md` to reflect the new routes plus the legacy redirects.
- Updated route-related tests to follow the moved route modules and added `tests/navigation-context.test.ts` to lock in the shared role-resolution contract.

#### Tests and Validation Notes
- `pnpm dlx node@22.22.1 /opt/homebrew/bin/pnpm lint` passed
- `pnpm dlx node@22.22.1 /opt/homebrew/bin/pnpm test` passed
- `pnpm dlx node@22.22.1 /opt/homebrew/bin/pnpm typecheck` passed
- `pnpm dlx node@22.22.1 /opt/homebrew/bin/pnpm build` passed
- `pnpm dlx node@22.22.1 /opt/homebrew/bin/pnpm check` passed
- Local production smoke on port `3001` confirmed:
  - `/en/founders` rendered on the new public shell
  - `/en/my-profile` redirected through the new shell movement
  - `/en/settings` and `/en/settings/account` redirected through the new account destination movement
  - unauthenticated `/en/workspace`, `/en/founder`, and `/en/admin` requests fell back into `/en/join` instead of exposing a broken private shell

#### Reflections
- The biggest implementation choice was moving auth gating out of the app layout and down into the new canonical entry routes. That kept the legacy redirect routes behaving exactly as planned while still protecting the new workspace/founder/operator starts.
- Introducing a shared navigation context now should make the later Session 17 and 18 workspace rebuilds much cleaner, because shell role decisions no longer have to be rediscovered independently in each route.

#### Suggested Next Steps
- Session 09 should use the new `/founders` entry as the foundation for a real founder acquisition funnel instead of rebuilding founder messaging inside the old pledge/pricing structure.
- Later workspace-content sessions should keep routing new account, reporting, and project operations through the new canonical workspace entries instead of adding more functionality back under `/settings` or `/my-profile`.

---

### session v40: Establish shared design tokens for durable light and dark themes
- timestamp: 2026-04-14T20:53:37-04:00
- agent: **Codex (GPT-5)**
- branch: **codex/wallet-production-readiness**
- head: TBD

#### Objective
Complete Session 07 by replacing the current ad hoc color and surface styling drift with a durable semantic token system that works for both the public marketing shell and denser operator/account screens in light and dark mode.

#### Actions Taken
- Refactored `app/globals.css` to introduce semantic surface, text, interaction, status, spacing, type, and shadow tokens on top of the existing shadcn-compatible base theme contract.
- Rebalanced both light and dark palettes so the app now has stronger parity across canvas, panel, border, and text treatments instead of relying on repeated `slate`, `emerald`, and raw white-overlay values.
- Updated the shared UI primitives in `components/ui/` so buttons, cards, badges, inputs, textareas, and selects now consume the token system instead of hard-coded palette assumptions.
- Updated shared presentation layers including `components/marketing/page-chrome.tsx`, `components/marketing/network-constellation.tsx`, `components/theme-toggle.tsx`, and `components/onboarding/onboarding-shell.tsx` so the design-token pass covers both visually expressive marketing surfaces and reusable product shells.
- Restyled the operator and account hubs at `app/[locale]/admin/page.tsx` and `app/[locale]/settings/page.tsx` to prove the same tokens work on denser operational layouts without a one-off page theme.
- Added `docs/engineering/design-tokens.md` and linked it from the engineering docs index.
- Smoke-tested the updated surfaces in a local production server across light and dark themes.

#### Tests and Validation Notes
- `pnpm dlx node@22.22.1 /opt/homebrew/bin/pnpm lint` passed
- `pnpm dlx node@22.22.1 /opt/homebrew/bin/pnpm test` passed
- `pnpm dlx node@22.22.1 /opt/homebrew/bin/pnpm typecheck` passed
- `pnpm dlx node@22.22.1 /opt/homebrew/bin/pnpm build` passed
- Browser smoke passed against a local production server:
  - `/en` rendered the updated marketing shell in light mode
  - `/en/admin` rendered the tokenized operator surface in light mode
  - `/en/settings` rendered correctly in dark mode with the document theme switching to `dark`

#### Reflections
- The main value in this session came from reducing semantic drift, not from redesigning every page. With the token layer in place, later visual work can improve composition and information architecture without re-solving theme parity from scratch.
- The biggest source of previous inconsistency was duplicated one-off `slate` and `emerald` utility usage on product screens. Updating the primitives first gave the app a more reliable baseline with less page-by-page cleanup.

#### Suggested Next Steps
- Session 08 should build on this by refactoring the shared navigation and layout around the new information architecture now that the shell and tokens are stable enough to support it.
- Future feature sessions should keep migrating repeated raw palette classes toward semantic tokens whenever they touch legacy UI surfaces.

---

### session v20: Add multilingual app-shell infrastructure with locale-prefixed routing
- timestamp: 2026-04-14T20:07:56-04:00
- agent: **Codex (GPT-5)**
- branch: **codex/wallet-production-readiness**
- head: TBD

#### Objective
Implement Session 06 by adding the first production-grade i18n layer to FundLoop with always-prefixed locale routes, shared translation infrastructure, and translated shell coverage for the public home, participation, and support flows.

#### Actions Taken
- Added `next-intl` and introduced a dedicated i18n layer under `i18n/` for locale routing, locale-aware navigation helpers, request-time message loading, dictionary fallback, and proxy redirect helpers.
- Moved the public App Router shell under `app/[locale]/...`, updated the locale root layout to provide `NextIntlClientProvider`, localized metadata, and locale validation, and kept internal API handlers unprefixed.
- Added `proxy.ts` so bare page routes redirect to `/en/...`, locale cookies preserve the active language on future bare-route visits, and unsupported locale prefixes like `/de/...` fall through to a proper `404`.
- Localized the shared public shell in the navbar, footer, mobile menu, resource dropdown, and use-cases dropdown using locale-aware links and translated shell dictionaries.
- Translated the first public page set: `/[locale]`, `/[locale]/participation`, and `/[locale]/support`, including support-form labels, validation copy, and success/failure toast copy.
- Added the long-lived engineering reference at `docs/engineering/i18n.md` and linked it from `docs/engineering/README.md`.
- Updated tests and test infrastructure for the localized routing/layout changes, including new i18n and proxy tests plus existing ecosystem, footer, and observability page tests that referenced moved route modules.

#### Tests and Validation Notes
- `pnpm dlx node@22.22.1 /opt/homebrew/bin/pnpm lint` passed
- `pnpm dlx node@22.22.1 /opt/homebrew/bin/pnpm test` passed
- `pnpm dlx node@22.22.1 /opt/homebrew/bin/pnpm typecheck` passed
- `pnpm dlx node@22.22.1 /opt/homebrew/bin/pnpm build` passed
- `pnpm dlx node@22.22.1 /opt/homebrew/bin/pnpm check` passed
- Manual smoke passed against a local production server:
  - `/` redirected to `/en`
  - `/participation` redirected to `/en/participation`
  - `/fr` rendered translated shell copy
  - `/es/support` rendered translated support copy
  - `/de/support` returned `404`

#### Reflections
- The biggest risk in this session was not the translations themselves, but making locale-prefixed routing coexist cleanly with the existing Next App Router tree and unprefixed internal API handlers.
- `next-intl` also required a small Vitest compatibility adjustment because some of its internal imports do not play nicely with the current test environment unless the runner resolves `next/navigation` and `next/server` explicitly.

#### Suggested Next Steps
- Session 07 should build on this by converting the existing styling layer into a durable light/dark token system so the newly localized shell stays visually coherent across both themes.
- Future content-heavy sessions should translate public product funnels and then founder/user workspaces incrementally, reusing the same `next-intl` patterns established here.

---
description: Session log for agent coding sessions
alwaysApply: hybrid = one log entry per commit or session in the most appropriate session-log file
---

# session-log.md
Agents populate one level-3 heading for each coding session, following the same format each time. Each session bumps the version and includes plain text descriptions of:
- objective
- summary of actions taken
- reflections
- suggested next steps

---

### session v40: Let preview deployments degrade when wallet runtime env is absent
- timestamp: 2026-04-16T18:17:23-0400
- agent: **Codex (GPT-5)**
- branch: **codex/wallet-pr1-payments-edge**
- head: TBD

#### Objective
Fix the stacked PR preview deployments after Vercel builds started failing during prerender because the root layout threw on missing wallet runtime configuration in preview environments.

#### Actions Taken
- Removed the root-layout startup assertion from `app/layout.tsx` so the shared `Web3Provider` can receive the runtime config and keep wallet features disabled instead of crashing the entire app when preview env vars are incomplete.
- Kept the wallet runtime config builder and explicit validation helper in place for targeted runtime checks and tests; this change only stops the public shell from treating missing preview wallet env as a build-time fatal error.
- Verified the change against a preview-style build invocation with wallet env intentionally absent.

#### Tests and Validation Notes
- `FUNDLOOP_DEPLOYMENT_ENV=preview pnpm --dir /Users/botmaster/src/fundloop-pr1-fix build` passed

#### Reflections
- The runtime config already carries enough state to disable wallet UX safely. Throwing in the global layout made unrelated public pages depend on private wallet-preview environment setup, which is the wrong coupling for Vercel previews.
- Keeping strict validation as a callable helper preserves the ability to assert on wallet-critical surfaces without making every marketing or documentation page unbuildable.

#### Suggested Next Steps
- Cherry-pick this fix upward through the rest of the stacked PRs so all preview deployments rerun from the same degraded-but-buildable root layout.
- If production needs a hard fail for wallet-specific routes later, reintroduce that assertion closer to the routes or actions that actually require wallet execution.

### session v39: Migrate project payment drafts onto the first Edge Function
- timestamp: 2026-04-14T23:36:10Z
- agent: **Codex (GPT-5)**
- branch: **codex/wallet-production-readiness**
- head: f2bd1b5f6d9876b48a579efb45d0f8f2eb8c38e2 - feat(edge-functions): add shared invocation contract layer

#### Objective
Complete Session 05 by standing up the first real Supabase Edge Function domain boundary for project payment draft creation, moving the project payments page onto the browser adapter, and keeping the old server action only as a compatibility wrapper.

#### Actions Taken
- Added the shared payment draft command module under `lib/payments/` so project-admin permission checks, draft status lookup, payment-method validation, inserts, and summary mapping now live outside the server action.
- Added the first real Supabase Edge Function at `supabase/functions/project-payment-drafts-create/index.js`, including bearer-token auth, service-role-backed domain execution, payment-save observability writes, and the shared command contract.
- Moved the client-side project payments write path onto `invokeProjectPaymentDraftsCreateBrowser(...)` and reduced `createProjectPaymentDrafts(...)` to a compatibility wrapper around the server Edge Function adapter.
- Split browser-safe and server-only Edge Function invokers/adapters so the client bundle no longer drags `next/headers` across the boundary.
- Added local development ergonomics with a new `pnpm supabase:functions:serve:project-payment-drafts-create` script and updated the README plus engineering docs to document the new write path and local smoke flow.
- Added focused coverage for the extracted command and the payment-draft adapter while trimming the outdated payment-save server-action observability expectation.

#### Tests and Validation Notes
- Ran `pnpm dlx node@22.22.1 /opt/homebrew/bin/pnpm exec vitest run tests/project-payment-drafts-command.test.ts tests/project-payment-drafts-create-adapter.test.ts tests/project-payment-observability-actions.test.ts`.
- Ran `pnpm dlx node@22.22.1 /opt/homebrew/bin/pnpm lint`.
- Ran `pnpm dlx node@22.22.1 /opt/homebrew/bin/pnpm check`.
- `lint`, `test`, `typecheck`, and `build` all passed in the supported Node 22 runtime.
- Did not run a live `supabase functions serve` browser smoke because a local Supabase function runtime was not provisioned in this session.

#### Reflections
- The clean separation between browser-safe adapters and server-only adapters was necessary to keep the first migration production-safe; otherwise the shared transport layer would have leaked server-only imports into the client bundle.
- Starting with payment draft creation still feels like the right first domain because it exercised auth, permissions, validation, observability, and summary mapping without entangling the later onboarding sessions.

#### Suggested Next Steps
- Continue migrating the next narrow write command onto the same Edge Function pattern, likely onboarding draft save or onboarding publish.
- Decide whether to add a small local smoke harness around `supabase functions serve` once the team has a reliable local Supabase runtime available.

### session v38: Add shared Supabase Edge Function contract layer
- timestamp: 2026-04-14T23:28:41Z
- agent: **Codex (GPT-5)**
- branch: **codex/wallet-pr1-payments-edge**
- head: 56599f9a9eb72692bdbafaa2b3ddbc6b6ccbf558 - feat(observability): add payment flow failure instrumentation

#### Objective
Complete Session 04 by adding the reusable app-side contract and invocation layer for Supabase Edge Functions, including typed envelopes, shared browser/server invokers, and the first command contract for project payment draft creation.

#### Actions Taken
- Added the shared Edge Function result envelope and invocation helpers under `lib/edge-functions/`.
- Added the first command contract and adapter for `project-payment-drafts-create`, including payload validation and output-shape validation.
- Extracted the shared payment summary type into `lib/payments/payment-record-summary.ts` so app code and future Edge Functions can depend on one transport-safe shape.
- Added focused contract/invoker coverage in `tests/edge-function-invoke.test.ts` and `tests/project-payment-drafts-create-contract.test.ts`.
- Added `docs/engineering/edge-functions.md` and linked it from the engineering docs index.

#### Tests and Validation Notes
- Ran `pnpm dlx node@22.22.1 /opt/homebrew/bin/pnpm exec vitest run tests/edge-function-invoke.test.ts tests/project-payment-drafts-create-contract.test.ts`.
- Ran `pnpm dlx node@22.22.1 /opt/homebrew/bin/pnpm lint`.
- Both the focused tests and lint passed.

#### Reflections
- Landing the shared envelope and invokers first makes the upcoming Edge Function migration much cleaner, because the product code can call a function-specific adapter instead of learning transport details inline.
- Extracting the payment summary shape now avoids a later round of duplicate transport types between Next code and Supabase functions.

#### Suggested Next Steps
- Implement `project-payment-drafts-create` as the first real Supabase Edge Function.
- Move the project payments page onto the browser Edge Function adapter and keep the server action as a compatibility wrapper.

### session v37: Move long-lived route docs into engineering docs
- timestamp: 2026-04-14T23:19:22Z
- agent: **Codex (GPT-5)**
- branch: **codex/wallet-production-readiness**
- head: 9f88663b10eea061b96cab8e05f289a333f92649 - docs(agent-context): define target information architecture

#### Objective
Finish the in-flight documentation cleanup so `agent-context/` stays a small live context surface for agents, while the longer-lived route and architecture docs move into `docs/engineering/` before Sessions 04 and 05 begin.

#### Actions Taken
- Moved the long-lived route governance docs into `docs/engineering/` as `information-architecture.md` and `route-inventory.md`.
- Added `docs/engineering/README.md` and updated `agent-context/README.md` so the repo now distinguishes lightweight live agent context from longer-lived engineering references.
- Updated `AGENTS.md` and `README.md` to point larger engineering docs at `docs/engineering/` instead of `agent-context/`.
- Updated the recent route-level migration comments to reference the moved information-architecture doc.
- Updated `agent-context/todo.md` so each task now reminds agents to refresh engineering docs when architecture, routes, workflows, or operating assumptions change, and backfilled Session 03 with its commit head.

#### Tests and Validation Notes
- Ran `pnpm dlx node@22.22.1 /opt/homebrew/bin/pnpm lint`.
- Lint passed after the reference updates and comment adjustments.

#### Reflections
- Keeping `agent-context/` small will make active sessions easier to orient quickly, while `docs/engineering/` gives the longer-lived design work a more stable home.
- Doing this cleanup before the Edge Function sessions reduces the chance of mixing architectural implementation work with unrelated doc churn in the same commit.

#### Suggested Next Steps
- Introduce the shared Edge Function contract layer in the app and document the invocation pattern in `docs/engineering/`.
- Use project payment draft creation as the first real Supabase Edge Function migration to prove the transport contract.

### session v36: Define target route model and mark transitional surfaces
- timestamp: 2026-04-14T21:57:19Z
- agent: **Codex (GPT-5)**
- branch: **codex/wallet-production-readiness**
- head: 889ab9d7b3dee4d47e5cbe9eb533410c827983f4 - docs(agent-context): add app route inventory

#### Objective
Complete Session 03 by defining the target information architecture around role-based workspaces, mapping major current routes to their future canonical homes, and adding a small set of migration comments to the most important transitional route files.

#### Actions Taken
- Added `docs/engineering/information-architecture.md` to lock the target route model for public surfaces, the user workspace, the founder/project workspace, and the internal operator workspace.
- Added an explicit current-to-target route mapping table covering the major transitional surfaces, including `/my-profile`, `/settings`, `/projects/[slug]/payments`, `/admin`, `/analytics`, `/api`, `/participation`, `/join`, and `/pledge`.
- Updated the planning index to include the IA document.
- Added short IA-oriented TODO comments to the high-signal transitional route files: `app/admin/page.tsx`, `app/settings/page.tsx`, `app/api/page.tsx`, `app/analytics/page.tsx`, `app/invitations/[token]/page.tsx`, and `app/organizations/[id]/page.tsx`.
- Marked Session 03 complete in `agent-context/todo.md` and backfilled Session 02 with the commit head that closed it.

#### Tests and Validation Notes
- Ran `pnpm dlx node@22.22.1 /opt/homebrew/bin/pnpm lint`.
- Lint passed after adding the route-level migration comments.
- No broader validation was needed because this session added planning docs and source comments only.

#### Reflections
- Locking the route model now makes the next navigation and workspace sessions much less ambiguous, especially around the split between public project detail and founder-only project operations.
- Adding just a few migration comments was enough to anchor future work without spreading low-signal TODO noise across the whole tree.

#### Suggested Next Steps
- Use the IA doc to refactor shared navigation and dashboard entry points around public, user, founder, and operator destinations.
- Start moving transitional authenticated surfaces out of the current mixed route set and into the canonical workspace homes defined here.

### session v35: Inventory current app routes and dispositions
- timestamp: 2026-04-14T21:55:18Z
- agent: **Codex (GPT-5)**
- branch: **codex/wallet-production-readiness**
- head: 0f81f1575f4552b86f7091bb2b17ec7123c4df9d - docs(agent-context): finalize planning doc entrypoint

#### Objective
Complete Session 02 by inventorying every current route surface under `app/`, recording which routes are already real, which are transitional, and which should be merged, redirected, or removed before deeper UX and IA work continues.

#### Actions Taken
- Added `docs/engineering/route-inventory.md` with one entry for every current `page.tsx` and `route.ts` surface under `app/`.
- Grouped the inventory into public, authenticated, operator, and machine/internal surfaces so route planning is easier to follow.
- Recorded audience, current state, evidence, disposition, canonical future destination, and follow-up roadmap sessions for each route.
- Called out the concrete issues discovered during exploration, including mock/demo routes, missing admin child routes, missing settings child routes, the broken `/organizations` profile link target, and the intentionally transitional `/api` and `/analytics` public pages.
- Updated the planning index and marked Session 02 complete in `agent-context/todo.md`, while also backfilling Session 01 with the commit head that closed it.

#### Tests and Validation Notes
- Documentation-only change.
- Verified the route inventory covers the current `app/` surface list by comparing against the repo route list generated from `page.tsx` and `route.ts` files.
- Did not run `pnpm` validation because no runtime or code behavior changed.

#### Reflections
- The route tree is in better shape than a pure placeholder app, but it still mixes production surfaces with transitional or demo routes in ways that will confuse later implementation if we do not lock the IA soon.
- Capturing broken links in the inventory makes the next navigation and workspace sessions much more concrete than a generic “clean up IA” task would be.

#### Suggested Next Steps
- Define the target information architecture with explicit role-based workspaces and route mappings for the major current surfaces.
- Add a small number of migration-oriented TODO annotations to the highest-signal transitional route files so future refactors point back to the IA doc.

### session v34: Finalize planning doc set and backlog entrypoint
- timestamp: 2026-04-14T21:54:22Z
- agent: **Codex (GPT-5)**
- branch: **codex/wallet-production-readiness**
- head: 61161486db371eb19b91ffd4b434a17d8941ae38 - docs(agent-context): add architecture docs and sequenced roadmap

#### Objective
Complete Session 01 by tightening the planning artifacts in `agent-context/`, turning them into a canonical starting point for future implementation sessions, and removing stale or invalid planning references from the roadmap header.

#### Actions Taken
- Added `agent-context/README.md` as the planning index for the architecture docs, backlog, and session log.
- Added cross-links at the top of `backgrounder-for-agents.md`, `current-state-architecture.md`, and `target-state-architecture.md` so future agents can move between the planning docs without re-discovering them.
- Normalized the `agent-context/todo.md` execution-rules header so it now references the actual existing planning docs instead of the missing `everfund-target-state-site-architecture-and-technical-specs-for-agents.md` filename.
- Marked Session 01 complete in `agent-context/todo.md` and recorded the branch, timestamps, and intended session-log reference for this planning pass.

#### Tests and Validation Notes
- Documentation-only change.
- Verified the planning docs cross-link correctly by inspection.
- Did not run `pnpm` validation because no runtime or code behavior changed.

#### Reflections
- Having a dedicated `agent-context/README.md` makes the planning set much more approachable than relying on filenames alone.
- Removing the stale architecture-spec reference now should prevent future agents from wasting time hunting for a document that does not exist.

#### Suggested Next Steps
- Produce the route inventory for every `app/` surface, including broken-link and mock/demo routes.
- Follow that with the target information architecture so the next implementation sessions can operate against explicit route decisions instead of implicit assumptions.

### session v33: Document current and target architecture with execution roadmap
- timestamp: 2026-04-14T21:28:17Z
- agent: **Codex (GPT-5)**
- branch: **codex/wallet-production-readiness**
- head: e7c35322b6868443b958ed5da6b9c888fcb26729 - feat(observability): add payment flow event logging

#### Objective
Capture the repo's current architecture, define the intended target-state architecture, and replace the old ad hoc backlog with a sequenced execution roadmap that future agents can use to bring FundLoop from its current semi-finished state to an operational product.

#### Actions Taken
- Added `agent-context/current-state-architecture.md` to describe the repo's present subsystem boundaries, operational shape, and architectural hotspots.
- Added `agent-context/target-state-architecture.md` using the new backgrounder and current-state docs to define the intended future-state architecture, including CUBID-first identity, Edge Function boundaries, MCP workflows, multi-rail payments, and the monthly operating cadence.
- Preserved and included `agent-context/backgrounder-for-agents.md` as part of the architecture set used for planning.
- Rewrote `agent-context/todo.md` into a 45-session execution roadmap that moves logically from current-state to target-state.
- Added execution rules and per-session metadata placeholders to every roadmap item so future sessions can track branch, head, timing, and session-log references without turning the todo file into a work diary.

#### Tests and Validation Notes
- Documentation-only change.
- Did not run `pnpm` validation because no application code, schema, or runtime behavior changed.

#### Reflections
- Turning the repo notes into a structured architecture set plus a sequenced roadmap makes the project much more legible for future agents and should reduce repeated rediscovery work.
- The per-session metadata on every todo is a good safeguard because it makes it easier to keep execution hygiene visible without mixing status tracking into the session log itself.

#### Suggested Next Steps
- Start executing the new roadmap from the top, updating each session item as work begins and completes.
- Consider adding a small cross-reference appendix later that maps older completed backlog items into the new roadmap structure if reviewers want more historical continuity.

### session v32: Add wallet and payment flow observability
- timestamp: 2026-04-14T19:26:18Z
- agent: **Codex (GPT-5)**
- branch: **codex/wallet-production-readiness**
- head: b022077d0498d811864fa468a530b6a6d2a25fd9 - feat(e2e): add wallet and payment Playwright harness

#### Objective
Add internal, DB-backed observability for wallet connect, payment save, receipt recording, and admin confirmation failures so operators can investigate payment issues without relying on ad hoc console output or toasts.

#### Actions Taken
- Added a forward-only Supabase migration for `payment_flow_events`, including structured event fields, flow/stage/outcome constraints, and indexes for recent admin investigation paths.
- Added shared observability helpers under `lib/observability/` for event validation, metadata sanitization, best-effort server writes, event summaries, recent-failure queries, and attempt drill-downs.
- Added the authenticated browser ingestion route at `/api/internal/observability/payment-events` so client-side wallet and UI events can be recorded with server-derived actor identity and role context.
- Instrumented the project payment save, crypto receipt recording, wallet connect, and internal admin confirmation flows with correlated `attempt_id` values across client and server events.
- Added `/admin/payments/observability` plus a compact recent-failure card on `/admin/payments` so operators can review flow summaries, filter recent failures, and inspect a single attempt end to end.
- Updated `types/supabase.ts` and added focused coverage for the observability helpers, ingestion route, action-level instrumentation, admin observability page, and wallet-connect UI capture behavior.

#### Tests and Validation Notes
- Ran `pnpm dlx node@22.22.1 /opt/homebrew/bin/pnpm test`.
- Ran `pnpm dlx node@22.22.1 /opt/homebrew/bin/pnpm typecheck`.
- Ran `pnpm dlx node@22.22.1 /opt/homebrew/bin/pnpm check`.
- `lint`, `test`, `typecheck`, and `build` all passed in the supported Node 22 runtime.

#### Reflections
- Keeping observability best-effort was the right call because it let us add meaningful operator visibility without making payment actions or wallet interactions depend on the new event sink.
- Reusing the existing internal payments area for summaries and drill-downs makes the feature immediately useful to operators instead of burying it in a generic logging surface.

#### Suggested Next Steps
- Decide whether to add retention, archival, or periodic cleanup rules for `payment_flow_events` once production traffic patterns are known.
- Consider extending the same event model to onchain reconciliation runs and deployment-drift failures so operators can view the whole payment pipeline in one place.

### session v31: Add Playwright wallet and payment end-to-end harness
- timestamp: 2026-04-13T22:03:00Z
- agent: **Codex (GPT-5)**
- branch: **codex/wallet-production-readiness**
- head: 9f002f065509f5b22bc1f90cfd4055e1512ff6c7 - feat(payments): add onchain reconciliation worker flow

#### Objective
Add production-oriented Playwright coverage for the real wallet and payment flows, including remote-safe project payment coverage and an opt-in local wallet lane for true browser-driven contract submission and reconciliation.

#### Actions Taken
- Added the guarded non-production test login route at `/api/internal/e2e/login` plus shared e2e auth/secret helpers in `lib/e2e/config.ts`.
- Added the Playwright harness with separate `remote-safe` and `local-wallet` projects in `playwright.config.ts`, new root scripts in `package.json`, and Vitest exclusions so browser specs do not leak into the unit-test runner.
- Added remote fixture orchestration under `tests/e2e/support/`, including service-role fixture seeding/cleanup, browser login helpers, and an injected local EIP-1193 provider shim for the local wallet lane.
- Added the remote-safe browser specs for the real `/projects/[slug]/payments` flow and route-manager lifecycle, plus local-wallet specs for wallet connect, token approval, crypto deposit submission, reconciliation to `confirmed`, and mismatch failure/retry behavior.
- Added the local wallet execution helpers in `scripts/run-playwright-local-wallet.mjs` and `contracts/scripts/deploy-playwright-local-wallet.js`, plus manifest override support in `lib/onchain/runtime-config.ts` and sync-script overrides in `scripts/sync-chain-deployments.mjs`.
- Added stable `data-testid` hooks to the project payments UI, updated `.env.example`, `README.md`, and `agent-context/todo.md`, and added focused config coverage in `tests/e2e-config.test.ts`.

#### Tests and Validation Notes
- Ran `pnpm dlx node@22.22.1 /opt/homebrew/bin/pnpm check`.
- Ran `pnpm dlx node@22.22.1 /opt/homebrew/bin/pnpm exec playwright test --list`.
- `lint`, `test`, `typecheck`, and `build` all passed in the supported Node 22 runtime.
- Did not run the actual Playwright browser lanes end to end in this session because the required remote env and local Supabase/Hardhat runtime were not both provisioned here.

#### Reflections
- Splitting the browser coverage into `remote-safe` and `local-wallet` lanes keeps the shared-environment tests safe while still giving the repo a path to real wallet transaction coverage.
- The local manifest override approach was worth adding because it lets Playwright boot a real chain-aware app process without mutating tracked deployment manifests just for test setup.

#### Suggested Next Steps
- Provision the `remote-safe` lane in a stable non-production environment with the required service-role and e2e-secret env vars, then start running it regularly.
- Decide whether the local-wallet lane should be promoted into CI once local Supabase, Hardhat, and browser dependencies are provisioned reliably in automation.

### session v30: Add onchain payment reconciliation and replay tooling
- timestamp: 2026-04-13T21:32:05Z
- agent: **Codex (GPT-5)**
- branch: **codex/wallet-production-readiness**
- head: c0beb76a7c5e18f56c706b4045128d7eda937529 - build(runtime): restore Node 22 baseline for green checks

#### Objective
Advance crypto-submitted payment obligations out of `awaiting_confirmation` using verified chain state instead of manual internal-admin confirmation.

#### Actions Taken
- Added a forward-only Supabase migration for reconciliation-safe `onchain_payment_submissions`, including first-class `period_id`, immutable route snapshots, reconciliation metadata, constrained lifecycle statuses, and the single-unresolved-submission index.
- Extended the tracked wallet deployment manifests and runtime config with per-chain confirmation depth so reconciliation can apply environment-specific finality rules.
- Added the shared server-side reconciliation engine in `lib/onchain/payment-reconciliation.ts`, including receipt fetching, `Deposit` event matching, confirmation-depth handling, latest-submission queries, and `cron_logs` summaries for successful and failed runs.
- Added the protected cron route at `/api/internal/payments/reconcile-onchain`, the internal admin replay action, and the `/admin/payments/reconciliation` page with targeted replay controls.
- Reworked payment actions and project/admin payment UIs so crypto submissions persist immutable snapshots, failed submissions become retryable, crypto-submitted obligations no longer allow unsafe manual confirmation, and both admin and project surfaces show the latest onchain reconciliation status.
- Updated `.env.example`, `README.md`, `vitest.config.ts`, and `agent-context/todo.md`, and added focused tests for receipt evaluation, the cron endpoint, and the new runtime confirmation-depth behavior.

#### Tests and Validation Notes
- Ran `pnpm dlx node@22.22.1 /opt/homebrew/bin/pnpm check`.
- `lint`, `test`, `typecheck`, and `build` all passed in the supported Node 22 runtime.
- Added and passed focused coverage in `tests/payment-reconciliation.test.ts`, `tests/onchain-reconciliation-route.test.ts`, and `tests/runtime-config.test.ts`.
- Did not run a local `supabase db reset`, so the new migration was validated through application checks and tests rather than a live local Postgres replay.

#### Reflections
- Storing immutable route snapshots at submission time keeps reconciliation trustworthy even if deployment rows or route records are edited later.
- Splitting the worker into a shared server module plus cron/admin entrypoints made it easier to keep replay, scheduled execution, and UI visibility consistent.

#### Suggested Next Steps
- Run the new reconciliation migration against local Supabase once the local stack is available, then smoke test a full submit-and-reconcile flow with real seeded payment data.
- Continue the production-readiness queue with remote-backed wallet/payment end-to-end coverage and broader observability for payment and wallet failures.

### session v29: Restore the supported Node baseline and clear the last test warning
- timestamp: 2026-04-13T19:32:31Z
- agent: **Codex (GPT-5)**
- branch: **codex/wallet-production-readiness**
- head: 8cab2d4a8f6c13ede2c7f908071d7d07a142e168 - build(runtime): remove engine and build warnings

#### Objective
Eliminate the remaining Vitest warning and get the repo fully green by validating against the documented Node runtime instead of carrying a Node 25-only test runner warning.

#### Actions Taken
- Traced the remaining `--localstorage-file` warning to the Vitest `jsdom` test environment when running under Node `25.8.2`.
- Verified the warning disappears under Node `22.22.1`, which matches the repo’s intended `22.x` support line.
- Restored the repo baseline metadata to Node `22.x` in `package.json`, `.nvmrc`, `README.md`, and `AGENTS.md`.
- Updated `agent-context/todo.md` so the completed runtime/build cleanup item reflects the supported Node 22 baseline rather than the temporary Node 25 alignment.

#### Tests and Validation Notes
- Ran `pnpm dlx node@22.22.1 /opt/homebrew/bin/pnpm check`.
- `lint`, `test`, `typecheck`, and `build` all passed.
- The prior Vitest `--localstorage-file` warning no longer appeared in the passing run.

#### Reflections
- Restoring the repo to its documented runtime was safer than normalizing around a newer Node line that introduced toolchain noise the app itself did not require.
- The build-warning fixes from the previous session were still correct; the remaining issue was specifically the test runner behavior under Node 25.

#### Suggested Next Steps
- If this machine is going to keep working in this repo, switch the local shell/runtime back to Node `22.22.1` so ad hoc `pnpm` commands also stay warning-free without the explicit wrapper.
- Continue the production-readiness queue with onchain reconciliation/indexing and remote-backed wallet/payment end-to-end coverage.

### session v28: Remove runtime and build warning noise
- timestamp: 2026-04-13T19:25:53Z
- agent: **Codex (GPT-5)**
- branch: **codex/wallet-production-readiness**
- head: 09fd0017c4e8e2f68c401162f91c30289dd114c5 - feat(wallet): add deployment-safe runtime config

#### Objective
Clear the remaining warning noise by aligning the repo’s Node baseline with the active runtime, setting an explicit Turbopack root, and stopping the analytics charts from emitting Recharts sizing warnings during builds.

#### Actions Taken
- Updated `package.json`, `.nvmrc`, `README.md`, and `AGENTS.md` so the repo baseline now targets Node `25.8.2`, matching the runtime already used in this checkout and CI.
- Kept CI aligned through the existing `.nvmrc`-driven `actions/setup-node` workflow configuration.
- Added `turbopack.root` in `next.config.mjs` so Next stops inferring the workspace root from unrelated lockfiles outside the repo.
- Updated `app/analytics/page.tsx` and `components/analytics.tsx` to defer chart rendering until after mount and removed the extra `ResponsiveContainer` wrapper from the homepage analytics component, eliminating the Recharts container-size warnings during static generation.
- Marked the runtime/build paper-cut item complete in `agent-context/todo.md`.

#### Tests and Validation Notes
- Ran `pnpm build`.
- Ran `pnpm check`.
- Both passed.
- The previously tracked Node engine warning, Next workspace-root warning, and Recharts sizing warnings no longer appeared during the passing build/check runs.
- A separate Vitest runtime warning about `--localstorage-file` still appears during tests and was not part of this warning-cleanup pass.

#### Reflections
- Treating the warning cleanup as a real repo-baseline update was better than suppressing symptoms, because it aligned docs, local tooling, and CI around the same Node runtime.
- Deferring Recharts rendering until after mount is a pragmatic fix here because these analytics charts are decorative/operational dashboards rather than SEO-critical static content.

#### Suggested Next Steps
- If the Vitest `--localstorage-file` warning becomes distracting, trace it to the test runner or environment setup as a separate cleanup pass.
- Continue the production-readiness queue with onchain reconciliation/indexing and remote-backed payment E2E coverage.

### session v27: Add deployment-safe wallet configuration and audit tooling
- timestamp: 2026-04-13T19:22:52Z
- agent: **Codex (GPT-5)**
- branch: **codex/wallet-production-readiness**
- head: 2483be55352cecabffe96f5395d54cd8c80d92ac - feat(payments): add project crypto route management

#### Objective
Make chain deployment state and wallet runtime configuration production-safer by introducing tracked deployment manifests, explicit Supabase sync tooling, runtime validation, and an internal audit view.

#### Actions Taken
- Added tracked deployment manifests under `lib/onchain/deployments/` for `local`, `preview`, and `production`, plus a typed runtime config layer in `lib/onchain/runtime-config.ts`.
- Reworked `app/layout.tsx`, `components/web3-provider.tsx`, `lib/onchain/supported-chains.ts`, and the project crypto payment flows so wallet enablement, executable routes, and startup validation derive from the shared runtime config instead of ad hoc env checks.
- Expanded `app/actions/project-payment-actions.ts`, `components/project-crypto-route-manager.tsx`, and `components/project-crypto-payment-dialog.tsx` so misaligned crypto routes stay visible but cannot be treated as executable/default routes until the deployment rows are synced.
- Added the internal audit surface at `app/admin/payments/deployments/page.tsx`, linked it from the admin payments and dashboard screens, and added `lib/onchain/deployment-audit.ts` to summarize manifest-vs-database drift.
- Added the dry-run-first sync script `scripts/sync-chain-deployments.mjs`, updated `.env.example` and `README.md`, and refreshed `agent-context/todo.md` to reflect the newly completed wallet-readiness work.
- Added focused coverage in `tests/runtime-config.test.ts`, `tests/deployment-audit.test.ts`, `tests/sync-chain-deployments.test.ts`, and `tests/project-crypto-payment-dialog.test.tsx`.

#### Tests and Validation Notes
- Ran `pnpm test`.
- Ran `pnpm typecheck`.
- Ran `pnpm build`.
- Ran `pnpm check`.
- All of the above passed.
- Existing non-failing warnings remain for Node `25.8.2` vs the repo’s Node `22.x` target, Next workspace-root inference, and Recharts sizing during static generation.
- The deployment sync script was added but not run with `--apply`, so no Supabase rows were mutated during this session.

#### Reflections
- Keeping Supabase as the runtime source while adding tracked manifests and an explicit sync step keeps the payment surfaces compatible with the existing data model without leaving deployment addresses as tribal knowledge.
- Surfacing route availability directly in the project payment UI is safer than silently filtering everything out, because it makes deployment drift actionable for both admins and project teams.

#### Suggested Next Steps
- Address the remaining runtime and build warnings by aligning the repo’s documented Node baseline with the current runtime, setting `turbopack.root`, and fixing the Recharts container sizing on analytics-related pages.
- After that, tackle the onchain reconciliation/indexer work so `awaiting_confirmation` can advance based on verified chain state instead of staying operationally manual.

### session v26: Add post-onboarding crypto route management
- timestamp: 2026-04-13T13:40:00Z
- agent: **Codex (GPT-5)**
- branch: **codex/wallet-production-readiness**
- head: d427863fe0b0fcaa5db2c760dda78ce023ae5b5d - feat(payments): productionize payment operations

#### Objective
Implement the next wallet production-readiness step by letting project admins manage crypto payment routes after onboarding from the existing project payments screen.

#### Actions Taken
- Added `supabase/migrations/20260413140500_project_payment_method_sort_order.sql` to introduce `payment_methods.sort_order`, backfill deterministic order per project, index it, and sync project-level crypto defaults for existing data.
- Added `lib/project-crypto-routes.ts` plus `tests/project-crypto-routes.test.ts` to centralize and test route ordering, renumbering, move behavior, and default-promotion logic.
- Expanded `app/actions/project-payment-actions.ts` with project-admin route management actions for listing all managed crypto routes, creating routes, updating routes, moving routes up/down, and disabling or re-enabling routes with duplicate-route protection and generic-default sync.
- Added `components/project-crypto-route-manager.tsx` and integrated it into `app/projects/[slug]/payments/page.tsx` so the page now supports post-onboarding add/edit/default/disable/re-enable/reorder flows while keeping disabled routes visible.
- Updated the project payments page to derive the crypto payment dialog options from the managed-route state and removed the broken `/settings/payments` navigation target from `app/settings/page.tsx` by replacing it with a non-clickable placeholder card.
- Updated `types/supabase.ts` for the new `payment_methods.sort_order` field.

#### Tests and Validation Notes
- Ran `pnpm test`.
- Ran `pnpm typecheck`.
- Ran `pnpm check`.
- All of the above passed.
- Attempted `DOCKER_HOST=unix:///var/run/docker.sock supabase db reset`, but the local Supabase stack was not running.
- Attempted `DOCKER_HOST=unix:///var/run/docker.sock supabase start`, but local reset validation remained blocked because Docker could not resolve `public.ecr.aws` while pulling older Supabase images on this machine.
- Existing non-failing warnings remain for Node `25.8.2` vs the repo’s Node `22.x` target, Next workspace-root inference, and Recharts sizing during static generation.

#### Reflections
- Reusing the onboarding route editor model on the project payments page kept the new manager much easier to reason about than introducing a second payment-settings surface right away.
- Pulling ordering and promotion logic into a small shared helper made the behavior easier to test and reduced the risk of UI-only route ordering drift.

#### Suggested Next Steps
- Add inline integration tests or a browser smoke test for the new route manager flow once a stable local or remote-backed Playwright setup is available.
- Tackle the onchain reconciliation/indexer backlog next so routes and submissions can advance beyond `awaiting_confirmation` with real chain-based confirmation state.

### session v25: Commit production-backed payments and staged seed data
- timestamp: 2026-04-13T13:07:14Z
- agent: **Codex (GPT-5)**
- branch: **codex/wallet-production-readiness**
- head: 17357f0973ec19c045d9d063cf506e94d1667207 - Merge pull request #17 from FundLoop/codex/participation-marketing-refresh

#### Objective
Package the wallet production-readiness work into a reviewable commit and extend the canonical seed data with example project payments at different operational stages.

#### Actions Taken
- Prioritized the wallet-app production backlog in `agent-context/todo.md` around real payment operations, payment-method management, onchain reconciliation, deployment/env validation, end-to-end coverage, and observability.
- Added shared payment draft validation in `lib/payments.ts` with targeted coverage in `tests/payments.test.ts`.
- Reworked project payment actions so draft obligations persist to Supabase and internal admins can confirm real payment receipts while updating linked onchain submission records.
- Replaced the mock internal payments page with a server-backed admin console and updated the project payments UI to save real draft rows and stop implying project-side receipt confirmation authority.
- Seeded `supabase/seed.sql` with staged example payment records covering `draft`, `pending`, `awaiting_confirmation`, `confirmed`, and `failed`, then advanced the payment sequences to match.

#### Tests and Validation Notes
- Ran `pnpm check` before this commit package step; it passed.
- Added and passed the new `tests/payments.test.ts` cases as part of that run.
- Did a diff-level sanity check on `supabase/seed.sql` after inserting staged payment rows and updating the payment sequences.
- Existing non-failing warnings remain: Node `25.8.2` vs the repo’s Node `22.x` target, Next workspace-root inference, and Recharts sizing warnings during static generation.

#### Reflections
- This commit closes the most misleading production gap in the wallet app by replacing UI-only payment mutations with real server-backed paths.
- Seeding projects at different payment stages should make local QA and product conversations much easier, especially while the full reconciliation/indexer layer is still pending.

#### Suggested Next Steps
- Tackle project-side payment-method management next so teams can add, disable, reorder, and set default crypto routes after onboarding.
- After that, implement the onchain reconciliation/indexer layer so `awaiting_confirmation` can move forward based on verified chain data instead of manual ops alone.

### session v24: Start wallet production-readiness hardening
- timestamp: 2026-04-13T05:19:20Z
- agent: **Codex (GPT-5)**
- branch: **codex/wallet-production-readiness**
- head: 17357f0973ec19c045d9d063cf506e94d1667207 - Merge pull request #17 from FundLoop/codex/participation-marketing-refresh

#### Objective
Pull the latest `origin/dev`, audit the wallet and payments surfaces for production readiness, turn that audit into a prioritized repo backlog, and begin implementing the highest-value repo-backed gap.

#### Actions Taken
- Fast-forwarded `dev` to `origin/dev`, inventoried `agent-context/todo.md`, `agent-context/session-log.md`, wallet/onchain/payment codepaths, and the currently open GitHub issues.
- Ran the root quality gates and contract tests to ground the audit in the current repo state, then added a new top-level `Wallet App Production Readiness (Recommended Order)` section to `agent-context/todo.md`.
- Added `lib/payments.ts` plus `tests/payments.test.ts` to validate and cover project payment draft inputs before they are written.
- Reworked `app/actions/project-payment-actions.ts` so project admins can save real draft payment obligations, and internal admins can confirm real payment receipts while updating linked onchain submission records.
- Replaced the mock internal payments screen with a server-backed `app/admin/payments/page.tsx` plus `components/admin/payments-console.tsx`, and updated `app/projects/[slug]/payments/page.tsx` to save draft payments through the new server action while removing the misleading project-side self-confirmation path.

#### Tests and Validation Notes
- Ran `pnpm check`.
- `pnpm check` passed, including the new `tests/payments.test.ts` coverage.
- The repo still emits the existing non-failing warnings about Node `25.8.2` vs the documented Node `22.x` target, inferred Next workspace root selection, and Recharts width/height during static generation.

#### Reflections
- The highest-signal production gap was not styling or content but operational trust: several payment screens looked functional while still mutating only local UI state.
- Pulling confirmation authority into the internal admin path makes the wallet app safer to reason about, even before the onchain reconciliation/indexer layer lands.

#### Suggested Next Steps
- Continue the first backlog item by adding real project-side payment-method management outside onboarding.
- Follow with the onchain reconciliation/indexer pass so `awaiting_confirmation` can advance automatically based on verified chain data instead of manual ops only.
- Close the remaining launch paper cuts around Node 22 alignment, `turbopack.root`, and the Recharts build warnings after the payments backlog is stabilized.

### session v23: Address PR #17 public-site review comments
- timestamp: 2026-03-27T15:45:06Z
- agent: **Codex (GPT-5)**
- branch: **codex/participation-marketing-refresh**
- head: b54f8134cc2095a4dbff2fdb268dda3c8d89f6ad - feat(marketing): refresh public site and participation flow

#### Objective
Address the actionable PR review comments on the public-site marketing refresh by fixing the broken session-log frontmatter, restoring an old homepage deep link, tightening navigation behavior, and resolving the runtime/performance concerns in the new client-side components.

#### Actions Taken
- Moved the `session v22` entry out of the YAML frontmatter block in `agent-context/session-log.md` so the file metadata stays valid for tooling.
- Split the desktop navbar’s explore data from its top-level blog link in `components/navbar.tsx` so `Blog` no longer appears twice.
- Restored the homepage `/#project-signup` compatibility anchor in `app/page.tsx` so the pledge page CTA still lands on the project onboarding entry point.
- Added `overflow-y-auto` to the mobile navigation overlay in `components/mobile-menu.tsx` so the expanded menu remains reachable on shorter screens.
- Reworked `components/marketing/network-constellation.tsx` to use `requestAnimationFrame` plus CSS custom properties instead of React state updates on every pointer move.
- Moved AppKit initialization in `components/web3-provider.tsx` into an effect so render stays free of SDK side effects.

#### Tests and Validation Notes
- Ran `pnpm lint -- app/page.tsx components/navbar.tsx components/mobile-menu.tsx components/marketing/network-constellation.tsx components/web3-provider.tsx`.
- Ran `pnpm typecheck`.
- Ran `pnpm build`.
- Browser-smoke-tested `/#project-signup`, the desktop `Explore` dropdown, and the mobile navigation overlay with Playwright.
- Confirmed the mobile overlay now has `overflowY: auto` and a larger `scrollHeight` than `clientHeight`, making the lower links reachable on short screens.
- `pnpm build` still emitted the existing non-failing Recharts width/height warnings during analytics static generation.

#### Reflections
- Most of the review feedback was high-signal boundary work: preserving legacy deep links, keeping render paths pure, and making navigation robust across smaller screens.
- The constellation effect reads the same visually after the `requestAnimationFrame` change, which is a good sign that the lighter implementation path did not compromise the intended feel.

#### Suggested Next Steps
- Push this review-response commit to PR #17 and reply on each addressed thread with the concrete fix.
- If more interactions are added to the homepage hero, prefer CSS-variable or `requestAnimationFrame` driven motion before introducing new high-frequency React state updates.

### session v22: Reimagine the public marketing site and participant journey
- timestamp: 2026-03-27T15:07:38Z
- agent: **Codex (GPT-5)**
- branch: **codex/participation-marketing-refresh**
- head: dbbb921140a99d33ddede83b00c7d0b27c22f68b - feat(marketing): add ecosystem entry and refine brand badge

#### Objective
Refresh the FundLoop public site into a cohesive marketing surface, add a real participant explainer page, fix the public navigation and onboarding regressions surfaced during review, and package the updated landing experience for a PR into `dev`.

#### Actions Taken
- Rebuilt the public-page presentation system with new shared marketing primitives, refreshed typography and motion, and updated the homepage, about, pricing, FAQ, ecosystem, API, documentation, support, join, and use-case pages to match the new visual language.
- Updated the public navigation, footer, dropdowns, and mobile menu to support the redesigned site structure, improved responsive behavior on tablet/mobile breakpoints, and added a homepage CTA that can open the header use-case chooser directly.
- Added local-environment safety fallbacks so public pages and onboarding query params still produce usable UI when Supabase or wallet config is missing instead of failing silently or throwing.
- Added `I Am Human` to the ecosystem directory, curated the homepage ecosystem preview to highlight `SmarTrust`, `TCOIN`, and `Solar Village`, and strengthened the `Network Thesis` overlay so the constellation animation no longer collides with its copy.
- Added the new `/participation` page to explain the participant lifecycle, proof/privacy controls, and payout preferences, then repointed the homepage, support, FAQ, and shared resource navigation to that new explainer.

#### Tests and Validation Notes
- Ran `pnpm lint`.
- Ran `pnpm test`.
- Ran `pnpm typecheck`.
- Ran `pnpm build`.
- Ran `pnpm --dir contracts test`.
- Browser-smoke-tested the refreshed public pages, responsive breakpoints, onboarding query params, desktop/mobile use-case CTA behavior, and the new `/participation` page with Playwright against the local dev server.
- `pnpm build` still emitted the existing non-failing Recharts width/height warnings during static generation on analytics-related pages.

#### Reflections
- The redesign held together best once the public pages shared a single marketing layout system instead of each page evolving its own chrome and spacing rules.
- Treating the homepage ecosystem preview as an explicit editorial selection is safer than relying on array order, because content curation and directory order are different concerns.

#### Suggested Next Steps
- Review the new public copy as a group, especially the participant language and ecosystem/project descriptions, to make sure the tone matches FundLoop’s intended voice before wider launch.
- If more public-site polish is coming, consider a follow-up pass on the remaining non-marketing routes such as `/blog`, `/projects`, and `/users` so their local-env behavior and visual language match the refreshed shell more closely.

### session v21: Address PR #16 inline review comments
- timestamp: 2026-03-26T23:32:13Z
- agent: **Codex (GPT-5)**
- branch: **codex/marketing-nav-refresh**
- head: a35bb3d102aa5872440f1f96944a41a0f519f7ce - feat(marketing): add ecosystem entry and refine brand badge

#### Objective
Address the actionable inline review comments on PR #16 by fixing the hero timer ref typing, mobile menu composition, mobile About navigation regression, misleading project-detail edit affordances, and the zkAS role rekey migration robustness.

#### Actions Taken
- Updated `components/hero.tsx` so the timer helper types use mutable refs explicitly instead of readonly ref-object types.
- Split the mobile menu usage in `components/navbar.tsx` and `components/mobile-menu.tsx` so there is only one hamburger trigger, while the modal instance renders separately without duplicating the button.
- Restored `About FundLoop` to mobile navigation by passing a mobile-only nav list into the menu modal.
- Removed the misleading local-only edit controls from `components/project-detail-page.tsx` so the UI no longer implies persistence that does not exist yet.
- Updated `supabase/migrations/20260326124500_rekey_zkas_access_role.sql` to remap `organization_members.role_id` and `organization_invitations.role_id` before deleting the old legacy role row.

#### Tests and Validation Notes
- Ran `pnpm lint`.
- Ran `pnpm test`.
- Ran `pnpm typecheck`.
- Ran `pnpm build`.
- Ran `pnpm --dir contracts test`.
- `pnpm build` still emitted the existing Recharts static-generation width/height warnings while succeeding.

#### Reflections
- The review comments were accurate and mostly pointed to small boundary issues rather than architectural problems, so the safest path was to tighten each one directly instead of over-refactoring.
- Removing the project-detail edit affordances is a better temporary state than leaving a UI that claims success without any backend persistence.

#### Suggested Next Steps
- Push this follow-up commit to PR #16 and reply on the addressed threads with the specific fix.
- If editable project details are still wanted, implement them later through a real server action or route-backed update flow rather than local-only state.

---

### session v20: Add Solar Village and refine the FundLoop coming-soon badge
- timestamp: 2026-03-26T23:28:36Z
- agent: **Codex (GPT-5)**
- branch: **codex/marketing-nav-refresh**
- head: d9e447351babf62ca3b2c93fa0cbb3d8e75d2940 - feat(marketing): refresh navigation and public landing content

#### Objective
Apply the final small public-site follow-ups on top of the marketing refresh branch by adding Solar Village to the ecosystem page and refining the FundLoop wordmark’s coming-soon notice.

#### Actions Taken
- Added `Solar Village` to `app/ecosystem/page.tsx` with the supplied `https://solarvillage.xyz` URL and the requested description about carbon credits for off-grid solar projects in Africa.
- Adjusted the small `Coming Soon` notice in `components/navbar.tsx` to remove the pill treatment, switch to italic styling, and nudge it slightly down and to the right beside the FundLoop wordmark.

#### Tests and Validation Notes
- Ran `pnpm typecheck`.
- Ran `pnpm lint`.

#### Reflections
- Keeping this as a separate follow-up commit makes the already-open marketing PR easier to review because the late copy/content nits stay isolated from the larger navigation and hero changes.

#### Suggested Next Steps
- Push this follow-up commit to update PR #16.
- If more public-site polish is coming, consider batching additional micro-copy and badge-position tweaks together before the next push.

---

### session v19: Refresh marketing navigation, use-case pages, pricing, FAQ, and hero motion
- timestamp: 2026-03-26T23:03:13Z
- agent: **Codex (GPT-5)**
- branch: **codex/marketing-nav-refresh**
- head: 34a8709bef0bc7bd5e438aaeaec66730d47c78d1 - Tighten repo docs and CI coverage

#### Objective
Refresh the public-facing marketing surface by expanding the header navigation, adding use-case and pricing content, restructuring the FAQ, and making the homepage hero headline interactive and dynamic.

#### Actions Taken
- Added a new `Use Cases` navigation cluster, shared use-case content model, homepage use-case card section, and dedicated use-case landing pages under `app/use-cases/[slug]`.
- Expanded the header dropdowns so `Use Cases`, `Explore`, and `Resources` use larger structured panels and regrouped the desktop navigation into a more consistent pill-style unit.
- Added the new `Pricing` page, rewrote the `FAQ` page into audience-specific sections for projects, humans, and bots, and updated the copy to reflect the current FundLoop participation, privacy, and bot-pool model.
- Moved `About FundLoop` into the `Explore` dropdown and updated mobile navigation to surface the new use-case paths cleanly.
- Reworked the homepage hero title into a rotating interactive widget with a stepped slowdown curve, click-to-flip behavior, and a subtle hover expansion.

#### Tests and Validation Notes
- Ran `pnpm lint`.
- Ran `pnpm test`.
- Ran `pnpm typecheck`.
- Ran `pnpm build`.
- Ran `pnpm --dir contracts test`.
- The build completed successfully and still emitted the existing Recharts static-generation width/height warnings.

#### Reflections
- The nav changes were most stable once the marketing content was centralized in a shared use-case model instead of duplicating labels and descriptions across the header, homepage, and standalone pages.
- The interactive hero ended up needing a cleaner timer model than the initial effect-only approach so manual flips and scheduled flips would stay in sync without React hook warnings.

#### Suggested Next Steps
- Smoke test the refreshed public pages in a browser to make sure the hero interaction and the larger dropdowns feel right at real viewport sizes.
- Decide whether the rotating hero title should eventually have a visible affordance or hint text, or remain a hidden interactive detail.

---

### session v18: Tighten repo cleanup docs and CI coverage
- timestamp: 2026-03-26T19:56:33Z
- agent: **Codex (GPT-5)**
- branch: **dev**
- head: b89156eeb01887f5c0cb0064488cff33ae158078 - Fix local zkAS bootstrap and project detail route

#### Objective
Run the full repo-cleanup pass, then tighten the contributor docs and pull-request CI coverage where the audit found concrete gaps.

#### Actions Taken
- Audited the repo baseline across `README.md`, `AGENTS.md`, licensing, session-log discipline, `agent-context/`, and `.github/workflows/ci.yml`.
- Updated `README.md` to reflect the repaired local Supabase reset path, document the `contracts/` Hardhat workspace, and describe the newer zkAS/admin surfaces and `zkas/engine`.
- Updated `AGENTS.md` so agents are explicitly instructed to inventory `agent-context/todo.md`, larger planned work in `agent-context/`, and GitHub issues at the start of a session.
- Extended the CI workflow to run `pnpm --dir contracts test` in addition to the root app validation steps.

#### Tests and Validation Notes
- Ran `pnpm --dir contracts test`.

#### Reflections
- The repo baseline was already reasonably healthy, so the highest-signal cleanup was to fix stale operational guidance and make CI match the real multi-surface contract of the codebase.

#### Suggested Next Steps
- Push this cleanup commit when ready so the README, AGENTS guidance, and PR CI all stay aligned.

---

### session v17: Fix zkAS audit logging, local Supabase bootstrap, and project detail rendering
- timestamp: 2026-03-26T17:43:35Z
- agent: **Codex (GPT-5)**
- branch: **dev**
- head: 4c2f3270a6a87a59b36cb1735a37bdde0d603300 - Merge pull request #15 from FundLoop/codex/zkActivitySum-v1

#### Objective
Fix the zkAS audit-trigger failure, make the tracked local Supabase reset path reproducible from migrations plus seed data, and resolve the stalled `/projects/harvest` page.

#### Actions Taken
- Added a forward migration to replace the shared `public.log_changes()` implementation so it no longer assumes an `updated_by` column and correctly logs `INSERT`, `UPDATE`, and `DELETE` events.
- Added follow-up migrations to rekey zkAS-added reference rows away from low seed-owned ids so local resets do not collide with seeded `ref_roles`, `ref_payment_methods`, and `ref_notification_types` rows.
- Converted the tracked `supabase/seed.sql` from dump-style `COPY ... FROM stdin` blocks into replayable `INSERT` statements, added the required `OVERRIDING SYSTEM VALUE` for `monthly_network_stats`, and removed stale `ref_chains` seed data that no longer matched the evolved schema.
- Reworked `app/projects/[slug]/page.tsx` into a server-rendered route that loads project, participant, membership, organization, and financial data on the server and passes it into the new `components/project-detail-page.tsx` client view.
- Hardened the project detail route so public pages render cleanly for signed-out users instead of throwing on the normal server-side `Auth session missing!` case.

#### Tests and Validation Notes
- Ran `DOCKER_HOST=unix:///var/run/docker.sock supabase db reset`.
- Ran `pnpm lint`.
- Ran `pnpm typecheck`.
- Ran `pnpm build`.
- Ran `pnpm test`.
- Verified `public.log_changes()` with a temporary table that had no `updated_by` column and confirmed logged `INSERT`, `UPDATE`, and `DELETE` audit rows.
- Smoke tested `http://localhost:3000/projects/harvest` and `http://localhost:3000/projects` with Playwright against local Supabase-backed app execution.

#### Reflections
- The bootstrap issue was really a chain of small schema/seed drifts rather than one bug, so fixing it cleanly required stabilizing the seed format and reserving high ids for migration-owned reference rows.
- Moving the project detail page to a server-first data path fixed the user-visible loading failure and also removed a fragile client-side dependency on auth/session state during first render.

#### Suggested Next Steps
- Decide whether to also quiet the local Reown/AppKit warnings by adding a valid local `NEXT_PUBLIC_REOWN_PROJECT_ID` or guarding that initialization path in development.
- If we want broader regression coverage, run a fuller authenticated Playwright pass across admin and onboarding flows on top of this now-clean local Supabase reset path.

---

### session v16: Address PR #15 zkAS review comments
- timestamp: 2026-03-26T10:02:10-04:00
- agent: **Codex (GPT-5)**
- branch: **codex/zkActivitySum-v1**
- head: ed0a9140cc1a3a8fa227989a8a2c24b27a97ed7c - Ignore zkAS Python cache files

#### Objective
Address the open review comments on PR #15 by hardening the zkAS migrations and server actions, restoring lost onboarding RPC safeguards, and removing the user-facing service-role dependency.

#### Actions Taken
- Removed the incompatible zkAS audit trigger wiring from the new zkAS migrations and added an RLS policy so published runs can be selected safely by users through the standard server client.
- Switched `app/settings/zkas/page.tsx` from the service-role client to the cookie-aware server Supabase client.
- Restored the onboarding publish RPC to the validated `plpgsql` form with `SECURITY DEFINER` plus `SET search_path = public`, while keeping the separate grant migration in place.
- Hardened zkAS server actions so revocation is scoped to admins on the target project and dataset approval requires a validated dataset state server-side.
- Removed the unused duplicate-key accumulator from dataset validation and fixed the Python runner indentation issue flagged in review.
- Updated `agent-context/session-log.md` to capture this review-response commit.

#### Tests and Validation Notes
- Planned validation after these fixes: `pnpm check` plus `python3 -m unittest discover -s tests -t .` in `zkas/engine`.

#### Reflections
- The review comments aligned closely with the issues surfaced in the earlier local smoke test, especially around the audit trigger assumptions, which made the hardening path straightforward once the comments were enumerated precisely.

#### Suggested Next Steps
- Push the review-response commit, reply on each addressed PR thread with the specific fix, and re-run the PR checks.

---

### session v15: Remove generated Python bytecode from zkAS engine commit
- timestamp: 2026-03-26T01:53:17-04:00
- agent: **Codex (GPT-5)**
- branch: **codex/zkActivitySum-v1**
- head: a786deda8115ea8d02911777c01c79f0c2884356 - Add zkAS control plane and admin workflows

#### Objective
Clean up generated Python bytecode files that were accidentally staged from the local zkAS engine test run and prevent them from reappearing in future commits.

#### Actions Taken
- Removed the tracked `__pycache__` and `.pyc` files under `zkas/engine`.
- Updated `.gitignore` to ignore Python bytecode and cache directories across the repo.
- Updated `agent-context/session-log.md` so this cleanup commit is recorded separately from the main zkAS feature commit.

#### Tests and Validation Notes
- No behavior changed; this is a repository hygiene cleanup.
- The earlier full validation pass for the zkAS feature commit remained green before this follow-up cleanup.

#### Reflections
- Running the Python engine tests before staging is correct, but without Python ignore rules the generated cache files are easy to pick up in a large `git add -A` batch.

#### Suggested Next Steps
- Keep the follow-up commit paired with the main zkAS feature PR so reviewers can ignore it as packaging cleanup.

---

### session v14: Add zkAS control plane, admin surfaces, and local runner
- timestamp: 2026-03-26T01:45:57-04:00
- agent: **Codex (GPT-5)**
- branch: **codex/zkActivitySum-v1**
- head: 6e00edf5dd45f8f6fe76fe4b43c2c6d12398f476 - Add FundLoop and zkActivitySum docs

#### Objective
Implement the zkActivitySum v1 control plane across schema, validation, server actions, admin and project UI, publication flow, analytics, documentation, and the local Python runner, then smoke test it against local Supabase with Playwright.

#### Actions Taken
- Added the zkAS database layer with the new base and admin/publication migrations, regenerated Supabase types, and introduced the server-only admin Supabase client.
- Implemented the zkAS TypeScript domain under `lib/zkas/` and `types/zkas.ts`, including auth guards, validation, manifest/result handling, storage, runner integration, publication materialization, and dataset guidance constants.
- Added the operator, superadmin, project-manager, and user-facing routes under `app/admin/zkas`, `app/admin/superadmin/zkas`, `app/projects/[slug]/zkas`, and `app/settings/zkas`, plus supporting UI badges and navigation links from existing admin, project, and settings pages.
- Added the local Python engine and runner wiring under `zkas/engine` and `zkas/runner`, along with validation and engine tests.
- Added the zkAS engineering documentation set under `docs/engineering/2026-03-26-zkas-v1-control-plane/`.
- Performed a real local smoke test using a disposable local Supabase stack plus Playwright, covering manager assignment, dataset upload, operator approval, run creation and execution, superadmin verification and publication, project analytics, and user-visible published results.
- Updated the older onboarding publish migration split so the local Supabase CLI could replay that function definition cleanly during local testing.

#### Tests and Validation Notes
- Ran `pnpm lint`.
- Ran `pnpm test`.
- Ran `pnpm typecheck`.
- Ran `pnpm build`.
- Ran `pnpm check`.
- Ran `python3 -m unittest discover -s tests -t .` in `zkas/engine`.
- Ran local Supabase plus Playwright smoke coverage across the new zkAS feature set and representative existing app surfaces.
- The smoke test exposed a real schema issue: zkAS audit triggers currently call the generic `log_changes()` path on tables that do not have `updated_by`, so local mutation testing required disabling those zkAS audit triggers in the disposable local database only.

#### Reflections
- The zkAS feature is now broad enough that the key risk has shifted from implementation completeness to operational hardening, especially around local database reproducibility and generic audit infrastructure assumptions.
- The Playwright pass was valuable because it confirmed the full publish flow and analytics materialization, while also surfacing the trigger defect and the separate `/projects/harvest` loading issue that unit and build checks would not catch.

#### Suggested Next Steps
- Fix the zkAS audit trigger wiring so mutations succeed without local DB workarounds.
- Make the local Supabase reset path fully reproducible from tracked migrations and seed assets alone.
- Investigate the `/projects/harvest` route staying on its loading skeleton under the local smoke-test setup.

---

### session v13: Add FundLoop and zkActivitySum documentation set
- timestamp: 2026-03-25T19:29:00-04:00
- agent: **Codex (GPT-5)**
- branch: **codex/dev**
- head: 3c10b943a776ea190aacf4cf28d23e732e9d7d71 - Add onchain payment period tags to crypto flows

#### Objective
Add the current working documentation set under `docs/` and record the scope of that addition in the repo session log.

#### Actions Taken
- Added the zkActivitySum first-cut engineering docs covering product requirements, design inputs, minimal dataset validation, and monthly operator runs.
- Added `docs/engineering/2026-04-16-migration.md` to capture migration-oriented engineering notes.
- Added FundLoop narrative docs under `docs/whitepaper-and-grant-proposals/`, including the whitepaper and two grant proposal drafts.
- Updated `agent-context/session-log.md` so this documentation-only commit is described alongside the repo history.

#### Tests and Validation Notes
- No runtime validation was required; this is a documentation-only change.
- Verified the worktree contents before commit so the staged set is limited to the new docs and this session-log entry.

#### Reflections
- The added materials span product definition, engineering planning, fundraising narrative, and migration notes, so recording them as one documentation set is clearer than treating each file as an isolated artifact.

#### Suggested Next Steps
- Review the new docs for any sensitive or outdated planning assumptions before broader distribution.
- Decide which of these drafts should remain internal working docs versus being promoted into polished public-facing materials.

---

### session v12: Add onchain payment period tags to crypto flows
- timestamp: 2026-03-25T09:20:00-04:00
- agent: **Codex (GPT-5)**
- branch: **codex/dev**
- head: 075da373d006c2ff50f17d08b403894eeb598a95 - Add organized repo backlog todo

#### Objective
Extend the crypto intake contract and project payments UI to carry an explicit month-based `periodId`, while preserving a sentinel value for current or unspecified payments.

#### Actions Taken
- Updated `contracts/src/FundLoopIntake.sol` so `depositNative` and `depositToken` both accept `periodId`, emit it in the `Deposit` event, and reject values outside `0..12`.
- Updated `lib/onchain/fundloop-intake-abi.ts` so the app-side ABI matches the new contract interface.
- Updated `contracts/test/FundLoopIntake.js` to cover the new event shape, the `0` sentinel case, and invalid-period rejection.
- Updated `components/project-crypto-payment-dialog.tsx` to derive a default period tag from `payment.period_end`, expose an explicit period-tag selector in the UI, and pass the selected tag into contract writes and receipt recording.
- Updated `app/projects/[slug]/payments/page.tsx` to preview the onchain period tag for payment rows and show it in the payment history UI.
- Updated `app/actions/project-payment-actions.ts` to validate `periodId`, store it in onchain submission metadata, and include it in the payment note.

#### Tests and Validation Notes
- `pnpm --dir contracts test`
- `pnpm eslint app/actions/project-payment-actions.ts 'app/projects/[slug]/payments/page.tsx' components/project-crypto-payment-dialog.tsx contracts/test/FundLoopIntake.js lib/onchain/fundloop-intake-abi.ts`
- `pnpm typecheck`

#### Reflections
- Solidity cannot encode a literal `null`, so the cleanest mapping for “current / unspecified” is the explicit onchain sentinel `periodId = 0`.
- The UI needed to make the tag visible and overridable; deriving it silently from `period_end` was not enough once the contract interface became explicit.

#### Suggested Next Steps
- Persist the selected `periodId` in a first-class database field if it becomes important for reporting or reconciliation beyond submission metadata.
- Revisit whether month-only tagging is sufficient once invoice-level or year-sensitive accounting requirements become clearer.

---

### session v11: Add and reorganize repo backlog TODO
- timestamp: 2026-03-24T17:05:00-04:00
- agent: **Codex (GPT-5)**
- branch: **codex/dev**
- head: 0e266d73889f9b8ee14e0b803c3bbd3cc1e1da1b - Merge pull request #14 from FundLoop/codex/crypto-payment-flows

#### Objective
Capture the current post-migration and post-crypto backlog in a dedicated repo TODO file and reorganize it into logical workstreams without losing detail.

#### Actions Taken
- Added `agent-context/todo.md` as a dedicated backlog file for repo follow-up work.
- Recorded the immediate operational next steps for remote Supabase alignment, contract deployment, environment configuration, and remote-backed verification.
- Added the previously deferred scope items from recent sessions, including deposit-address fallback, auto-sweeps, indexer/accounting, fiat rails, quote/oracle support, and broader payment-management follow-ups.
- Added the broader product and platform ideas discussed in-session, including chatbot, landing-page segmentation, Cubid integration, zk calculator work, bot participation, MCP/SDK work, architecture docs, notifications, off-ramps, and graph-based people views.
- Reorganized the full list into logical categories so the backlog is easier to navigate and execute without collapsing the underlying items.

#### Tests and Validation Notes
- No runtime validation needed; this was a repo-context and planning artifact update.

#### Reflections
- The backlog had become useful but hard to scan once immediate next steps, deferred-scope items, and broader product ideas were mixed together.
- Separating these into workstreams should make future execution and prioritization easier without losing the historical intent behind the deferred decisions.

#### Suggested Next Steps
- Keep `agent-context/todo.md` current as larger features land or are intentionally deferred.
- Split the backlog into now/next/later priorities once the remote Supabase state and crypto deployment work is unblocked.

---

### session v10: Address PR #14 crypto review findings
- timestamp: 2026-03-24T16:28:00-04:00
- agent: **Codex (GPT-5)**
- branch: **codex/crypto-payment-flows**
- head: 17dac232e2e4d2f3ef1cceca29526e4ef6e0e3ca - Fix CI pnpm setup

#### Objective
Resolve the inline review findings on PR #14 by hardening the crypto-collection migration, tightening crypto payment route queries, and preventing unsafe onchain payment submission behavior.

#### Actions Taken
- Changed the crypto migration so legacy `payment_methods` default to `deposit_address` mode instead of being blanket-backfilled to `contract`.
- Replaced the duplicate `payment_methods` updated-at trigger with the original trigger name, avoiding two update triggers on the same table.
- Changed seeded chain intake contracts to become inactive when real contract or treasury addresses are missing, instead of exposing zero-address routes as active.
- Tightened `listProjectCryptoPaymentMethods` so it only returns fully-related contract routes with non-null chain, asset, and intake-contract references.
- Hardened `recordOnchainPaymentSubmission` so it errors if `awaiting_confirmation` is missing and updates `payments.payment_method_id` to the selected route’s underlying reference method.
- Updated the project payments page to skip malformed crypto routes defensively if any incomplete rows ever slip through.
- Added stablecoin gating in the crypto payment dialog so fiat-denominated payment amounts are not converted directly into volatile/native token units without a quote step.

#### Tests and Validation Notes
- `pnpm check`
- `pnpm --dir contracts test`

#### Reflections
- The most severe risk was semantic rather than syntactic: a fiat-denominated payment amount looked type-safe in code but was unsafe to send directly onchain without quote-based conversion.
- Tightening the migration and the route query together is better than relying on either one alone.

#### Suggested Next Steps
- Push this follow-up to PR #14, rerun CI, and resolve the review threads.
- Add explicit quote/oracle support before enabling direct native-asset payments in the crypto dialog.

---

### session v9: Fix CI runner pnpm setup for PR validation
- timestamp: 2026-03-24T16:12:00-04:00
- agent: **Codex (GPT-5)**
- branch: **codex/crypto-payment-flows**
- head: 0f59b5feceb090e56dd687ad1b85120b4779bdd9 - Clarify PR workflow for dev and main

#### Objective
Repair the GitHub Actions validation workflow for PR #14 so the CI job can reach install, lint, test, typecheck, and build instead of failing during tool setup.

#### Actions Taken
- Inspected the failed `CI / validate` runs and confirmed both failures stopped in the `Setup Node.js` step before dependency installation.
- Identified the root cause: `actions/setup-node` was configured with `cache: pnpm`, but the runner had not installed `pnpm` yet, so the action could not find the executable.
- Updated `.github/workflows/ci.yml` to install pnpm explicitly with `pnpm/action-setup@v4` before the `setup-node` step.
- Kept the fix narrow so the PR only changes CI bootstrap behavior and does not touch product code.

#### Tests and Validation Notes
- `pnpm check`
- `pnpm --dir contracts test`

#### Reflections
- This was a CI bootstrap issue rather than a product regression. The workflow was asking GitHub Actions to cache a tool that the runner did not yet have on PATH.

#### Suggested Next Steps
- Push this workflow fix to PR #14 and confirm the `CI / validate` job reruns successfully.

---

### session v8: Integrate crypto payment methods into onboarding and project payments
- timestamp: 2026-03-24T14:44:59-04:00
- agent: **Codex (GPT-5)**
- branch: **codex/dev**
- head: ecfc6c93923f5d9c7e5386412e676b4a0c29ab91 - Add crypto collection schema and contracts

#### Objective
Connect the new crypto collection foundation to the product so projects can configure curated crypto routes during onboarding and submit tagged onchain payments from the project payments page.

#### Actions Taken
- Extended the project onboarding payload model to support multiple crypto payment methods with one default route.
- Updated the project onboarding flow to load active chains, assets, and intake contracts from Supabase and let a project optionally configure multiple curated crypto routes.
- Updated project onboarding publish logic so configured crypto routes are written into `payment_methods` using the new `crypto_contract` method and chain-specific references.
- Added server actions for listing a project’s allowed crypto routes and for recording submitted onchain payment receipts into `onchain_payment_submissions`.
- Added an onchain config layer, a wallet provider, and a crypto payment dialog that handles wallet connection, network switching, allowance checks, token approval, contract writes, and receipt persistence.
- Integrated the crypto route list and payment dialog into the project payments page and wrapped the app layout with the new web3 provider.

#### Tests and Validation Notes
- `pnpm lint` passed
- `pnpm typecheck` passed
- `pnpm test` passed
- `pnpm build` passed

#### Reflections
- The current implementation is a clean V1: smart-contract intake is live in the codebase, while accounting, sweeps, and fiat remain properly deferred instead of being half-built.

#### Suggested Next Steps
- Deploy chain-specific intake contracts and populate the real contract and treasury addresses in environment configuration.
- Push the Supabase migration to the linked remote project before relying on the new payment-method and submission tables remotely.
- Add e2e coverage for the wallet connect and onchain payment paths once deployment addresses are available.

---

### session v7: Address PR #12 review comments on the pre-crypto branch
- timestamp: 2026-03-24T16:45:00-04:00
- agent: **Codex (GPT-5)**
- branch: **codex/dev**
- head: 5b37589d0aa56a9ef90df9bffe16056a67196e22 - Clean up and enrich seed data

#### Objective
Apply only the outstanding review-comment fixes for PR #12 on top of the pre-crypto branch, while preserving the later footer, onboarding follow-up, and crypto work on a separate branch.

#### Actions Taken
- Created and preserved a separate `codex/crypto-payment-flows` branch for the later work, then reset `codex/dev` back to `5b37589` so the PR #12 fixup commit could stay narrowly scoped.
- Restored the expected throw-on-error semantics in `lib/db-utils.ts` so admin callers do not silently receive `{ data, error }` objects where they previously expected exceptions.
- Fixed the organizations admin table relation loading with explicit foreign-key hints and safer object/array handling, and guarded the empty `.in()` path in the users admin table.
- Removed the no-op modal `aria-describedby` prop, tightened dialog header structure, and changed support form submissions to persist a nullable IP address instead of the literal string `"unknown"`.
- Replaced duplicated local `buildUrl` helpers with a shared `lib/url.ts` helper and updated the onboarding entry points to use it.
- Cleaned the contributor docs by replacing absolute local README links and updating the contribution notes to include `pnpm typecheck` as a required validation step.
- Reworked project-onboarding publish to enforce a minimum pledge percentage and use a new transactional database function for atomic organization/project/member/category creation.
- Optimized team-member project search so it only loads the specific user rows needed for contact resolution instead of selecting the entire users table.
- Added forward-only Supabase migrations for the atomic publish RPC and nullable support-request IP addresses, and updated `types/supabase.ts` accordingly.

#### Tests and Validation Notes
- `pnpm eslint README.md CONTRIBUTING.md lib/db-utils.ts components/admin/organizations-table.tsx components/admin/users-table.tsx components/modal.tsx app/support/page.tsx components/user-signup.tsx components/project-signup.tsx components/hero.tsx app/join/page.tsx components/onboarding-modal-manager.tsx app/actions/onboarding-actions.ts`
- `pnpm typecheck`
- `pnpm build`

#### Reflections
- Resetting the branch before applying the fixes kept the PR history clean, but it also meant the review fixes had to be reapplied against the older pre-crypto file state.
- The atomic publish RPC meaningfully reduces the chance of partially-created org/project records during onboarding failures.

#### Suggested Next Steps
- Push this review-fix branch and resolve the corresponding GitHub review threads on PR #12.
- Keep later feature work isolated on `codex/crypto-payment-flows` until it is ready for its own PR.

---

### session v6: Add crypto collection rails foundation
- timestamp: 2026-03-24T14:44:39-04:00
- agent: **Codex (GPT-5)**
- branch: **codex/dev**
- head: b03d23342b344b2a3e3228737cd12283865dbdbe - Add explainer blog links for projects

#### Objective
Create the foundation for an EVM-first crypto contribution flow with shared intake contracts, curated chain/token metadata, and repo-level tooling support.

#### Actions Taken
- Added a `contracts/` workspace package with the `FundLoopIntake` contract, a mock ERC-20 for tests, a Hardhat config, and a deploy script.
- Added contract tests covering native deposits, ERC-20 deposits, and unsupported-token rejection.
- Expanded the root workspace and dependencies to support viem, wagmi, Reown AppKit, and the contracts package.
- Added a forward-only Supabase migration that introduces chain metadata, chain assets, intake contracts, extended `payment_methods`, and `onchain_payment_submissions`.
- Updated the tracked Supabase type surface to reflect the new crypto collection schema.
- Extended `.env.example` and `.gitignore` for the new onchain and contracts workflow.

#### Tests and Validation Notes
- `pnpm --dir contracts test` passed
- Repo-wide `lint`, `typecheck`, `test`, and `build` also passed during this implementation pass

#### Reflections
- Splitting the contracts/schema work from the app integration keeps the storage model and onchain interface easy to review independently.

#### Suggested Next Steps
- Wire the new schema into project onboarding and the project payments page so configured crypto methods can actually be used.

---

### session v5: Add blog entry points from the project explainer section
- timestamp: 2026-03-24T14:44:23-04:00
- agent: **Codex (GPT-5)**
- branch: **codex/dev**
- head: 69d5eef7df520dd7cdcbb7c9bbe90e9ec2dcd5d4 - Tighten footer layout

#### Objective
Improve the explainer section for projects by linking deeper educational content and fixing the primary project signup CTA.

#### Actions Taken
- Added a `Read More` button under the “Is FundLoop For My Project?” heading that links to the project-benefits blog post with an origin query parameter.
- Added a `Read More` button under the “How Much Will The Users Of Our Project Get?” heading that links to the citizen-salary explainer with an origin query parameter.
- Corrected the adjacent `Add My Project` CTA so it routes into the project onboarding flow.

#### Tests and Validation Notes
- Verified the component change with local ESLint during the same working session.

#### Reflections
- The explainer section is more useful when it immediately connects broad claims to concrete long-form explanations.

#### Suggested Next Steps
- Revisit the linked blog posts and confirm their copy still matches the current onboarding and project contribution flow.

---

### session v4: Tighten footer layout across medium and large screens
- timestamp: 2026-03-24T14:43:58-04:00
- agent: **Codex (GPT-5)**
- branch: **codex/dev**
- head: 5b37589d0aa56a9ef90df9bffe16056a67196e22 - Clean up and enrich seed data

#### Objective
Reduce the visual bulk of the footer, prevent overflow on medium and large screens, and move the temporary links to the far right.

#### Actions Taken
- Reduced the outer padding and tightened the footer grid spacing.
- Decreased logo, icon, heading, and body text sizing so the footer fits more comfortably on medium-width layouts.
- Rebalanced the column spans across the main footer grid to better use the available width.
- Moved the `Temporary` column to the far-right side of the footer layout.

#### Tests and Validation Notes
- Verified the footer component change with local linting during the current working session.

#### Reflections
- The footer was structurally fine, but the original spacing and type scale made it feel larger than the rest of the page.

#### Suggested Next Steps
- Review the footer visually in-browser on tablet and desktop breakpoints after the next UI pass.

### session v3: Upgrade stack, canonicalize Supabase, and implement resumable onboarding
- timestamp: 2026-03-24T10:14:56-04:00
- agent: **Codex (GPT-5)**
- branch: **codex/dev**
- head: b047f558c9241aff27b197a6ef5af28825759edd - Remove legacy database directory

#### Objective
Bring the repo out of mothballs by upgrading the stack, making `supabase/` the canonical database source, and replacing the shallow signup flows with a resumable onboarding system for people and projects.

#### Actions Taken
- Upgraded the application stack to current major versions, including Next 16, Tailwind 4, Vitest 4, Zod 4, React Day Picker 9, Vaul 1, and the modern Supabase SSR flow.
- Reworked repo tooling so `lint`, `typecheck`, `test`, and `build` are real gates again, and added CI plus baseline repo artifacts like `CONTRIBUTING.md`, `.editorconfig`, and `.nvmrc`.
- Pulled the linked remote schema into `supabase/migrations/20260324035725_initial_remote.sql`, cleaned that migration so it replays locally, and regenerated `types/supabase.ts`.
- Rebuilt `supabase/seed.sql` as a smaller `public`-only seed and removed the legacy `database/` directory from the repo.
- Added onboarding draft tables and user lifecycle changes in `supabase/migrations/20260324213000_resumable_onboarding.sql`, including owner-only RLS and inactive-by-default auth-created users.
- Added server-side onboarding actions, shared onboarding payload/screen models, and route-driven modal orchestration for user and project onboarding.
- Replaced the old user/project signup flows with multi-screen onboarding UIs that autosave, branch between individual/team-member/create-project paths, and show split-screen live previews on the form-heavy steps.
- Updated navbar, auth redirects, join flow, and my-profile handling so inactive users are treated as still onboarding and are routed back into the draft flow instead of falling into a broken profile state.
- Ran local verification with `pnpm lint`, `pnpm typecheck`, `pnpm test`, and `pnpm build`, and used Playwright to confirm the new query-driven onboarding modal behavior in the local app.
- Linked this working copy to the FundLoop Supabase project and repaired the remote migration history so the pulled baseline migration is marked as applied.

#### Tests and Validation Notes
- `pnpm lint` passed
- `pnpm typecheck` passed
- `pnpm test` passed
- `pnpm build` passed
- Playwright confirmed the onboarding modal opens via query params, renders the intro/auth shell, and closes back to the base route
- Local Supabase migration replay succeeded through both tracked migrations after cleaning dump-specific commands from the pulled baseline migration

#### Reflections
- The repo is now structurally in a much better place, but remote database drift is still the main operational blocker.
- The onboarding code is implemented, but full remote-backed draft testing is blocked until the onboarding migration is pushed to the linked Supabase project.
- The local seed still needs a follow-up cleanup because the current `COPY ... FROM stdin` dump format is not replaying cleanly through the local Supabase seed runner.

#### Suggested Next Steps
- Push `20260324213000_resumable_onboarding.sql` to the linked remote project once the remote Postgres password is available to the Supabase CLI.
- Re-run authenticated Playwright coverage against the real remote-backed onboarding flow after that push.
- Convert `supabase/seed.sql` into a replayable seed format for local Supabase resets.

---

### session v1: Remove legacy database directory
- timestamp: 2026-03-24T10:00:00-04:00
- agent: **Codex (GPT-5)**
- branch: **codex/dev**
- head: b047f558c9241aff27b197a6ef5af28825759edd - Remove legacy database directory

#### Objective
Set up the project with a supabase database managed through git migrations.

#### Actions Taken
- Pull in the latest supabase schema from remote, 
- Pull in the current data from remote to form, prune unnccessary files and create a new seed.sql file
- Added this file (session-log.md) and created backdated entries for the last few sessionss

#### Tests and Validation Notes
- Tested locally by spinning up local supabase in docker

#### Reflections
- TBD

#### Suggested Next Steps
- Push the updated migrations to remote

---

### session v1: Remove legacy database directory
- timestamp: 2026-03-24T01:18:00-04:00 (backdated)
- agent: **Codex (GPT-5)**
- branch: **codex/dev**
- head: 1a3449e8f695e270f86a3bb860720e3eb3689e95 - Add FundLoop app summary PDF

#### Objective
Seed this session log file

#### Actions Taken
- Created this session log file

#### Tests and Validation Notes
- None

#### Reflections
- Agents are now ready to get started

#### Suggested Next Steps
- Get this project out of mothbag and start implementing

---

### session v0: Seed this session log file
- timestamp: 2026-03-24T09:45:00-04:00
- agent: **Codex (GPT-5)**
- branch: **codex/dev**
- head: 2d644f90c30e4377e56057d5830eded3d538a048 - Merge pull request #8 from FundLoop/codex/inventory-project-related-pages-and-find-improvements

#### Objective
Seed this session log file

#### Actions Taken
- Created this session log file

#### Tests and Validation Notes
- None

#### Reflections
- Agents are now ready to get started

#### Suggested Next Steps
1. Get this project out of mothbag and start implementing

---

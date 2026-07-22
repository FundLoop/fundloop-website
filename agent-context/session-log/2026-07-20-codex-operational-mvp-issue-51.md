## 2026-07-20T17:45:18.000Z - Issue 61 project commitment contract

- agent: Codex
- branch: codex/operational-mvp-issue-51
- head: 1fa5205
- summary: Started the Operational MVP implementation branch and completed issue #61 by adding canonical `projects.default_reporting_currency_code`, extending the project onboarding publish RPC/command payload to persist a stable reporting currency alongside `payment_percentage`, exposing the canonical commitment fields through the founder workspace read model, and adding focused onboarding/founder tests.
- validation: `pnpm test tests/project-onboarding-commands.test.ts tests/founder-workspace.test.ts` passed. `pnpm typecheck` passed. `pnpm lint` passed. `pnpm test` passed. `pnpm build` passed. Local Supabase startup applied the new migration during schema initialization, but the stack failed final health because `supabase_storage_fundloop` became unhealthy, so post-start DB query smoke could not be completed.
- follow-ups: Validate the migration again once local Supabase storage health is repaired; then continue issue #62 to surface the canonical commitment fields in founder UI.

## 2026-07-20T17:51:26.000Z - Issue 62 founder commitment readiness UI

- agent: Codex
- branch: codex/operational-mvp-issue-51
- head: 17780ec
- summary: Completed issue #62 by surfacing canonical contribution commitment percentage and default reporting currency in the founder home project cards, founder project index cards, and per-project setup readiness card. Added localized labels and missing-gap copy in English, French, and Spanish.
- validation: `pnpm test tests/founder-workspace.test.ts` passed. `pnpm typecheck` passed. `pnpm lint` passed. `pnpm test` passed. `pnpm build` passed. Browser/manual smoke was not completed because local Supabase remains unhealthy after the storage container failure recorded in the prior entry.
- follow-ups: Repair local Supabase storage health before visual/browser smoke; continue issue #63 for seed and smoke coverage.

## 2026-07-20T17:57:41.000Z - Issue 63 commitment readiness seed and smoke coverage

- agent: Codex
- branch: codex/operational-mvp-issue-51
- head: 03f723e
- summary: Completed issue #63 by making the curated local project seed fixtures explicit about default reporting currency, adding automated seed assertions for contribution commitment readiness, and documenting the seeded founder/project route smoke contract in local seed and operational MVP docs.
- validation: `pnpm test tests/local-public-seed.test.ts tests/founder-workspace.test.ts` passed. `git diff --check` passed. `pnpm lint` passed. `pnpm test` passed. `pnpm typecheck` passed. `supabase start` succeeded after applying migrations and seeding data. Local DB smoke query confirmed `civic-mesh` has `payment_percentage=1.00`, `default_reporting_currency_code=USD`, and `maya@fundloop.example.com` is an admin participant.
- follow-ups: Continue into Goal #53 contribution submission now that project commitment readiness is seeded and testable.

## 2026-07-20T19:10:08.000Z - Issue 64 monthly contribution submission command

- agent: Codex
- branch: codex/operational-mvp-issue-51
- head: 7ca0cc9
- summary: Completed issue #64 by adding the `project_monthly_contribution_submissions` schema, typed `project-monthly-contribution-submit` Edge Function contract/adapters, reusable server-side contribution command, Supabase Edge Function wrapper, generated type updates, and engineering documentation for the new founder monthly contribution write path.
- validation: `pnpm test tests/project-monthly-contribution-submit-contract.test.ts tests/project-monthly-contribution-command.test.ts tests/project-monthly-contribution-adapter.test.ts` passed. `pnpm typecheck` passed. `deno cache --config supabase/functions/deno.json supabase/functions/project-monthly-contribution-submit/index.ts` passed. `git diff --check` passed. `pnpm lint` passed. `pnpm test` passed with 81 files and 380 tests. `pnpm build` passed. `supabase start` applied `20260720190000_project_monthly_contribution_submissions.sql` and seeded data, but final local stack health failed on `supabase_storage_fundloop`; the CLI stopped the containers after the health failure.
- follow-ups: Continue #65 for the founder UI on top of the new command. Re-check local Supabase storage health before any route-level browser smoke that depends on a running local stack.

## 2026-07-20T19:36:49.000Z - Issue 65 founder contribution submission UI

- agent: Codex
- branch: codex/operational-mvp-issue-51
- head: b39e842
- summary: Completed issue #65 by extending the founder workspace read model with open monthly cycles, latest monthly contribution submission state, and explicit submission blockers; added a localized founder monthly contribution form that calls the browser Edge Function adapter from issue #64; and wired it into the per-project contribution workflow page with current-record and readiness copy.
- validation: `pnpm test tests/founder-workspace.test.ts tests/project-monthly-contribution-form.test.tsx` passed. `pnpm typecheck` passed. `pnpm lint` passed. `pnpm test` passed with 82 files and 384 tests. `pnpm build` passed. `git diff --check` passed. Manual route smoke was blocked because `supabase start` could not bind FundLoop DB port `54322`; the Supabase CLI reported the competing local project `smartrust_monorepo` and suggested stopping it.
- follow-ups: Run signed-in founder browser smoke for `/en/founder/projects/<slug>/contributions` once the competing local Supabase stack is stopped or FundLoop is started on a free port; continue issue #66 to expose contribution submission state in operator cycle readiness.

## 2026-07-20T19:50:55.000Z - Issue 66 operator contribution readiness

- agent: Codex
- branch: codex/operational-mvp-issue-51
- head: c184607
- summary: Completed issue #66 by adding project monthly contribution submission readiness to the operator cycle overview and prep review models, surfacing submitted/expected/missing contribution state in the admin cycle table and prep workspace, adding a deterministic 2026-05 Civic Mesh contribution submission seed fixture, and documenting the current readiness boundary before lock-manifest inclusion.
- validation: `pnpm test tests/monthly-cycles.test.ts tests/monthly-cycle-prep.test.ts tests/local-public-seed.test.ts` passed. `pnpm typecheck` passed. `git diff --check` passed. `pnpm lint` passed. `pnpm test` passed with 82 files and 387 tests. `pnpm build` passed. Local `supabase db reset` completed successfully. A direct local DB query confirmed open cycle `2026-05` and the seeded `civic-mesh` submission with USD 125000.00 and calculated contribution 1250.00. Authenticated Playwright smoke with the seeded Maya operator verified `/en/admin/cycles` shows `1 of 14` submissions and `/en/admin/cycles/2026-05/prep` shows `1/14`; screenshots were saved to `/tmp/fundloop-issue66-admin-cycles.png` and `/tmp/fundloop-issue66-cycle-prep.png`.
- follow-ups: Goal #56 should add contribution submissions to the immutable lock manifest; until then, operator readiness treats submission state as live review context.

## 2026-07-20T22:18:21.000Z - Issue 67 attribution dataset command and schema

- agent: Codex
- branch: codex/operational-mvp-issue-51
- head: efcad7e
- summary: Implemented issue #67 by adding the MVP project attribution dataset and row schema, typed `project-attribution-dataset-submit` Edge Function contract/adapters, reusable server-side attribution submission command, Supabase Edge Function wrapper, generated type updates, focused contract/command/adapter tests, and engineering documentation for the raw-row MVP plus future zkActivitySum proof metadata boundary.
- validation: `pnpm test tests/project-attribution-dataset-submit-contract.test.ts tests/project-attribution-command.test.ts tests/project-attribution-dataset-adapter.test.ts` passed with 3 files and 10 tests. `pnpm dlx node@22.22.1 /opt/homebrew/bin/pnpm typecheck` passed. `deno cache --config supabase/functions/deno.json supabase/functions/project-attribution-dataset-submit/index.ts` passed. `git diff --check` passed. `pnpm dlx node@22.22.1 /opt/homebrew/bin/pnpm lint` passed. `pnpm dlx node@22.22.1 /opt/homebrew/bin/pnpm test` passed with 85 files and 397 tests. `pnpm dlx node@22.22.1 /opt/homebrew/bin/pnpm build` passed.
- follow-ups: After #67 validation, run `$issue-validator`; #68 should build founder UI on top of the browser adapter, and #69 should add internal-operator approval/readiness.

## 2026-07-21T03:39:10.000Z - Issue 68 founder attribution submission UI

- agent: Codex
- branch: codex/operational-mvp-issue-51
- head: 0410658
- summary: Implemented issue #68 by extending the founder workspace read model with MVP attribution dataset state, adding the localized founder attribution row form, wiring `/[locale]/founder/projects/[slug]/attribution` to the browser Edge Function adapter, surfacing scoped CUBID/user-resolution guidance, and documenting the route/workflow update.
- validation: `pnpm test tests/founder-workspace.test.ts tests/project-attribution-dataset-form.test.tsx tests/project-attribution-dataset-adapter.test.ts tests/project-attribution-dataset-submit-contract.test.ts` passed with 4 files and 17 tests. `pnpm dlx node@22.22.1 /opt/homebrew/bin/pnpm lint` passed. `pnpm dlx node@22.22.1 /opt/homebrew/bin/pnpm typecheck` passed. `pnpm dlx node@22.22.1 /opt/homebrew/bin/pnpm test` passed with 86 files and 401 tests. `pnpm dlx node@22.22.1 /opt/homebrew/bin/pnpm build` passed. Local Supabase was started on the FundLoop 5532x port block with storage/studio/meta/vector/imgproxy excluded after those nonessential services failed health; `supabase migration up` was current. Authenticated Playwright smoke with the seeded Maya founder loaded `/en/founder/projects/civic-mesh/attribution` with 0 console errors and confirmed the open-cycle form is enabled. Screenshots were saved to `output/playwright/issue-68-founder-attribution-light.png` and `output/playwright/issue-68-founder-attribution-dark.png`. A real browser submit reached `project-attribution-dataset-submit` and received the typed `function_not_configured` envelope because the local Edge Runtime was not populated with Supabase function env secrets; component/adapter/command tests cover the successful submission behavior.
- follow-ups: Configure local Edge Function env secrets for future browser-level write smokes, or use `supabase functions serve --env-file` with a matching app URL during validation. Continue #69 to add internal-operator attribution approval/readiness.

## 2026-07-21T03:59:21.000Z - Issue 69 operator attribution approval readiness

- agent: Codex
- branch: codex/operational-mvp-issue-51
- head: c74f421
- summary: Implemented issue #69 by adding the `project-attribution-dataset-review` Edge Function contract, browser/server adapters, server-side internal-operator review command, Supabase Edge Function wrapper, and migration extending monthly-cycle event types. The admin cycle overview and prep workspace now surface MVP attribution dataset counts, and the prep page lets internal operators approve submitted datasets or reject them with a required reason while recording `monthly_cycle_events` audit entries.
- validation: `pnpm test tests/project-attribution-dataset-review-contract.test.ts tests/project-attribution-review-command.test.ts tests/monthly-cycle-prep.test.ts tests/monthly-cycles.test.ts tests/project-attribution-dataset-review-actions.test.tsx` passed with 5 files and 26 tests. `pnpm typecheck` passed. `deno cache --config supabase/functions/deno.json supabase/functions/project-attribution-dataset-review/index.ts` passed. `pnpm lint` passed. `pnpm test` passed with 89 files and 414 tests. `pnpm build` passed. `supabase migration up` applied `20260721034000_project_attribution_review_events.sql` locally. `pnpm dlx node@22.22.1 /opt/homebrew/bin/pnpm lint && pnpm dlx node@22.22.1 /opt/homebrew/bin/pnpm test && pnpm dlx node@22.22.1 /opt/homebrew/bin/pnpm typecheck && pnpm dlx node@22.22.1 /opt/homebrew/bin/pnpm build` passed. Authenticated Playwright smoke with seeded Maya operator and local operator allowlists loaded `/en/admin/cycles/2026-05/prep`, verified the prep, MVP attribution approval, and contribution readiness sections, and saved light/dark screenshots to `output/playwright/issue-69-admin-prep-light.png` and `output/playwright/issue-69-admin-prep-dark.png`.
- follow-ups: Later lock/calculation issues should consume only approved MVP attribution datasets from the monthly-cycle linkage and include them in deterministic manifests/artifacts. Local Edge Function env secrets remain needed for browser-level mutation smokes against served functions.

## 2026-07-21T04:17:54.000Z - Issue 70 user asset preference command and schema

- agent: Codex
- branch: codex/operational-mvp-issue-51
- head: f5d7662
- summary: Implemented issue #70 by adding the `user_asset_preference_type` enum and `user_asset_preferences` table with user-owned RLS, generated Supabase type coverage, the typed `user-asset-preferences-update` Edge Function contract/adapters, the server-side replace/reorder command, the Supabase Edge Function wrapper, and docs clarifying that asset preferences are settlement-planning choices rather than payout destinations.
- validation: `supabase migration up` applied `20260721040500_user_asset_preferences.sql` locally. `pnpm test tests/user-asset-preferences-update-contract.test.ts tests/user-asset-preferences-update-adapter.test.ts tests/user-asset-preferences-command.test.ts` passed with 3 files and 9 tests. `pnpm typecheck` passed. `deno cache --config supabase/functions/deno.json supabase/functions/user-asset-preferences-update/index.ts` passed. `pnpm lint` passed. `pnpm build` passed. An initial parallel `pnpm test` run had one unrelated timeout in `tests/admin-identity-page.test.tsx`; rerunning that focused test passed, and a subsequent full `pnpm test` passed with 92 files and 423 tests. `pnpm dlx node@22.22.1 /opt/homebrew/bin/pnpm lint && pnpm dlx node@22.22.1 /opt/homebrew/bin/pnpm test && pnpm dlx node@22.22.1 /opt/homebrew/bin/pnpm typecheck && pnpm dlx node@22.22.1 /opt/homebrew/bin/pnpm build` passed.
- follow-ups: Issue #71 should build the workspace/account and earnings UI on top of the browser adapter. Issue #72 should seed deterministic stablecoin, fiat, project-token, and reject-all scenarios and expose safe readiness summaries for lock/prep consumers.

## 2026-07-21T04:26:38.000Z - Issue 70 atomic asset preference replacement fix

- agent: Codex
- branch: codex/operational-mvp-issue-51
- head: a2ae22f
- summary: Addressed the independent validator finding on issue #70 by replacing the client-side delete-then-insert preference update sequence with a Postgres `replace_user_asset_preferences_atomic` RPC. The command now performs one database-side atomic replacement so failed inserts, such as invalid project-token project references, roll back without clearing an existing preference set.
- validation: `pnpm test tests/user-asset-preferences-command.test.ts tests/user-asset-preferences-update-contract.test.ts tests/user-asset-preferences-update-adapter.test.ts` passed with 3 files and 9 tests. `pnpm typecheck` passed. `deno cache --config supabase/functions/deno.json supabase/functions/user-asset-preferences-update/index.ts` passed. `pnpm lint` passed. `pnpm test` passed with 92 files and 423 tests. `pnpm build` passed. `pnpm dlx node@22.22.1 /opt/homebrew/bin/pnpm lint && pnpm dlx node@22.22.1 /opt/homebrew/bin/pnpm test && pnpm dlx node@22.22.1 /opt/homebrew/bin/pnpm typecheck && pnpm dlx node@22.22.1 /opt/homebrew/bin/pnpm build` passed. `supabase db reset` replayed all local migrations and seed data successfully, including `20260721040500_user_asset_preferences.sql`.
- follow-ups: Rerun independent validation for #70. If it passes, move #70 to In Review and continue #71 on top of the browser adapter and persisted preference model.

## 2026-07-21T06:29:20.000Z - Issue 71 asset priority workspace UI

- agent: Codex
- branch: codex/operational-mvp-issue-51
- head: 3ddf709
- summary: Implemented issue #71 by adding the user asset preference readiness read model, an editable asset-priority panel in the shared account hub, account/founder account wiring, and earnings-workspace readiness copy that distinguishes future settlement preferences from payout destinations and current credited earnings. Added English, French, and Spanish labels plus docs clarifying the UI boundary.
- validation: `pnpm test tests/user-asset-preferences-readiness.test.ts tests/asset-preferences-panel.test.tsx tests/account-settings-panel.test.tsx tests/user-earnings-workspace.test.ts` passed with 4 files and 8 tests. `pnpm lint` passed. `pnpm test` passed with 94 files and 427 tests. `pnpm typecheck` passed. `pnpm build` passed. `pnpm dlx node@22.22.1 /opt/homebrew/bin/pnpm lint && pnpm dlx node@22.22.1 /opt/homebrew/bin/pnpm test && pnpm dlx node@22.22.1 /opt/homebrew/bin/pnpm typecheck && pnpm dlx node@22.22.1 /opt/homebrew/bin/pnpm build` passed. Local Supabase was restarted on the FundLoop 5532x port block after the storage container reported unhealthy, and Next was restarted with local E2E login support. Playwright CLI smoke signed in as `maya@fundloop.example.com`, loaded `/en/workspace/account`, clicked the Asset priorities tab, verified the future-settlement/no-payout copy, loaded `/en/workspace/earnings`, verified the same readiness copy, and saved screenshots to ignored local artifacts `output/playwright/issue-71-workspace-account-asset-priorities-light.png` and `output/playwright/issue-71-workspace-earnings-light.png`.
- follow-ups: Run independent validation for #71. Issue #72 should add deterministic seed/readiness scenarios for stablecoin, fiat, project-token, and reject-all behavior so cycle lock/prep consumers can inspect preference states without relying only on live user edits.

## 2026-07-21T06:45:16.000Z - Issue 72 asset priority readiness and seed coverage

- agent: Codex
- branch: codex/operational-mvp-issue-51
- head: dd7c8a8
- summary: Implemented issue #72 by adding safe asset-preference readiness to the user workspace read model and main workspace home, adding operator monthly-cycle prep readiness summaries for custom/default preferences and project-token rejection warnings, and seeding deterministic local preference scenarios for stablecoin-first, fiat-first, project-token-first, and reject-all-token users. Updated local seed docs and focused tests so MVP smoke has stable preference fixtures without exposing private payout destinations or changing earnings formulas.
- validation: `pnpm test tests/user-workspace.test.ts tests/monthly-cycle-prep.test.ts tests/local-public-seed.test.ts` passed with 3 files and 25 tests. `pnpm typecheck` passed. `pnpm lint` passed. `supabase db reset` replayed all local migrations and seed data successfully, including the new `user_asset_preferences` fixture rows. `pnpm test` passed with 94 files and 431 tests. `pnpm build` passed. `pnpm dlx node@22.22.1 /opt/homebrew/bin/pnpm check` passed. Authenticated browser smoke with seeded Maya verified `/en/workspace` renders the future settlement priorities card and `/en/admin/cycles/2026-05/prep` renders asset priority readiness plus Jonah as the reject-all-token warning fixture, with zero console errors; screenshots were saved to ignored local artifacts under `output/playwright/`.
- follow-ups: Run independent validation for #72. Once #70-#72 are all in review, validate Goal #55 as the user asset-priority goal and continue into Goal #56 lock-manifest/calculation inputs.

## 2026-07-21T06:53:14.000Z - Issue 73 MVP lock manifest inputs

- agent: Codex
- branch: codex/operational-mvp-issue-51
- head: 8b7b666
- summary: Implemented issue #73 by extending `monthly-cycle-lock` to freeze MVP-native inputs in `locked_manifest.mvp_inputs`: monthly contribution submissions, approved attribution datasets, raw attribution rows with scoped CUBID identity references, eligible user summaries, destination-free asset-preference summaries, per-section counts, and deterministic checksums. The existing lock manifest still preserves confirmed payments, onchain reconciliation, CUBID snapshots, zkAS inputs, unresolved-onchain override behavior, and optimistic open-cycle locking.
- validation: `pnpm test tests/monthly-cycle-lock-command.test.ts tests/monthly-cycle-prep.test.ts` passed with 2 files and 17 tests. `pnpm typecheck` passed. `deno cache --config supabase/functions/deno.json supabase/functions/monthly-cycle-lock/index.ts` passed. `git diff --check` passed. `pnpm dlx node@22.22.1 /opt/homebrew/bin/pnpm check` passed with 94 files and 432 tests. No UI smoke was required for this manifest-only command slice.
- follow-ups: Run independent validation for #73. Issue #74 should use these manifest sections to harden normal-lock blocking and operator override copy for missing MVP inputs.

## 2026-07-21T07:00:22.000Z - Issue 74 MVP lock blocking and prep warnings

- agent: Codex
- branch: codex/operational-mvp-issue-51
- head: 2856073
- summary: Implemented issue #74 by extending `monthly-cycle-lock` with a dedicated `overrideRequiredInputs` contract flag, blocking normal lock when committed projects are missing contribution submissions, approved attribution datasets, resolved attribution rows, linked/verified CUBID users, or identity snapshots, and preserving an audited override path that requires a reason. The lock button now shows separate override copy for unresolved onchain submissions versus missing MVP inputs, and prep emits non-blocking informational warnings for users still on default asset priorities or rejecting project tokens.
- validation: `pnpm test tests/monthly-cycle-lock-contract.test.ts tests/monthly-cycle-lock-command.test.ts tests/monthly-cycle-lock-button.test.tsx tests/monthly-cycle-prep.test.ts` passed with 4 files and 26 tests. `pnpm typecheck` passed after JSON-safe blocker metadata normalization. `deno cache --config supabase/functions/deno.json supabase/functions/monthly-cycle-lock/index.ts` passed. `git diff --check` passed. `pnpm dlx node@22.22.1 /opt/homebrew/bin/pnpm check` passed with 94 files and 434 tests. UI override behavior was covered by component tests; no live browser mutation smoke was run because local browser Edge Function invocation is not configured as a reliable write smoke in this branch.
- follow-ups: Run independent validation for #74. Issue #75 should add deterministic fixture/docs coverage for the final Goal #56 lock-manifest contract before moving the goal to review.

## 2026-07-21T07:03:39.000Z - Issue 75 MVP lock fixture and docs

- agent: Codex
- branch: codex/operational-mvp-issue-51
- head: 3006a66
- summary: Implemented issue #75 by tightening the deterministic MVP lock fixture assertions in `tests/monthly-cycle-lock-command.test.ts` and documenting the calculation handoff shape in `docs/engineering/monthly-cycles.md` and `docs/engineering/operational-mvp.md`. The docs now state that Goal #57 must consume `locked_manifest.mvp_inputs` rather than live mutable rows and list the contribution, attribution, eligible-user, identity, asset-preference, count, and checksum sections.
- validation: `pnpm test tests/monthly-cycle-lock-command.test.ts` passed with 1 file and 7 tests. `git diff --check` passed. `pnpm typecheck` passed. `pnpm dlx node@22.22.1 /opt/homebrew/bin/pnpm check` passed with 94 files and 434 tests. No browser smoke was required because this was a docs/test fixture handoff with no runtime UI changes.
- follow-ups: Run independent validation for #75, then validate Goal #56 as complete enough to move to In Review. Goal #57 can begin deterministic capped equalization calculation from the documented locked manifest input shape.

## 2026-07-21T07:17:26.000Z - Issue 76 pure MVP distribution calculator

- agent: Codex
- branch: codex/operational-mvp-issue-51
- head: faa0fca
- summary: Implemented issue #76 by adding a runtime-agnostic pure MVP distribution calculator for locked monthly-cycle inputs. The calculator derives confirmed contribution pools, gates attribution on scoped CUBID and linked/verified eligibility, computes raw project entitlements, baselines, capped global equalization, deterministic USD rounding, preference-based asset fills, returned future-pool rows, warnings, invariant checks, and a stable result hash.
- validation: `pnpm test tests/mvp-distribution-calculator.test.ts` passed with 1 file and 6 tests. `pnpm typecheck` passed. `pnpm lint` passed. `pnpm dlx node@22.22.1 /opt/homebrew/bin/pnpm check` passed with 95 files and 440 tests. No browser smoke was required because #76 is a pure calculation module with no UI or persistence behavior.
- follow-ups: Run independent validation for #76. Issue #77 should wire this calculator into calculation packaging, artifact storage, and persisted monthly-cycle result rows without recalculating the allocation policy differently.

## 2026-07-21T07:26:38.000Z - Issue 77 MVP calculation artifacts and persisted results

- agent: Codex
- branch: codex/operational-mvp-issue-51
- head: a47906e
- summary: Implemented issue #77 by wiring the pure MVP allocator into `monthly-cycle-calculation-package`. The command now consumes `locked_manifest.mvp_inputs`, uploads package, run-manifest, and run-result artifacts, creates a completed but unverified zkAS run, persists per-user `zkas_run_results`, and stores MVP project/user raw entitlements, selected asset fills, and returned future-pool rows in new cycle-linked detail tables.
- validation: `pnpm test tests/monthly-cycle-calculation-package-command.test.ts tests/monthly-cycle-calculation-package-contract.test.ts tests/mvp-distribution-calculator.test.ts` passed with 3 files and 13 tests. `pnpm typecheck` passed. `pnpm lint` passed. `deno cache --config supabase/functions/deno.json supabase/functions/monthly-cycle-calculation-package/index.ts` passed. `supabase migration up` applied `20260721072000_mvp_allocation_results.sql` locally. `pnpm dlx node@22.22.1 /opt/homebrew/bin/pnpm check` passed with 95 files and 440 tests.
- follow-ups: Run independent validation for #77. Issue #78 should expose these calculated outputs in the operator verification workspace and clearly label them as calculated, not verified, credited, or paid.

## 2026-07-21T07:33:09.000Z - Issue 78 operator calculated-result review UI

- agent: Codex
- branch: codex/operational-mvp-issue-51
- head: 70a70bc
- summary: Implemented issue #78 by extending the monthly-cycle verification read model with calculated MVP allocator outputs and adding a read-only operator review panel to `/admin/cycles/[cycleKey]/verification`. Operators can now inspect user result rows, raw project/user entitlements, source breakdowns, selected asset fills, returned future-pool rows, and result artifact metadata with clear copy that results are calculated but not verified, credited, paid, or transferable.
- validation: `pnpm test tests/monthly-cycle-verification.test.ts tests/monthly-cycle-calculation-package-command.test.ts tests/monthly-cycle-calculation-package-contract.test.ts` passed with 3 files and 14 tests. `pnpm typecheck` passed. `pnpm lint` passed. `pnpm dlx node@22.22.1 /opt/homebrew/bin/pnpm check` passed with 95 files and 440 tests. A direct unauthenticated route request to `/en/admin/cycles/2026-05/verification` confirmed the operator auth guard; authenticated browser smoke was blocked because the running local Next process has E2E login enabled with a secret not present in tracked env, and the secret was not inspected or scraped.
- follow-ups: Run independent validation for #78, then validate Goal #57. The next MVP goal should cover verification/approval-to-bookkeeping credit creation without claiming actual payouts.

## 2026-07-21T12:34:08.000Z - Issue 79 MVP verification integrity checks

- agent: Codex
- branch: codex/operational-mvp-issue-51
- head: 0069d7d
- summary: Implemented issue #79 by adding a runtime-safe monthly-cycle verification integrity checker and wiring it into both the operator verification read model and `monthly-cycle-verification-review` command. The verified path now blocks on missing lock/artifact data, invalid MVP contribution or attribution inputs, ineligible CUBID users, negative result rows, cap violations, allocated-plus-returned pool mismatches, asset-fill over-allocation, and source supply reconciliation gaps before advancing a cycle to `verification`.
- validation: `pnpm test tests/monthly-cycle-verification.test.ts` passed with 9 tests. `pnpm typecheck` passed. `pnpm lint` passed. `deno cache --config supabase/functions/deno.json supabase/functions/monthly-cycle-verification-review/index.ts` passed. `pnpm check` passed with lint, 95 test files / 442 tests, typecheck, and Next build.
- follow-ups: Run independent validation for #79. Issue #80 should harden approval as the bookkeeping-credit handoff without creating credits yet.

## 2026-07-21T12:42:00.000Z - Issue 79 validator fix for asset preferences

- agent: Codex
- branch: codex/operational-mvp-issue-51
- head: fddef44
- summary: Addressed the independent validator finding on issue #79 by extending the MVP verification integrity checker to compare persisted asset fills against locked custom asset preferences. Verification now blocks rejected-asset fills, fills without an accepted locked preference, and preference-rank mismatches while still allowing users on default preferences to be governed by supply and reconciliation checks.
- validation: `pnpm test tests/monthly-cycle-verification.test.ts` passed with 10 tests. `pnpm typecheck` passed. `pnpm lint` passed. `deno cache --config supabase/functions/deno.json supabase/functions/monthly-cycle-verification-review/index.ts` passed. `pnpm check` passed with lint, 95 test files / 443 tests, typecheck, and Next build.
- follow-ups: Rerun independent validation for #79. If it passes, move #79 to In Review and continue issue #80.

## 2026-07-21T12:50:04.000Z - Issue 80 approval bookkeeping handoff

- agent: Codex
- branch: codex/operational-mvp-issue-51
- head: b21b25d
- summary: Implemented issue #80 by hardening `monthly-cycle-approval` so approval reuses the MVP verification integrity checker before advancing a cycle, audits integrity failures, and records successful approval as a bookkeeping-credit creation handoff rather than a payout/distribution execution. Updated the operator verification page and action copy to say approval unlocks bookkeeping credits and does not transfer funds or mark users as paid.
- validation: `pnpm test tests/monthly-cycle-verification.test.ts tests/monthly-cycle-verification-actions-copy.test.ts tests/monthly-cycle-verification-contract.test.ts` passed with 15 tests. `pnpm typecheck` passed. `pnpm lint` passed. `deno cache --config supabase/functions/deno.json supabase/functions/monthly-cycle-approval/index.ts` passed. `pnpm check` passed with lint, 96 test files / 445 tests, typecheck, and Next build.
- follow-ups: Run independent validation for #80. Issue #81 should add final verification/approval fixtures and docs for Goal #58.

## 2026-07-21T12:54:48.000Z - Issue 81 verification approval fixtures and docs

- agent: Codex
- branch: codex/operational-mvp-issue-51
- head: ea486d0
- summary: Implemented issue #81 by making the deterministic verification fixtures explicit for clean approval and needs-cleanup outcomes, asserting approval does not create credits, payout intents, or reports, and documenting the MVP state labels from calculated through credited/not-paid. Added the Goal #59 handoff contract for bookkeeping credit creation from approved outputs.
- validation: `pnpm test tests/monthly-cycle-verification.test.ts tests/monthly-cycle-verification-actions-copy.test.ts tests/monthly-cycle-verification-contract.test.ts` passed with 16 tests. `git diff --check` passed.
- follow-ups: Run independent validation for #81. If it passes, validate Goal #58 and continue Goal #59 bookkeeping credit creation.

## 2026-07-21T13:18:20.000Z - Issue 82 bookkeeping earnings credit command

- agent: Codex
- branch: codex/operational-mvp-issue-51
- head: issue #82 implementation commit
- summary: Implemented issue #82 by adding the `monthly_cycle_bookkeeping_credits` table, the `monthly-cycle-bookkeeping-credits-create` typed Edge Function command, the server-side monthly-cycle bookkeeping command, and docs clarifying that MVP credits are `credited` and `not_paid` bookkeeping records rather than payout intents or executed transfers. The command requires an internal operator, approved cycle status, a latest completed/finalized verified run, and a result artifact hash, then snapshots result rows, source/project breakdowns, asset fills, returned future-pool totals, and allocator explanation metadata idempotently.
- validation: `pnpm test tests/monthly-cycle-bookkeeping-credits-contract.test.ts tests/monthly-cycle-bookkeeping-credits-command.test.ts` passed with 2 files and 10 tests. `pnpm typecheck` passed. `deno cache --config supabase/functions/deno.json supabase/functions/monthly-cycle-bookkeeping-credits-create/index.ts` passed. `pnpm lint` passed. `git diff --check` passed. `pnpm test` passed with 98 files and 456 tests. `pnpm build` passed. `pnpm check` passed with lint, full tests, typecheck, and Next build. Attempts to run the Node 22 `pnpm dlx node@22.22.1 /opt/homebrew/bin/pnpm ...` commands were blocked by a local pnpm dlx cache `ENOENT`, not by repo code; local shell validation otherwise passed with the warning that the active Node is v24.15.0.
- follow-ups: Run independent validation for #82. If it passes, move #82 to In Review and continue #83 to expose credited/not-paid earnings in the user workspace.

## 2026-07-21T13:29:23.000Z - Issue 83 user earnings credit visibility checkpoint

- agent: Codex
- branch: codex/operational-mvp-issue-51
- head: issue #83 checkpoint commit
- summary: Implemented the #83 code/test/docs slice by making `/workspace/earnings` read `monthly_cycle_bookkeeping_credits` as the primary credited-but-not-paid earnings source, adding credit rows with selected asset fills, source/project breakdowns, baseline/top-up explanation, localized copy in English/French/Spanish, and docs that frame published results and payout intents as future-settlement context rather than MVP payment proof.
- validation: `pnpm test tests/user-earnings-workspace.test.ts` passed with 4 tests. `pnpm typecheck` passed. `pnpm lint` passed. `pnpm test` passed with 98 files and 457 tests. `pnpm build` passed. `git diff --check` passed. `pnpm check` passed with lint, full tests, typecheck, and Next build. Browser smoke and visual evidence are blocked by local Docker/Colima networking: `supabase status` first reported `supabase_db_fundloop` unhealthy; after `supabase stop`, `supabase start` failed twice while creating the Docker network with `iptables ... input/output error`. A competing unhealthy SmarTrust Supabase stack was stopped and retry still failed, so this checkpoint must not be moved to In Review until local Supabase is healthy and `/en/workspace/earnings` is smoked visually.
- follow-ups: Repair local Colima/Docker/Supabase health, apply the new local migration, run authenticated browser smoke for `/en/workspace/earnings` with credited/not-paid rows, capture visual evidence, then run independent validation for #83 before moving it to In Review.

## 2026-07-21T18:14:28.000Z - Issue 84 founder and operator credit summaries

- agent: Codex
- branch: codex/operational-mvp-issue-51
- head: issue #84 implementation commit
- summary: Implemented issue #84 by extending founder reporting and operator payout workspaces with credited-but-not-paid bookkeeping summaries. Founder project reporting now shows project-scoped asset-fill usage and returned future-pool totals from allocation rows. Operator cycle payout work now shows cycle-wide bookkeeping credit totals, not-paid counts, asset-fill counts, returned future-pool rows, and clearer copy that payout intents are later planning records rather than MVP credit proof.
- validation: `pnpm test tests/monthly-cycle-reports.test.ts tests/monthly-cycle-payouts.test.ts` passed with 5 tests. `pnpm typecheck` passed. `pnpm lint` passed. `git diff --check` passed. `pnpm test` passed with 99 files and 458 tests. `pnpm build` passed. `pnpm check` passed with lint, full tests, typecheck, and Next build. Local Supabase was running on the FundLoop 5532x port block with migration `20260721093000_bookkeeping_earnings_credits.sql` applied. Authenticated browser smoke with seeded Maya verified `/en/founder/projects/civic-mesh/reporting` and `/en/admin/cycles/2026-05/payouts` in light and dark mode with zero console errors after starting Next with local-only service-role and internal-operator env values. Screenshots were saved to ignored local artifacts `output/playwright/issue-84-founder-reporting-light.png`, `output/playwright/issue-84-founder-reporting-dark.png`, `output/playwright/issue-84-admin-payouts-light.png`, and `output/playwright/issue-84-admin-payouts-dark.png`.
- follow-ups: Run independent validation for #84. If it passes, move #84 to In Review and continue Goal #60 fixture/smoke work once the remaining blockers move forward.

## 2026-07-21T19:25:24.000Z - Issue 85 operational MVP smoke fixtures

- agent: Codex
- branch: codex/operational-mvp-issue-51
- head: issue #85 implementation commit
- summary: Implemented issue #85 by extending the deterministic local seed with operational MVP input fixtures. The seed now includes verified CUBID-linked users and snapshot rows for Maya, Eli, Safiya, and Jonah; the open `2026-05` monthly cycle; the existing Civic Mesh contribution submission; one approved raw-row attribution dataset for Civic Mesh with required scoped CUBID identities for Eli, Safiya, and Jonah; and documented asset-preference scenarios that can drive the later lock, calculation, verification, approval, and bookkeeping-credit smoke. The seed intentionally does not pre-create lock, calculation, approval, or credit outputs.
- validation: `pnpm test tests/local-public-seed.test.ts` passed with 10 tests. `supabase db reset` passed against the FundLoop local 5532x Supabase port block. Direct fixture queries confirmed 4 verified seeded users, 4 CUBID snapshot rows, 1 approved attribution dataset with 3 rows and 100 total points for `2026-05`, and 10 deterministic asset-preference rows. `git diff --check` passed. `pnpm test` passed with 99 files and 460 tests. `pnpm typecheck` passed. `pnpm lint` passed. The active shell emitted the known Node engine warning because it is running Node v24.15.0 while the repo expects Node >=22 <23; validation commands completed successfully.
- follow-ups: Run independent validation for #85. If it passes, move #85 to In Review and continue #86 with the local operational MVP end-to-end smoke using these seeded inputs.

## 2026-07-21T19:48:03.000Z - Issue 86 local operational MVP smoke

- agent: Codex
- branch: codex/operational-mvp-issue-51
- head: issue #86 implementation commit
- summary: Implemented issue #86 by running and documenting a sanitized local operational MVP smoke from the deterministic May 2026 seed inputs through lock, calculation, verification, approval, and bookkeeping-credit creation. Adjusted the local seed so only Civic Mesh is treated as the positive-commitment MVP project and all attributed users have a USD fallback preference while preserving project-token, stablecoin, and token-rejection preference scenarios.
- validation: `pnpm test tests/local-public-seed.test.ts` passed with 10 tests. `supabase db reset` passed against the local FundLoop 5532x Supabase stack. A direct local storage smoke passed through the Supabase JS Storage path after a Colima restart resolved a local Kong/storage stale-upstream routing issue. The local command smoke completed the `2026-05` cycle to `distribution`, created 3 credited/not-paid bookkeeping rows totaling USD 1250, and executed no payout transfer. Local Playwright browser smoke covered `/en/founder/projects/civic-mesh/reporting`, `/en/admin/cycles/2026-05/payouts`, and `/en/workspace/earnings` with credited/not-paid/no-transfer copy and zero console errors. `git diff --check` passed. `pnpm lint`, `pnpm test`, `pnpm typecheck`, `pnpm build`, and serialized `pnpm check` all passed. The active shell emitted the known Node engine warning because it is running Node v24.15.0 while the repo expects Node >=22 <23; validation commands completed successfully.
- follow-ups: Run independent validation for #86. If it passes, move #86 to In Review and continue #87 with the Preview/dev operational MVP smoke. Do not claim hosted or remote Supabase evidence from this local-only validation record.

## 2026-07-21T19:50:41.000Z - Issue 87 Preview/dev smoke blocker evidence

- agent: Codex
- branch: codex/operational-mvp-issue-51
- head: issue #87 blocker-evidence commit
- summary: Started issue #87 and recorded the current Preview/dev smoke blocker in a dedicated hosted-validation document. GitHub has no PR and no workflow runs for `codex/operational-mvp-issue-51`, so there is currently no Preview deployment, Supabase deploy dry-run, or hosted app URL that can honestly be used for the operational MVP hosted smoke.
- validation: `gh pr list --head codex/operational-mvp-issue-51 --json number,title,state,isDraft,url` returned `[]`. `gh run list --branch codex/operational-mvp-issue-51 --limit 5 --json databaseId,workflowName,status,conclusion,createdAt,url` returned `[]`. `git diff --check` passed. No remote Supabase mutation, production/main mutation, or payout execution was attempted.
- follow-ups: Publish the operational MVP branch to a PR against `dev`, wait for CI and Supabase deploy dry-run evidence, then run the hosted Preview/dev smoke after the dev deploy path is available. This entry intentionally does not claim hosted validation.

## 2026-07-22T02:50:01.000Z - Preview OTP verification diagnosis and guard

- agent: Codex
- branch: codex/operational-mvp-issue-51
- head: OTP verification diagnosis commit
- summary: Diagnosed the Preview OTP failure reported against `fundloop-website-h9rysotde-cubid-team.vercel.app`. The FundLoop Dev Supabase Auth audit entry around `2026-07-22 02:35:54 UTC` recorded `user_recovery_requested`, and the auth user row updated `recovery_sent_at` without updating `last_sign_in_at`, so the hosted failure was not a successful email OTP login session. Hardened the public auth modal so `verifyOtp` trims email input, requires a six-digit code, suppresses duplicate auto-submit attempts, checks for an actual browser session after Supabase reports no error, and keeps the modal open with a destructive toast when no session is created. Added an engineering note documenting the expected login OTP template/delivery contract and the recovery-flow mismatch. Also recorded the repo convention that local Supabase should be stopped when short-lived validation work is complete.
- validation: Queried the linked FundLoop Dev Supabase Auth audit and auth user metadata through `supabase db query --linked` with sanitized projections only. Chrome inspection of the open Preview tab confirmed the page remained unauthenticated and only extension noise appeared in captured console errors. `pnpm test tests/auth-modal.test.tsx` passed. `pnpm lint` passed. `pnpm typecheck` passed. `pnpm test` passed with 100 files and 461 tests. `pnpm build` passed. The active shell emitted the known Node engine warning because it is running Node v24.15.0 while the repo expects Node >=22 <23; validation commands completed successfully.
- follow-ups: Fix the Supabase Auth / AWS SES delivery configuration so the FundLoop login request sends a numeric login OTP token, not a recovery flow. After deployment, retry the Preview login and confirm `last_sign_in_at` updates and the app shell renders authenticated state after refresh.

## 2026-07-22T03:26:34.000Z - Main version-bump workflow refresh

- agent: Codex
- branch: codex/operational-mvp-issue-51
- head: version-bump workflow commit
- summary: Replaced the old PR version-bump helper with a fresh main-focused automation. The workflow now reacts to approved same-repo pull request reviews targeting `main` by preparing the PR branch with the next patch version from `origin/main`, and also includes a `main` push safety net that only bumps when the pushed commits did not already change `package.json` version. The script updates root `package.json` and refreshes `pnpm-lock.yaml` through `pnpm install --lockfile-only --ignore-scripts` when a real bump is applied.
- validation: `node .github/scripts/pr-version-bump.mjs --mode approved-main-pr --base-ref origin/main --dry-run` passed. `node .github/scripts/pr-version-bump.mjs --mode main-push --previous-ref HEAD^ --dry-run` passed. `git diff --check` passed. `pnpm lint` passed with the known local Node v24.15.0 versus repo Node >=22 <23 engine warning. `actionlint` was not installed locally, so dedicated workflow linting was not run.
- follow-ups: When this branch is opened as a PR, confirm GitHub parses `.github/workflows/pr-version-bump.yml` successfully. The automation is intentionally scoped to `main` even though the current active release flow primarily uses `dev`.

## 2026-07-22T03:41:55.000Z - PR 90 Codex review fixes

- agent: Codex
- branch: codex/operational-mvp-issue-51
- head: PR review fix commit
- summary: Addressed Codex review feedback on PR #90 by requiring `participants.is_admin = true` for founder contribution and attribution write commands, recomputing the authoritative monthly contribution amount server-side from USD equivalent and commitment percentage, and preserving non-USD/token source units when deriving contribution pools from locked manifests.
- validation: `pnpm test tests/project-monthly-contribution-command.test.ts tests/project-attribution-command.test.ts tests/mvp-distribution-calculator.test.ts` passed with 3 files and 19 tests. `pnpm lint` passed. `pnpm typecheck` passed. `git diff --check` passed. `pnpm test` passed with 101 files and 466 tests. The active shell emitted the known Node v24.15.0 versus repo Node >=22 <23 engine warning; validation commands completed successfully.
- follow-ups: Push the fix commit to PR #90, reply to the four Codex review comments with the fix commit reference, and confirm CI remains green.

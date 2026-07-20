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

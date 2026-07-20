## 2026-07-20T17:45:18.000Z - Issue 61 project commitment contract

- agent: Codex
- branch: codex/operational-mvp-issue-51
- head: 1fa5205
- summary: Started the Operational MVP implementation branch and completed issue #61 by adding canonical `projects.default_reporting_currency_code`, extending the project onboarding publish RPC/command payload to persist a stable reporting currency alongside `payment_percentage`, exposing the canonical commitment fields through the founder workspace read model, and adding focused onboarding/founder tests.
- validation: `pnpm test tests/project-onboarding-commands.test.ts tests/founder-workspace.test.ts` passed. `pnpm typecheck` passed. `pnpm lint` passed. `pnpm test` passed. `pnpm build` passed. Local Supabase startup applied the new migration during schema initialization, but the stack failed final health because `supabase_storage_fundloop` became unhealthy, so post-start DB query smoke could not be completed.
- follow-ups: Validate the migration again once local Supabase storage health is repaired; then continue issue #62 to surface the canonical commitment fields in founder UI.

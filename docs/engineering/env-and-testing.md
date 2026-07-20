# Environment And Testing Guide

Last reviewed: 2026-04-27

This guide defines how FundLoop agents should keep local and remote Supabase environments separate, and which validation lanes own common kinds of changes.

## Supabase Environment Lanes

FundLoop has three practical Supabase lanes:

- Local development
  - Purpose: schema work, destructive migration validation, local browser smoke tests, and wallet-local flows.
  - Default env file: `.env.local`.
  - Expected Supabase URL: `http://127.0.0.1:55321`.
  - Service-role key: local-only key from the local Supabase CLI output.

- Remote preview/dev
  - Purpose: shared non-production smoke tests, PR validation, and CI-managed migration/function deployment.
  - Suggested ignored env file for humans: `.env.remote.local`.
  - Expected Supabase URL: the shared dev/preview Supabase project.
  - Service-role key: use only for explicit non-production fixture seeding or remote-safe Playwright.

- Production/main
  - Purpose: real production runtime and gated Supabase deploys.
  - Local env file: do not keep production secrets in local repo env files.
  - Deployment: GitHub Actions `Production` environment and target Supabase project secrets.

## File Conventions

- `.env.example` is the tracked inventory of supported variables only. It must never contain real secrets.
- `.env.local` is the default local Next.js env file. Prefer pointing it at local Supabase for day-to-day development.
- `.env.remote.local` may be used as an ignored personal scratch file for shared non-production smoke credentials. Do not rely on Next.js loading it automatically; copy or export values intentionally for a specific command.
- Do not create tracked env files for preview, production, personal accounts, or one-off smoke tests.
- Do not put production service-role keys, CUBID API keys, wallet private keys, RPC secrets, or pooler strings in tracked files.

## Local Supabase Workflow

FundLoop intentionally uses a non-default local Supabase port block so it can run alongside other local repos under the same Colima/Docker instance:

| Service | Port |
| --- | --- |
| API / Edge Functions / MCP | `55321` |
| Postgres DB | `55322` |
| Shadow DB | `55320` |
| Studio | `55323` |
| Mailpit | `55324` |
| Analytics / Logflare | `55327` |
| Pooler, if enabled | `55329` |

Point local app env at the FundLoop API port:

```bash
NEXT_PUBLIC_SUPABASE_URL=http://127.0.0.1:55321
```

Use local Supabase for destructive or replay validation:

```bash
DOCKER_HOST=unix:///var/run/docker.sock supabase start
DOCKER_HOST=unix:///var/run/docker.sock supabase db reset
```

If the local analytics/Logflare container repeatedly fails health checks on a development machine, use the official smoke-mode fallback:

```bash
DOCKER_HOST=unix:///var/run/docker.sock supabase start -x logflare
DOCKER_HOST=unix:///var/run/docker.sock supabase db reset
```

This keeps database, auth, REST, storage, and Edge Functions available for app smoke tests while excluding the local analytics container. Record that fallback in the session log when used. Do not use this fallback to validate analytics-specific behavior.

For the deterministic seeded operator smoke persona, set the non-production allowlists before starting Next:

```bash
FUNDLOOP_INTERNAL_ADMIN_EMAILS=maya@fundloop.example.com
FUNDLOOP_ZKAS_SUPERADMIN_EMAILS=maya@fundloop.example.com
```

These values are local/preview smoke fixtures only. Production operator allowlists must be managed separately and should never be inferred from `supabase/seed.sql`.

Use local Supabase when:

- adding or changing migrations
- validating `supabase/seed.sql`
- testing local auth fixtures
- exercising browser flows that create or mutate rows
- running local wallet E2E flows

If local Supabase is unavailable, do not silently switch to a shared remote database for destructive validation. Either use static tests only or call out the missing validation.

## Remote Supabase Workflow

Remote Supabase mutation is intentionally narrow:

- PRs to `dev` and `main` run remote `supabase db push --dry-run`.
- Pushes to `dev` deploy migrations and functions to the dev Supabase project.
- Pushes to `main` deploy through the GitHub `Production` environment gate.
- Agents must not manually push, reset, re-link, or seed remote Supabase unless the user explicitly grants that permission in the current prompt.
- Remote seeds are not part of the deploy workflow.

Use remote preview/dev for:

- remote-safe Playwright smoke tests
- verifying deployed preview behavior
- validating CI-managed Supabase dry-runs and deploys

Do not use remote preview/dev as a substitute for local destructive migration work.

## Test Ownership

Use the smallest relevant validation first, then broaden before reporting complete or opening a PR.

| Change type | Primary owner | Typical validation |
| --- | --- | --- |
| Docs-only or context cleanup | Markdown/reference hygiene | `git diff --check`, targeted reference search |
| Shared TypeScript/domain logic | Vitest unit tests | focused `pnpm test -- <pattern>`, then `pnpm typecheck` |
| UI copy, shell, navigation, or routes | Component/page tests plus browser smoke | focused Vitest, `pnpm lint`, `pnpm typecheck`, manual or Playwright smoke |
| App-wide behavior | Full app gates | `pnpm lint`, `pnpm test`, `pnpm typecheck`, `pnpm build` |
| Supabase schema migrations | Local Supabase replay plus generated types | `supabase db reset`, regenerate `types/supabase.ts`, focused tests |
| Supabase Edge Functions | Contract/command tests plus Deno/Supabase validation | focused contract tests, `deno info` or `deno check`, PR dry-run |
| Onchain contract changes | Hardhat workspace | `pnpm --dir contracts test` |
| Wallet browser flows | Local wallet E2E lane | `pnpm test:e2e:local` when prerequisites are available |
| Shared preview smoke | Remote-safe E2E lane | `pnpm test:e2e:remote` with non-production remote credentials |

## Required Honesty In Reports

When finishing a task, state:

- which validation ran
- which validation was skipped
- why skipped validation was not available or not relevant
- whether the run used local Supabase, remote preview/dev Supabase, or no database

Do not describe a flow as working unless the relevant validation or smoke test actually ran.

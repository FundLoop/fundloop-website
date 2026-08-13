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
export FUNDLOOP_INTERNAL_ADMIN_EMAILS=maya@fundloop.example.com
export FUNDLOOP_ZKAS_SUPERADMIN_EMAILS=maya@fundloop.example.com
DOCKER_CONTEXT=colima-codex-supabase supabase start --ignore-health-check -x studio -x imgproxy -x logflare -x vector
DOCKER_CONTEXT=colima-codex-supabase supabase db reset
```

This keeps database, auth, REST, storage, Edge Functions, and Mailpit available for app smoke tests while excluding Studio, image transforms, and local analytics/logging/vector services. Because startup bypasses excluded-service health checks, verify Auth, REST, Storage, Edge health, and Mailpit on their documented loopback ports before running the harness. Do not use this lean local mode to validate Studio, image-transform, or analytics-specific behavior.

For the deterministic seeded operator smoke persona, set the non-production allowlists before starting local Supabase and Next:

```bash
FUNDLOOP_INTERNAL_ADMIN_EMAILS=maya@fundloop.example.com
FUNDLOOP_ZKAS_SUPERADMIN_EMAILS=maya@fundloop.example.com
```

These values are local/preview smoke fixtures only. `supabase/config.toml` forwards caller-provided values into the local Edge Runtime while the persona runner forwards the same identity into its Next process. Production operator allowlists must be managed separately and should never be inferred from `supabase/seed.sql`.

Use local Supabase when:

- adding or changing migrations
- validating `supabase/seed.sql`
- testing local auth fixtures
- exercising browser flows that create or mutate rows
- running local wallet E2E flows

### Base payout review variables

Task #140 keeps Safe payout execution non-production and fail-closed. Local/dev/test review requires:

```bash
FUNDLOOP_DEPLOYMENT_ENV=local
NEXT_PUBLIC_BASE_PAYOUT_REVIEW_ENABLED=true
BASE_PAYOUT_RPC_URL=http://127.0.0.1:8545
# BASE_PAYOUT_LIMITED_SIGNER_PRIVATE_KEY is untracked and local/test only.
```

Never store the limited signer key, Safe owner keys, paymaster keys, or RPC credentials in tracked
files. The limited key can call only the reviewed module and is independently restricted to the
allowlisted token/recipient/request hash, $20 per transaction, $500 rolling 24 hours, and $5,000 per
epoch. Safe owner-threshold enablement remains a human-controlled external action. Base Sepolia
deployment additionally requires `BASE_SEPOLIA_RPC_URL`, `BASE_SEPOLIA_PRIVATE_KEY`,
`BASE_SEPOLIA_EPOCH_SAFE_ADDRESS`, `BASE_SEPOLIA_PLATFORM_SAFE_ADDRESS`, and
`BASE_PAYOUT_LIMITED_SIGNER_ADDRESS`; absent values stop before
deployment. Production is denied by the Edge runtime, database controls, deployment constraints,
and tracked manifests.

### Stripe Connect payout review variables

Task #141 uses only a Stripe sandbox/test-mode platform and remains production-disabled:

```bash
FUNDLOOP_DEPLOYMENT_ENV=local
FUNDLOOP_SITE_URL=http://127.0.0.1:3000
NEXT_PUBLIC_STRIPE_CONNECT_REVIEW_ENABLED=true
STRIPE_SECRET_KEY=sk_test_...
STRIPE_ACCOUNT_ID=acct_...
STRIPE_CONNECT_WEBHOOK_SECRET=whsec_...
```

The webhook secret is temporary output from `stripe listen --forward-connect-to`; keep it untracked.
The Edge functions verify that the test key resolves to `STRIPE_ACCOUNT_ID`, reject live events, and
accept only local/development/dev/preview/test runtimes. See
[`stripe-connect-sandbox-payouts.md`](./stripe-connect-sandbox-payouts.md) for the hosted onboarding,
USD/CAD amount, retry, and settlement-journal boundaries.

If local Supabase is unavailable, do not silently switch to a shared remote database for destructive validation. Either use static tests only or call out the missing validation.

## Remote Supabase Workflow

Remote Supabase mutation is intentionally narrow:

- PRs to `dev` and `main` first run a secret-free fresh local `supabase db push` replay plus representative SQL/RLS/RPC suites, then run remote non-mutating `supabase db push --dry-run` planning.
- Pushes to `dev` deploy migrations and functions to the dev Supabase project.
- Pushes to `main` deploy through the GitHub `Production` environment gate.
- Agents must not manually push, reset, re-link, or seed remote Supabase unless the user explicitly grants that permission in the current prompt.
- Remote seeds are not part of the deploy workflow.

Use remote preview/dev for:

- remote-safe Playwright smoke tests
- verifying deployed preview behavior
- validating CI-managed Supabase dry-runs and deploys

Remote-safe Playwright reads `PLAYWRIGHT_REMOTE_BASE_URL` plus remote Supabase credentials. Prefer the explicit aliases `PLAYWRIGHT_REMOTE_SUPABASE_URL` and `PLAYWRIGHT_REMOTE_SUPABASE_SERVICE_ROLE_KEY` so destructive fixture writes cannot accidentally use ordinary app env. The harness may fall back to `NEXT_PUBLIC_SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY` only when `PLAYWRIGHT_REMOTE_ALLOW_CANONICAL_SUPABASE=true`, `FUNDLOOP_DEPLOYMENT_ENV` is not `production`, and a hosted base URL is not paired with a local Supabase URL.

The opt-in hosted operational smoke reuses the returning-operator cadence plus founder/member readback against the guarded FundLoop dev project. It requires explicit remote aliases, the non-production operator password, and current-prompt permission for shared-dev fixture mutation. Preview deployments also require a caller-supplied `_vercel_jwt` value in `VERCEL_PROTECTION_BYPASS_COOKIE`; never commit that cookie or print it. The smoke creates collision-resistant run-owned IDs, records ownership before workflow actions, executes no payout, disables automatic browser artifacts, and removes its fixtures through the same ledger contract as the local persona lane.

```bash
export FUNDLOOP_DEPLOYMENT_ENV=dev
export PLAYWRIGHT_REMOTE_BASE_URL=https://<fundloop-dev-or-protected-preview>
export PLAYWRIGHT_REMOTE_SUPABASE_URL=https://kyxtqnfnksvcaugxwzuj.supabase.co
export PLAYWRIGHT_REMOTE_SUPABASE_SERVICE_ROLE_KEY=<dev-service-role-key>
export FUNDLOOP_E2E_SECRET=<dev-e2e-secret>
export FUNDLOOP_PERSONA_OPERATOR_PASSWORD=<non-production-operator-password>
export PLAYWRIGHT_PERSONA_RUN_ID=persona-hosted-<unique-run-id>
export PLAYWRIGHT_PERSONA_STARTED_AT=<UTC-ISO-timestamp>
export PLAYWRIGHT_PERSONA_OUTPUT_ROOT=$PWD/output/persona-harness
# Protected previews only:
export VERCEL_PROTECTION_BYPASS_COOKIE=<temporary-preview-cookie>

pnpm test:e2e:hosted-operational
```

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
| Stripe bank-transfer intake | FundLoop sandbox CLI plus local signed webhook/SQL/browser evidence | `stripe whoami --project-name fundloop`, `stripe listen`, fresh local reset, `supabase/tests/stripe_bank_transfer_intake.sql`; never `--live` |
| Stripe Canadian PAD intake | Dedicated test-mode payment-method configuration plus signed webhook/refetch, SQL, and browser evidence | fresh local reset, `supabase/tests/stripe_acss_debit_intake.sql`, strict Deno, focused PAD Playwright; CAD only and never `--live` |
| Stripe EUR/GBP Pay by Bank intake | Exact test merchant country/capability/dynamic configuration plus signed webhook/refetch, SQL, and browser evidence | fresh local reset, `supabase/tests/stripe_pay_by_bank_intake.sql`, strict Deno, focused Pay by Bank Playwright; GB/FI general, FR/DE/IE private-preview gated, never `--live` |
| Onchain contract changes | Hardhat workspace | `pnpm --dir contracts test` |
| Local wallet and control-plane browser flows | Serialized local E2E lane with per-workflow replay/fixtures | `pnpm test:e2e:local` when prerequisites are available |
| Persona happy paths | Local-only persona E2E lane | Start/reset caller-owned local Supabase, then `pnpm test:e2e:personas` or filter with `-- --persona <id>` |
| Shared preview smoke | Remote-safe E2E lane | `pnpm test:e2e:remote` with non-production remote credentials |
| Founder/operator/member hosted cadence | Guarded hosted operational lane | `pnpm test:e2e:hosted-operational` with explicit dev credentials and mutation approval |

The local-wallet runner treats a completed CLI reset as necessary but not sufficient readiness. After every reset it makes a bounded service-role PostgREST query for the exact current Base row and `ref_chains` projection (`id`, `network_key`, `ecosystem`, `evm_chain_id`, and `is_active`). Sync commands and SQL fixtures cannot start until that query returns HTTP 200, valid JSON, and the expected active Base/EVM/8453 values. Generic REST responses, missing rows, stale projections, and delayed schema-cache reloads remain classified failures at the timeout boundary.

## Local Persona Harness

The persona harness is deliberately local-only. The caller starts and resets Supabase/Mailpit; the runner verifies the exact `55321`/`55324` endpoints, owns only a Next process on `127.0.0.1:3002`, and refuses occupied, hosted, or production endpoints before fixture access. Readiness is bounded and classified: Auth, the current `supabase_deploy_completion_evidence` schema sentinel, Storage, Mailpit, every Edge Function required by the selected persona set, and an exact per-run Next commit/nonce identity must all answer before fixtures begin. A delayed healthy dependency is retried. If the local CLI reset leaves Auth and Storage containers healthy but Kong routing stale, one recovery restarts only the validated `supabase_kong_<project_id>` local container, then grants a bounded 90-second recovery window; fixtures never start during that interval. Stale app identity, partial schema/function inventory, and dead services fail with distinct reason codes. The readiness evidence is retained in the sanitized run summary. It writes its private recovery ledger and sanitized summaries beneath ignored `output/persona-harness/`.

```bash
export FUNDLOOP_INTERNAL_ADMIN_EMAILS=maya@fundloop.example.com
export FUNDLOOP_ZKAS_SUPERADMIN_EMAILS=maya@fundloop.example.com
DOCKER_CONTEXT=colima-codex-supabase supabase start --ignore-health-check -x studio -x imgproxy -x logflare -x vector
DOCKER_CONTEXT=colima-codex-supabase supabase db reset

# All five persona specs are executable and independently selectable
pnpm test:e2e:personas
pnpm test:e2e:personas -- --persona new-member
pnpm test:e2e:personas -- --persona returning-member,new-founder
pnpm test:e2e:personas -- --persona returning-operator
pnpm test:e2e:personas -- --self-test --force-timeout --persona returning-member

# Foundation smoke and a deliberate failure/cleanup probe
pnpm test:e2e:personas -- --self-test --persona returning-member
pnpm test:e2e:personas -- --self-test --force-failure --persona returning-member

# Exact recovery for an interrupted, ledger-owned run
pnpm test:e2e:personas -- --cleanup-run <run-id>
```

The aggregate exits `0` only when every selected checkpoint passes, `2` when the only gaps are declared expected-pending capabilities, and `1` for failures, missing persona results, preflight errors, or cleanup residue. Automatic Playwright screenshots, video, and traces are disabled for this lane because auth artifacts can contain private values; individual specs may create sanitized post-auth evidence. The forced-failure foundation probe creates only a synthetic, sanitized screenshot and trace under ignored `output/playwright/persona-harness/`.

Withdrawal requests and persisted invitation acceptance are required browser checkpoints. Member runs prove reservation without payout or a paid marker; founder runs create an invitation and accept it in a separate profiled invitee context. The independently filtered founder journey retains only its cadence handoff checkpoint until it directly consumes the integrated operator result. Contribution and active-user attribution remain required browser checkpoints and fail the run if their product command or user-visible confirmation regresses.

The Supabase local Edge runtime exports `SUPABASE_URL` and `SUPABASE_ANON_KEY`; the shared command runtime accepts those canonical local names as fallbacks for the hosted `NEXT_PUBLIC_*` names. This keeps profile publishing, monthly contribution, and attribution commands on the real browser-to-Edge path locally.

## Required Honesty In Reports

When finishing a task, state:

- which validation ran
- which validation was skipped
- why skipped validation was not available or not relevant
- whether the run used local Supabase, remote preview/dev Supabase, or no database

Do not describe a flow as working unless the relevant validation or smoke test actually ran.
# Base intake V2 local boundary

The provisional Base V2 intake uses exact `local`, `dev`, and `test` command allowlists.
Its tracked deployment manifest is disabled, and production deployment/value flow remains
unavailable. See `docs/engineering/base-intake-v2.md` for the local Hardhat and Supabase
evidence workflow.

# Stripe sandbox intake boundary

The provisional Stripe intake uses a dedicated CLI profile (`--project-name fundloop`) and
accepts only test/sandbox API keys. Keep `STRIPE_SECRET_KEY`, `STRIPE_ACCOUNT_ID`, and the
temporary `STRIPE_WEBHOOK_SECRET` from `stripe listen` in the process environment or an ignored
ephemeral env file. Do not print them, commit them, or copy them into `.env.example` values.

Bank Transfers must be enabled in the FundLoop sandbox before provider success evidence is
claimed. USD is the only enabled currency in the current adapter; CAD is rejected because
Stripe's bank-transfer presentment support does not currently include CAD. See
`docs/engineering/stripe-bank-transfer-intake.md` for the signed webhook and reconciliation
contract.

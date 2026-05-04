# FundLoop Website

FundLoop connects projects and users in a revenue-sharing ecosystem. Projects pledge a portion of revenue back to the network, and active users can receive recurring community distributions.

This repository contains the FundLoop website and app shell built with Next.js, React, TypeScript, Tailwind CSS, and Supabase.

## Stack

- Next.js 16 App Router
- React 19
- TypeScript
- Tailwind CSS 4 and shadcn/ui
- Supabase SSR and Supabase Postgres
- pnpm for package management

## Getting Started

### Prerequisites

- Node.js 22.22.1
- pnpm 10.x

### Clone and install

```bash
git clone https://github.com/FundLoop/fundloop-website.git
cd fundloop-website
pnpm install
```

### Environment variables

Copy the example file if you want to run auth and data-backed features locally:

```bash
cp .env.example .env.local
```

Use `.env.local` for local development, preferably pointed at local Supabase. If you keep shared non-production credentials for remote-safe smoke testing, use a separate ignored file such as `.env.remote.local` and copy or export those values only for the command that needs them. Never keep production secrets in local repo env files.

Required Supabase variables:

```env
NEXT_PUBLIC_SUPABASE_URL=your_supabase_project_url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_supabase_anon_key
```

Static validation commands work in a fresh clone without real Supabase credentials. Interactive auth and database-backed screens still require valid Supabase env vars.

See [Environment And Testing Guide](docs/engineering/env-and-testing.md) for the local-vs-remote Supabase conventions and validation ownership map.

Wallet-related variables:

```env
FUNDLOOP_DEPLOYMENT_ENV=local
FUNDLOOP_PAYMENTS_CRON_SECRET=your_internal_cron_secret
NEXT_PUBLIC_REOWN_PROJECT_ID=your_reown_project_id
NEXT_PUBLIC_ETHEREUM_RPC_URL=https://...
NEXT_PUBLIC_BASE_RPC_URL=https://...
NEXT_PUBLIC_CELO_RPC_URL=https://...
```

Tracked contract and treasury addresses now live in the deployment manifests under [`lib/onchain/deployments/`](lib/onchain/deployments/). Preview and production should not rely on ad hoc env addresses anymore.

Playwright e2e variables:

```env
FUNDLOOP_E2E_ENABLED=false
FUNDLOOP_E2E_SECRET=shared_non_production_secret
PLAYWRIGHT_REMOTE_BASE_URL=https://preview-or-staging.example.com
PLAYWRIGHT_REMOTE_SUPABASE_URL=https://your-supabase-project.supabase.co
PLAYWRIGHT_REMOTE_SUPABASE_SERVICE_ROLE_KEY=service_role_for_remote_fixture_seeding
PLAYWRIGHT_LOCAL_BASE_URL=http://127.0.0.1:3001
PLAYWRIGHT_LOCAL_RPC_URL=http://127.0.0.1:8545
PLAYWRIGHT_LOCAL_CHAIN_ID=8453
PLAYWRIGHT_LOCAL_WALLET_ADDRESS=0x...
NEXT_PUBLIC_FUNDLOOP_E2E_LOCAL_WALLET=false
NEXT_PUBLIC_FUNDLOOP_LOCAL_WALLET_MANIFEST_JSON=
```

## Supabase Workflow

The [`supabase/`](supabase/) directory is the canonical database source of truth.

- `supabase/migrations/` contains the pulled remote schema history tracked in Git.
- `supabase/seed.sql` contains the tracked local `public` schema seed, including deterministic public discovery fixtures for smoke testing.
- `types/supabase.ts` is generated from the linked Supabase schema.

For local database work, the tracked migrations plus `supabase/seed.sql` should be replayable directly:

```bash
DOCKER_HOST=unix:///var/run/docker.sock supabase start
DOCKER_HOST=unix:///var/run/docker.sock supabase db reset
```

If the local Supabase analytics/Logflare container is unhealthy on your machine, use the documented smoke fallback:

```bash
DOCKER_HOST=unix:///var/run/docker.sock supabase start -x logflare
DOCKER_HOST=unix:///var/run/docker.sock supabase db reset
```

That mode is valid for app smoke tests that need database, auth, storage, REST, and Edge Functions, but it does not validate analytics behavior.

For the deterministic seeded founder/operator smoke persona, use:

```env
FUNDLOOP_INTERNAL_ADMIN_EMAILS=maya@fundloop.example.com
FUNDLOOP_ZKAS_SUPERADMIN_EMAILS=maya@fundloop.example.com
```

See [Local Seed Fixtures](docs/engineering/local-seed.md) for the seeded credentials and expected smoke routes.

Common commands:

```bash
supabase db pull --linked
supabase db dump --linked --data-only --schema public --file supabase/seed.sql
supabase gen types typescript --project-id <project-ref> --schema public > types/supabase.ts
```

After a local reset, these stable public smoke targets should exist:

- `/en/projects/civic-mesh`
- `/en/projects/mutual-aid-atlas`
- `/en/projects/open-transit-ledger`
- `/en/users/00000000-0000-4000-8000-000000000101`

See [Local Seed Fixtures](docs/engineering/local-seed.md) for the full deterministic fixture set.

## Wallet Deployment Workflow

Wallet execution uses a hybrid model:

- tracked manifests under [`lib/onchain/deployments/`](lib/onchain/deployments/) are the source of truth for deployed intake contract and treasury addresses
- Supabase `chain_intake_contracts` rows remain the runtime source used by project payment routes
- the sync script applies manifest changes into Supabase explicitly instead of mutating the database at app startup

Dry run the deployment sync:

```bash
node scripts/sync-chain-deployments.mjs --env local
```

Apply the sync after reviewing the output:

```bash
node scripts/sync-chain-deployments.mjs --env local --apply
```

`preview` and `production` builds now validate wallet configuration strictly. If the active manifest, Reown project id, or required RPC URLs are missing or inconsistent, startup should fail until the environment is corrected.

To run scheduled payment reconciliation, post to `/api/internal/payments/reconcile-onchain` with `Authorization: Bearer $FUNDLOOP_PAYMENTS_CRON_SECRET`. Internal admins can also trigger targeted replay/backfill from `/admin/payments/reconciliation`.

## Supabase Edge Functions

FundLoop is migrating backend workflow access onto Supabase Edge Functions behind shared, typed app-side adapters. New write paths should use command-style Edge Functions unless an engineering doc explicitly records a temporary exception. Authenticated reads that feed workflows, agents, or cross-surface product state should also move toward server-owned read models or typed Edge Function boundaries instead of ad hoc browser table access.

Current concrete command slugs include:

- `project-payment-drafts-create`
- `user-onboarding-draft-upsert`
- `user-onboarding-draft-clear`
- `user-onboarding-publish`
- `project-onboarding-draft-upsert`
- `project-onboarding-draft-clear`
- `project-onboarding-publish`
- `user-cubid-resolve-email`
- `user-cubid-sync-profile`
- `project-crypto-route-create`
- `project-crypto-route-update`
- `project-crypto-route-move`
- `project-crypto-route-enabled-set`
- `project-onchain-payment-submission-record`
- `admin-payment-receipt-confirm`
- `admin-onchain-payment-reconciliation-run`

Run the first local function smoke once the local Supabase stack is up:

```bash
pnpm supabase:functions:serve:project-payment-drafts-create
```

The browser paths call function-specific adapters under `lib/edge-functions/`. Legacy server actions remain only as temporary compatibility wrappers while older callers are migrated.

CUBID identity writes also use Edge Functions. FundLoop currently depends on local CUBID package artifacts for `@cubid/api`, `@cubid/web2`, and `@cubid/web2-react`; the Supabase function import map resolves `@cubid/api` from the installed package until the CUBID repo publishes a first-class npm/JSR package. Do not put `CUBID_API_KEY` in client code.

See [Edge Function Contract Pattern](docs/engineering/edge-functions.md), [CUBID Identity and Snapshot Model](docs/engineering/cubid-identity.md), and [Supabase Remote Deployments](docs/engineering/supabase-deployments.md) for the current backend contract details.

## Playwright E2E Workflow

The repo now includes a two-lane Playwright harness:

- `remote-safe` seeds unique users, projects, payments, and crypto routes against a shared non-production Supabase environment, then signs the browser into the real app through `POST /api/internal/e2e/login`.
- `local-wallet` is opt-in and runs against a local Next app plus a local Hardhat JSON-RPC node on chain id `8453`, with a generated local manifest override and an injected test wallet provider.

Run the remote-safe lane:

```bash
pnpm test:e2e:remote
```

Run the local-wallet lane:

```bash
pnpm test:e2e:local
```

Notes:

- `POST /api/internal/e2e/login` is disabled unless `FUNDLOOP_E2E_ENABLED=true`, `FUNDLOOP_E2E_SECRET` is configured, and `NODE_ENV` is not `production`.
- The local-wallet runner starts the local Hardhat node and the Next dev server for you, but it expects local Supabase env vars to already point at a running local Supabase stack.
- The local-wallet runner temporarily overrides the local deployment manifest through `NEXT_PUBLIC_FUNDLOOP_LOCAL_WALLET_MANIFEST_JSON` so tracked manifest files stay unchanged in Git.

Use `remote-safe` only with non-production Supabase credentials. Use `local-wallet` when the flow depends on local Supabase plus local chain/runtime control.

### Run the app

```bash
pnpm dev
```

Open [http://localhost:3000](http://localhost:3000).

## Available Scripts

- `pnpm dev` starts the local dev server.
- `pnpm lint` runs the ESLint CLI with the Next.js flat config.
- `pnpm test` runs the Vitest suite once.
- `pnpm test:watch` runs Vitest in watch mode.
- `pnpm typecheck` runs `tsc --noEmit`.
- `pnpm build` creates a production build.
- `pnpm check` runs lint, test, typecheck, and build in sequence.
- `pnpm test:e2e:remote` runs the shared-environment Playwright lane.
- `pnpm test:e2e:local` runs the opt-in local wallet Playwright lane.
- `pnpm --dir contracts test` runs the Hardhat workspace tests.

## Contracts Workspace

The `contracts/` workspace contains the Hardhat-based intake-contract package used for onchain payment flows.

- `contracts/src` contains Solidity sources.
- `contracts/test` contains Hardhat tests.
- `contracts/hardhat.config.js` defines the workspace build and test paths.

Common commands:

```bash
pnpm --dir contracts test
pnpm --dir contracts build
```

The root app and the contracts workspace are validated separately. If you touch onchain intake logic, run the contracts tests in addition to the root app checks.

## zkAS and Admin Surfaces

The repo also includes the zkActivitySum control plane and admin surfaces.

- `/admin/zkas` is the operator workspace for datasets, runs, and execution flow.
- `/admin/superadmin/zkas` is the superadmin workspace for verification, publication, and TEE artifact access.
- `/projects/[slug]/zkas` is the project-level workspace for zkAS managers.
- `zkas/engine` contains the local Python execution engine used by the app-side runner integration.

If you are working on zkAS changes, expect to touch both the app layer and the Supabase schema under `supabase/migrations/`, and run local Supabase-backed checks when behavior depends on real data flows.

## Project Structure

- `app/` contains route segments and pages.
- `components/` contains reusable UI and feature components.
- `lib/` contains shared helpers.
- `contracts/` contains the Hardhat workspace for onchain intake contracts.
- `docs/engineering/` contains longer-lived engineering and architecture docs.
- `supabase/` contains the canonical schema migration and seed artifacts.
- `tests/` contains Vitest coverage.
- `types/` contains shared TypeScript and Supabase types.
- `zkas/` contains the local zkActivitySum execution engine and runner-related code.
- `agent-context/` contains lightweight live agent context such as the backlog, repo-status snapshot, and session log.

## Notes

- Some content and seeded records in this repo are demo content and placeholders.

## Contributing

See [CONTRIBUTING.md](CONTRIBUTING.md) for local setup and contribution expectations.

## License

FundLoop is released under the [MIT License](LICENSE).

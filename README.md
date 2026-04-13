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

- Node.js 25.8.2
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

Required Supabase variables:

```env
NEXT_PUBLIC_SUPABASE_URL=your_supabase_project_url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_supabase_anon_key
```

Static validation commands work in a fresh clone without real Supabase credentials. Interactive auth and database-backed screens still require valid Supabase env vars.

Wallet-related variables:

```env
FUNDLOOP_DEPLOYMENT_ENV=local
NEXT_PUBLIC_REOWN_PROJECT_ID=your_reown_project_id
NEXT_PUBLIC_ETHEREUM_RPC_URL=https://...
NEXT_PUBLIC_BASE_RPC_URL=https://...
NEXT_PUBLIC_CELO_RPC_URL=https://...
```

Tracked contract and treasury addresses now live in the deployment manifests under [`lib/onchain/deployments/`](lib/onchain/deployments/). Preview and production should not rely on ad hoc env addresses anymore.

## Supabase Workflow

The [`supabase/`](supabase/) directory is the canonical database source of truth.

- `supabase/migrations/` contains the pulled remote schema history tracked in Git.
- `supabase/seed.sql` contains the current `public` schema seed data from the linked remote project.
- `types/supabase.ts` is generated from the linked Supabase schema.

For local database work, the tracked migrations plus `supabase/seed.sql` should be replayable directly:

```bash
DOCKER_HOST=unix:///var/run/docker.sock supabase start
DOCKER_HOST=unix:///var/run/docker.sock supabase db reset
```

Common commands:

```bash
supabase db pull --linked
supabase db dump --linked --data-only --schema public --file supabase/seed.sql
supabase gen types typescript --project-id <project-ref> --schema public > types/supabase.ts
```

## Wallet Deployment Workflow

Wallet execution uses a hybrid model:

- tracked manifests under [`lib/onchain/deployments/`](/Users/botmaster/src/fundloop/lib/onchain/deployments) are the source of truth for deployed intake contract and treasury addresses
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
- `supabase/` contains the canonical schema migration and seed artifacts.
- `tests/` contains Vitest coverage.
- `types/` contains shared TypeScript and Supabase types.
- `zkas/` contains the local zkActivitySum execution engine and runner-related code.

## Notes

- Some content and seeded records in this repo are demo content and placeholders.
- `next build` currently emits a Recharts container-size warning during static generation, but the build completes successfully.

## Contributing

See [CONTRIBUTING.md](CONTRIBUTING.md) for local setup and contribution expectations.

## License

FundLoop is released under the [MIT License](LICENSE).

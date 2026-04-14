# FundLoop Current-State Architecture

Last reviewed: 2026-04-14

Related planning docs:
- [Agent Context Index](/Users/botmaster/src/fundloop/agent-context/README.md)
- [Backgrounder for Agents](/Users/botmaster/src/fundloop/agent-context/backgrounder-for-agents.md)
- [Target-State Architecture](/Users/botmaster/src/fundloop/agent-context/target-state-architecture.md)
- [TODO Roadmap](/Users/botmaster/src/fundloop/agent-context/todo.md)

## 1. What This Repo Is Today

FundLoop is currently a single Next.js 16 App Router application that combines:

- the public marketing site
- authenticated account and profile flows
- resumable user and project onboarding
- project payment management and crypto intake flows
- internal admin operations for payments and zkAS
- a small onchain integration layer for wallet-based project payments
- a Hardhat workspace for the intake contract and local wallet test support

The system is not split into separate deployable services yet. The main app is the operational control plane, and Supabase is the primary backend for auth, persistence, and most workflow state.

## 2. Top-Level Shape

### App shell

- `app/` contains the route tree, server components, route handlers, and server actions.
- `app/layout.tsx` is the global composition root.
- The root layout initializes:
  - global fonts and styles
  - `Web3Provider`
  - `ThemeProvider`
  - shared navigation/footer chrome
  - `OnboardingModalManager`

### Shared UI and feature components

- `components/` contains feature-level UI.
- `components/ui/` contains shadcn-style reusable primitives.
- Feature components generally own local interaction state and call server actions or Supabase browser queries directly.

### Shared logic

- `lib/` is the main domain/helper layer.
- The most important clusters today are:
  - Supabase client helpers: `lib/supabase.ts`, `lib/supabase-server.ts`, `lib/supabase-admin.ts`
  - onboarding logic: `lib/onboarding.ts`
  - payments and route helpers: `lib/payments.ts`, `lib/project-crypto-routes.ts`
  - onchain runtime and reconciliation: `lib/onchain/*`
  - observability: `lib/observability/*`
  - zkAS orchestration and policy: `lib/zkas/*`

### Data and contracts

- `supabase/` is the canonical database source of truth.
- `types/supabase.ts` is the generated application type surface for the current schema.
- `contracts/` is a separate Hardhat workspace for `FundLoopIntake.sol` and local wallet test tooling.

## 3. Runtime Architecture

### 3.1 UI and rendering model

The repo mostly follows the intended App Router split:

- server components for page-level gating and data assembly on admin and some content pages
- client components for interactive product flows
- server actions for authenticated mutations
- route handlers for machine-to-machine or browser-ingestion endpoints

The architecture is not “server components only.” A meaningful amount of app behavior still lives in client components that query Supabase directly with the browser client and then call server actions for writes.

Examples:

- `/admin/payments` is server-rendered, then hands the table to `components/admin/payments-console.tsx`
- `/projects/[slug]/payments` is a client page that loads browser-side data and coordinates local draft/payment UI
- onboarding is modal-driven and primarily client-controlled, backed by server actions

### 3.2 Auth and Supabase client boundaries

There are three explicit Supabase client layers:

- `lib/supabase.ts`
  Browser anon client for client components and browser-side queries.

- `lib/supabase-server.ts`
  Cookie-aware server client for auth/session-aware server code.

- `lib/supabase-admin.ts`
  Service-role client for privileged server-only operations.

Current pattern:

- read the current user from the SSR-aware server client when authorization depends on the current session
- use the admin client for privileged joins, status resolution, and internal workflows
- keep the service-role client out of client bundles

This repo relies more on server-side authorization checks than on a thin API layer. Many important rules are enforced in server actions rather than through separate domain services.

## 4. Main Product Subsystems

### 4.1 Public site and app shell

Public content pages live directly in `app/` and mostly compose reusable marketing components.

This part of the repo is straightforward:

- public marketing and explainer pages
- blog and use-case content routes
- shared nav/footer/theme behavior

The public site and the authenticated application share the same deployment, routing tree, and design system.

### 4.2 Resumable onboarding

Onboarding is one of the more application-like parts of the repo.

Key pieces:

- `components/onboarding-modal-manager.tsx`
  Watches auth state and query params, then opens the appropriate flow.

- `components/user-signup-flow.tsx`
- `components/project-signup-flow.tsx`
- `app/actions/onboarding-actions.ts`

Current architecture:

- the browser drives the flow state and step transitions
- drafts are stored in Supabase tables (`user_onboarding_drafts`, `project_onboarding_drafts`)
- publish actions materialize the draft into normalized app records
- onboarding can resume across sessions because draft payloads are persisted

This is effectively a lightweight workflow engine implemented as:

- draft tables
- payload merge helpers
- publish actions
- modal-driven client UX

### 4.3 Payments and project finance operations

Payments are now a major domain area rather than a placeholder.

Key pieces:

- `app/actions/project-payment-actions.ts`
- `app/projects/[slug]/payments/page.tsx`
- `components/project-crypto-route-manager.tsx`
- `components/project-crypto-payment-dialog.tsx`
- `app/admin/payments/page.tsx`
- `components/admin/payments-console.tsx`

Current state:

- projects can create draft payment obligations
- projects can manage post-onboarding crypto collection routes
- projects can submit crypto payments through the intake contract flow
- internal admins can review obligations and non-onchain confirmation cases
- crypto-submitted obligations advance through reconciliation instead of manual confirmation

Important architectural characteristic:

`app/actions/project-payment-actions.ts` is the main domain façade for payments right now. It contains:

- project-admin authorization
- route validation
- payment draft creation
- onchain submission recording
- admin confirmation logic
- internal reconciliation entrypoints

This file is doing real orchestration work, not just thin transport. It is one of the repo’s main concentration points.

### 4.4 Wallet and onchain integration

Wallet support is intentionally curated rather than fully generic.

Key pieces:

- `components/web3-provider.tsx`
- `lib/onchain/runtime-config.ts`
- `lib/onchain/supported-chains.ts`
- `lib/onchain/payment-submissions.ts`
- `lib/onchain/payment-reconciliation.ts`
- `contracts/src/FundLoopIntake.sol`

Current architecture:

- Reown AppKit provides wallet connection UX
- wagmi provides wallet/account/network state
- viem provides chain operations and receipt/event handling
- runtime chain support is derived from tracked deployment manifests plus env-provided RPC URLs

Important design choice:

wallet availability is environment-gated at startup. `app/layout.tsx` loads the runtime config and preview/production fail fast when wallet config is invalid.

Operationally, the onchain flow is split into two stages:

1. the project page records a known app-side submission with immutable route snapshots
2. reconciliation verifies chain state later and advances the payment

That split is a core part of the current payment architecture.

### 4.5 Onchain reconciliation

Reconciliation is the closest thing this repo has to a background worker subsystem.

Key pieces:

- `lib/onchain/payment-reconciliation.ts`
- `app/api/internal/payments/reconcile-onchain/route.ts`
- `app/admin/payments/reconciliation/page.tsx`

Current design:

- unresolved submissions are stored in `onchain_payment_submissions`
- the reconciliation engine fetches receipts, decodes `Deposit` events, and applies confirmation-depth rules
- the worker can run from:
  - a protected cron endpoint
  - an internal admin replay surface

This is still implemented inside the main app repo and runtime. There is not yet a separate queue or worker service.

### 4.6 Observability

Payment-flow observability is now a first-class internal subsystem.

Key pieces:

- `lib/observability/payment-flow.ts`
- `lib/observability/payment-flow-server.ts`
- `lib/observability/payment-flow-client.ts`
- `app/api/internal/observability/payment-events/route.ts`
- `app/admin/payments/observability/page.tsx`

Current design:

- structured event history is stored in `payment_flow_events`
- client-originated events are ingested via an authenticated route
- server actions log best-effort events directly
- admin payments pages surface recent failures and filtered event history

This is internal observability, not external telemetry. It is optimized for operator debugging rather than product analytics across the whole app.

### 4.7 zkAS control plane

zkAS is the other large subsystem in the repo.

Key pieces:

- `app/actions/zkas-actions.ts`
- `lib/zkas/*`
- `/admin/zkas`
- `/admin/superadmin/zkas`
- `/projects/[slug]/zkas`

Current architecture:

- app actions orchestrate datasets, runs, approvals, publication, and notifications
- Supabase stores run metadata, dataset records, issues, and outputs
- artifact storage is handled through Supabase storage buckets
- local execution is coordinated through `lib/zkas/runner.ts`

The zkAS subsystem has stronger role separation than most of the rest of the repo:

- project admins / zkAS managers
- internal operators
- zkAS superadmins

This subsystem already behaves more like a workflow control plane than a simple CRUD UI.

## 5. Data Architecture

### Source of truth

The data architecture is centered on Supabase Postgres.

- `supabase/migrations/` is the canonical schema history
- `supabase/seed.sql` is the tracked seed artifact
- `types/supabase.ts` is the generated app-facing schema contract

There is no parallel legacy schema source anymore.

### Data model themes

The schema is still fairly broad and monolithic, but the main current domains are:

- user/profile/account records
- projects and organizations
- payment methods, routes, statuses, and obligations
- onchain submission and reconciliation state
- onboarding draft state
- zkAS datasets, runs, issues, results, and publication data
- audit and observability tables

### Authorization model

Authorization is hybrid:

- Supabase auth establishes identity
- app-side checks in server actions enforce role-specific permissions
- some browser reads still use anon-authenticated Supabase queries directly
- service-role reads/writes are used on the server when workflows need broader access

There is evidence of RLS and audit triggers in the migrated schema, but the current app architecture still depends heavily on explicit server authorization logic in TypeScript.

## 6. Operational and Testing Architecture

### Validation

The main repo quality gate is:

- `pnpm check`

which runs:

- lint
- unit/integration tests
- typecheck
- production build

### Browser coverage

The repo now has two Playwright lanes:

- `remote-safe`
- `local-wallet`

This is important architecturally because it reflects the current deployment shape:

- some flows can be safely tested against a shared non-production app
- true wallet transaction coverage still needs local chain/runtime control

### Contracts workspace

The `contracts/` folder is a separate Hardhat workspace, not integrated into the root build as a package dependency graph.

That means:

- the app and the contracts are versioned together
- but they are validated separately
- deployment and local wallet tests bridge them via scripts and manifest sync

## 7. Current Architectural Strengths

- Clear Supabase client separation between browser, SSR, and service-role contexts.
- Stronger-than-before production boundaries around wallet configuration and onchain reconciliation.
- App Router boundaries are mostly respected even though some pages remain browser-heavy.
- Payments, onchain verification, and observability now form a coherent operational pipeline.
- zkAS has a reasonably explicit control-plane architecture with real role separation.

## 8. Current Architectural Seams and Concentration Points

These are the main places where the architecture is still carrying meaningful complexity or debt.

### `app/actions/project-payment-actions.ts` is a hotspot

It currently acts as:

- auth gate
- payment domain service
- route manager
- onchain submission recorder
- admin operations façade
- reconciliation launcher

This is workable, but it is the clearest candidate for future decomposition into smaller domain modules.

### Payments pages are still fairly client-heavy

`/projects/[slug]/payments` owns a lot of data loading and orchestration in one client page. It works, but it means:

- more browser-side Supabase coupling
- larger interaction surfaces inside one component tree
- less server-rendered composition than the admin pages

### Main app process still hosts background-style behavior

Reconciliation and observability ingestion both run inside the Next app deployment. That is fine for the current stage, but it means there is not yet a separate worker or queue boundary.

### README has some drift

The README still mentions a top-level `zkas/` engine/workspace, but the current codebase’s zkAS logic is centered in `lib/zkas/`, `app/actions/zkas-actions.ts`, and the related routes. Future docs should keep aligning to the actual repo structure.

## 9. Recommended Mental Model For Contributors

Treat the repo as five overlapping layers:

1. Marketing/public site
2. Authenticated application shell and onboarding
3. Payments and wallet operations
4. Internal operations and observability
5. zkAS control plane

And treat the main technical boundaries as:

- App Router rendering boundary: server vs client components
- Supabase access boundary: browser vs SSR vs admin client
- Payment execution boundary: app-recorded submission vs later onchain reconciliation
- Role boundary: public user vs project admin vs internal admin vs zkAS superadmin

That model matches the codebase more accurately than thinking of it as “just a website with some admin pages.”

## 10. Suggested Follow-Up Docs

If this repo keeps growing, the next useful docs would be:

- a payments/onchain sequence diagram
- a zkAS lifecycle doc from dataset upload through publication
- a role and authorization matrix
- a deployment/runtime topology doc for local, preview, and production

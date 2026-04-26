# Edge Function Contract Pattern

Last reviewed: 2026-04-15

This document defines the app-side contract for Supabase Edge Functions in FundLoop.

## Goals

- use one standard request/response envelope for Edge Function commands
- keep client and server invocation paths consistent
- make function-specific adapters easy to discover and reuse
- separate transport from domain logic so later migrations can reuse the same pattern

## Standard Envelope

Use:

- success: `{ ok: true, data }`
- failure: `{ ok: false, error: { code, message } }`

The app should treat a declared failure envelope differently from transport or invocation failures. Transport failures must be normalized into the same failure envelope before reaching product code.

## Invocation Rules

- browser callers use the repo-owned browser Supabase client through a shared Edge Function invoker
- server callers use the SSR-aware server Supabase client through the matching server invoker
- function-specific adapters live under `lib/edge-functions/`
- function names should follow command-style naming such as `project-payment-drafts-create`
- each function directory should use an `index.ts` entrypoint so the Supabase CLI can bundle and deploy it consistently
- helper-only directories under `supabase/functions/` such as `_shared` and `_vendor` are part of the bundle graph, but they must be excluded from function deployment enumeration
- shared modules imported by Edge Functions should use explicit `.ts` or `.json` local specifiers because the Supabase bundle step runs on Deno resolution rules, not Node-style extension guessing
- shared modules imported by Edge Functions must not rely on Next-only runtime markers such as `import "server-only"`; keep those markers on Next-only wrappers instead
- packages consumed by Edge Functions through shared modules must be mapped explicitly in `supabase/functions/deno.json` when Deno cannot resolve the normal app import directly
- the current `@cubid/api` mapping points at the installed package entrypoint under the repo root `node_modules/` so the app no longer needs a function-local `_vendor` mirror; switch that mapping to a `jsr:` package import once the Cubid repo publishes the package
- the root Next.js `tsc` run excludes `supabase/functions/` because those files are Deno-targeted and validated through the Supabase CLI and deploy workflow rather than the app TypeScript program
- the deploy workflow installs repo dependencies before function bundling and `supabase/functions/deno.json` enables `nodeModulesDir` so vendored package dependencies remain available during remote bundling

## Current First Command

The first migrated domains are:

- `project-payment-drafts-create`
- founder payment operations:
  - `project-crypto-route-create`
  - `project-crypto-route-update`
  - `project-crypto-route-move`
  - `project-crypto-route-enabled-set`
  - `project-onchain-payment-submission-record`
- internal payment operations:
  - `admin-payment-receipt-confirm`
  - `admin-onchain-payment-reconciliation-run`
- `user-cubid-resolve-email`
- `user-cubid-sync-profile`
- onboarding writes:
  - `user-onboarding-draft-upsert`
  - `user-onboarding-draft-clear`
  - `user-onboarding-publish`
  - `project-onboarding-draft-upsert`
  - `project-onboarding-draft-clear`
  - `project-onboarding-publish`

The canonical write path is now:

- browser UI calls `invokeProjectPaymentDraftsCreateBrowser(...)`
- the Supabase function authenticates with the bearer token from `functions.invoke(...)`
- the function runs the shared payment-draft command module
- the legacy server action remains only as a compatibility wrapper around the server invoker

For founder payment operations:

- the payment-route manager calls browser Edge Function adapters for route create, update, move, enable, and disable commands
- the crypto payment dialog records onchain submissions through `project-onchain-payment-submission-record`
- the extracted command module owns project-admin authorization, route reference validation, default promotion, deployment availability checks, receipt validation, and receipt-recording observability
- read paths for payment routes and latest submissions still temporarily live outside Edge Functions

For onboarding:

- `components/user-signup-flow.tsx` and `components/project-signup-flow.tsx` now call browser Edge Function adapters for draft save, clear, and publish
- `app/actions/onboarding-actions.ts` keeps read helpers such as `getOnboardingState()` and `searchProjectsForTeamMember()`
- publish still relies on the existing `publish_project_onboarding_draft_atomic` RPC for the atomic project materialization step
- publish now also enforces a linked CUBID identity (`linked` or `verified`) for both user and project onboarding

For CUBID:

- `user-cubid-resolve-email` is the canonical write path for resolving or auto-creating a CUBID identity from the authenticated user email
- `user-cubid-sync-profile` is the canonical write path for refreshing the normalized identity snapshot and stamps
- the functions use direct HTTP calls to the CUBID API and the local CUBID v2 SDK packages rather than a remote npm dependency install
- the app invokes browser adapters from onboarding and account/workspace surfaces, while server-side publish commands still enforce the same identity requirement for bypass safety
- phone OTP and verified-stamp persistence use authenticated internal Next route handlers as a browser bridge so `CUBID_API_KEY` never enters the client bundle

For internal payment operations:

- admin payment confirmation now goes through `admin-payment-receipt-confirm`
- admin/manual and cron-triggered reconciliation now go through `admin-onchain-payment-reconciliation-run`
- browser admin UI calls the browser adapters directly
- the stable internal route `/api/internal/payments/reconcile-onchain` is now only a secret-gated wrapper around the reconciliation Edge Function
- operator Edge Functions can authenticate either through a real Supabase user JWT or through `x-fundloop-cron-secret` for internal system callers

The migration is intentionally incremental so the transport layer can stabilize before broader read migration and later founder/user workspace work.

## Remote Deployment

Remote Supabase deployment is handled by the `Supabase Deploy` GitHub Actions workflow.

- PRs into `dev` and `main` run `supabase db push --dry-run` against the matching Supabase target.
- Pushes to `dev` and `main` run `supabase db push` and then deploy each tracked function directory explicitly.
- `main` deploys use the GitHub `Production` environment gate; non-production runs use `Preview`.
- The workflow deploys all tracked Edge Functions in one command, but it does not manage function runtime secrets.

See [Supabase Remote Deployments](./supabase-deployments.md) for the required GitHub secrets and target routing rules.

## Local Development

Typical local workflow:

```bash
supabase start
pnpm supabase:functions:serve:project-payment-drafts-create
```

For onboarding commands, use the same CLI pattern directly:

```bash
supabase functions serve user-onboarding-draft-upsert --env-file .env.local
supabase functions serve user-onboarding-publish --env-file .env.local
supabase functions serve project-onboarding-draft-upsert --env-file .env.local
supabase functions serve project-onboarding-publish --env-file .env.local
supabase functions serve user-cubid-resolve-email --env-file .env.local
supabase functions serve user-cubid-sync-profile --env-file .env.local
supabase functions serve project-crypto-route-create --env-file .env.local
supabase functions serve project-crypto-route-update --env-file .env.local
supabase functions serve project-crypto-route-move --env-file .env.local
supabase functions serve project-crypto-route-enabled-set --env-file .env.local
supabase functions serve project-onchain-payment-submission-record --env-file .env.local
supabase functions serve admin-payment-receipt-confirm --env-file .env.local
supabase functions serve admin-onchain-payment-reconciliation-run --env-file .env.local
```

Once the local stack is running, invoke the command through the app or by calling the local functions endpoint with an authenticated bearer token.

Quick manual smoke:

```bash
curl -i \
  -X POST \
  "$NEXT_PUBLIC_SUPABASE_URL/functions/v1/project-payment-drafts-create" \
  -H "Authorization: Bearer <user-access-token>" \
  -H "apikey: $NEXT_PUBLIC_SUPABASE_ANON_KEY" \
  -H "content-type: application/json" \
  -d '{"projectSlug":"your-project-slug","payments":[{"period_start":"2026-04-01","period_end":"2026-04-30","revenue":1000,"payment_amount":10,"payment_percentage":1,"payment_method_id":1}]}'
```

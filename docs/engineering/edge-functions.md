# Edge Function Contract Pattern

Last reviewed: 2026-04-14

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

## Current First Command

The first command migrated to this pattern is:

- `project-payment-drafts-create`

It is intentionally narrow so the transport layer can stabilize before broader onboarding and payment migrations.

## Local Development

Typical local workflow:

```bash
supabase start
supabase functions serve project-payment-drafts-create --env-file .env.local
```

Once the local stack is running, invoke the command through the app or by calling the local functions endpoint with an authenticated bearer token.

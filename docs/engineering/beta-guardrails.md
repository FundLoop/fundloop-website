# Beta Runtime Guardrails

Session 51 moved a small set of beta-critical safety expectations from docs into runtime checks. This is not a complete security program; it records what is enforced now and what remains deliberately deferred.

## Enforced Now

- Private zkAS run artifact downloads validate the stored object path before reading Supabase Storage.
- Artifact paths must be relative, normalized, free of traversal segments, and scoped to the requested cycle/run/kind.
- zkAS artifact responses set `cache-control: no-store` and `x-content-type-options: nosniff`.
- Monthly-cycle verification review, monthly-cycle approval, and payout-intent creation commands reject non-`internal_admin` actors before database mutation.
- Monthly-cycle approval now writes failure audit events when a known cycle cannot be approved because of wrong status, missing completed run, unverified run, missing result artifact hash, failed update, or state race.
- Operator payment/reconciliation reads use explicit partial-read warning models rather than silently hiding degraded secondary data.

## Still Deferred

- Distributed rate limiting for expensive Edge Function commands needs shared infrastructure, for example a database-backed or gateway-backed limiter. In-memory process throttles are intentionally not used because they are misleading in serverless runtimes.
- Scoped raw artifact download links for MCP or non-web clients should be implemented as dedicated Edge Function commands before exposing private bytes outside the authenticated web route.
- Broader artifact-access audit trails should be added when the product has a canonical audit-event table for storage reads. Monthly-cycle event rows remain reserved for cycle stage transitions and command outcomes.
- Abuse controls for public funnels and support forms should be added at the route or edge/gateway layer once beta traffic patterns are known.

## Implementation Rules

- Do not bypass storage path builders in `lib/storage/artifacts.ts` for new product artifacts.
- Do not return raw private storage URLs to browsers, MCP tools, or agents.
- Sensitive cycle-stage commands should return clear `forbidden` failures for unsupported actor roles before doing reads that are only needed for mutation.
- When a command knows the target monthly cycle and then rejects a sensitive state transition, record a `monthly_cycle_events` failure row where the schema supports that event type.

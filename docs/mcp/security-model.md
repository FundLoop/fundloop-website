# FundLoop MCP Security Model

FundLoop MCP is a product-control surface. Treat it like an API used by autonomous clients, not like a trusted developer console.

## Assets

- Supabase user sessions and actor identity.
- Project contribution routes, payment obligations, and onchain receipt records.
- Monthly-cycle state, manifests, calculation artifacts, payout intents, and reports.
- CUBID identity linkage and snapshot-derived trust signals.
- Private Supabase Storage artifact paths and hashes.
- Operator observability and reconciliation data.

## Authentication

Current stdio development uses `FUNDLOOP_MCP_BEARER_TOKEN` as a Supabase user bearer token. Production remote MCP should validate Supabase JWTs at the MCP endpoint or inside the Edge Function handler.

Rules:

- Missing credentials fail closed for every non-health workflow tool.
- Tokens must be validated for issuer, expiration, and intended FundLoop/Supabase audience.
- Tokens issued for other services must not be accepted.
- MCP must not pass a client token through to unrelated downstream services.

## Authorization

Authorization is tool-specific and server-side.

- Regular users can only access their own workspace, earnings, participation, identity status, and payout readiness.
- Founders and project members can only access projects they manage or belong to through existing FundLoop membership checks.
- Internal operators must pass the existing internal-admin authorization rules.
- Destructive or sensitive operator mutations require explicit confirmation and an audit reason if introduced later.

## Data Classification

- Public: marketing routes, public project pages, public reporting summaries.
- Authenticated personal: user workspace, earnings, payout preferences, CUBID-linked status.
- Project-private: founder obligations, contribution submissions, attribution data, payment-route operations.
- Operator-private: reconciliation queues, cycle observability, exception review, private artifact references.
- Secret: Supabase service-role keys, cron secrets, CUBID API keys, wallet/runtime credentials, bearer tokens.

MCP responses may include public and authorized workflow data. MCP responses must never include secret data.

## Tool Safety

- Inputs must use strict schemas and reject unknown or oversized data.
- Write tools should use typed Edge Function commands and idempotency/attempt IDs where the domain supports retries.
- Tools must return stable error codes without stack traces.
- Tool output should be concise and structured; avoid dumping raw database rows or raw external API payloads.
- Private artifacts should be represented by metadata and scoped retrieval references, not streamed through generic MCP tools.

## Rate Limiting And Abuse Controls

FundLoop does not yet have a complete distributed MCP-specific rate limiter. Until it does:

- keep the public remote MCP endpoint unavailable,
- keep generic Edge invocation disabled by default,
- prefer read-only operator tools,
- document any temporary integration allowlist,
- rely on Edge Function/domain-level idempotency and audit events where already present.

Before production publication, add per-actor and per-tool throttling at the Edge runtime, gateway, or backing command layer.

## Audit Expectations

At minimum, log or reuse existing workflow events for:

- auth failures,
- authorization failures,
- tenant/project mismatches,
- write tool calls,
- operator/admin reads,
- destructive or override actions,
- rate-limit failures once rate limiting exists.

Logs must redact bearer tokens, service keys, private URLs, payment credentials, and CUBID API secrets.

## Threat Model Summary

- Prompt injection through user-generated content: tools should treat returned text as data and avoid including model instructions in output.
- Cross-project access: every project slug/id must be authorized server-side.
- Token misuse: do not accept wrong-audience tokens or pass tokens to unrelated services.
- Replay/retry duplication: write tools need idempotency or explicit attempt IDs.
- Secret leakage: no secret values in `content`, `structuredContent`, `_meta`, logs, or widget state.
- Tool explosion: keep tools intent-based and avoid exporting every backend operation.

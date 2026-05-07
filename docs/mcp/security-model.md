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

Current stdio development uses `FUNDLOOP_MCP_BEARER_TOKEN` as a Supabase user bearer token. Production remote MCP validates Supabase JWTs inside the Edge Function handler before creating the MCP server for tool traffic.

Rules:

- `GET /functions/v1/mcp/health` is public and must remain non-sensitive.
- Streamable HTTP tool traffic must include `Authorization: Bearer <token>` and resolve a real Supabase user through `auth.getUser()` before the MCP server registers and dispatches tools.
- `FUNDLOOP_MCP_ALLOW_LOCAL_TEST_TOKEN=true` may be used only for direct local Edge-handler smoke without a live Supabase auth service; it must not be configured in Preview or Production.
- Missing credentials fail closed for every non-health workflow tool.
- Tokens must be validated for issuer, expiration, and intended FundLoop/Supabase audience.
- Tokens issued for other services must not be accepted.
- MCP must not pass a client token through to unrelated downstream services.

## Authorization

Authorization is tool-specific and server-side.

- Regular users can only access their own workspace, earnings, participation, identity status, and payout readiness.
- Founders and project members can only access projects they manage or belong to through existing FundLoop membership checks.
- Internal operators must pass the existing internal-admin authorization rules.
- Operator-prefixed MCP tools are blocked before handler execution unless the authenticated user's email is present in `FUNDLOOP_INTERNAL_ADMIN_EMAILS`.
- Generic Edge command invocation remains allowlisted and additionally blocks operator/destructive command names for non-operators.
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
- Tool schemas should set explicit string, number, object, and nesting limits rather than relying only on handler-level checks.
- Non-URL string fields reject URL-shaped values. If a future tool needs URL fetching, it must declare and enforce an allowlist and block local/private network targets.
- Write tools should use typed Edge Function commands and idempotency/attempt IDs where the domain supports retries.
- Tools must return stable error codes without stack traces.
- Tool output should be concise and structured; avoid dumping raw database rows or raw external API payloads.
- Text output is treated as untrusted data and redacted for obvious bearer tokens, JWT-shaped values, secret assignments, script tags, and common prompt-injection phrases before being returned to MCP clients.
- Private artifacts should be represented by metadata and scoped retrieval references, not streamed through generic MCP tools.

## Resource And Prompt Safety

- MCP resources are read-only JSON snapshots and must reuse existing authenticated workflow readers or scoped Edge read gateways.
- Resource lists should not expose operator-only resources to non-operator actors.
- Resource reads must not include raw CUBID payloads, payout destinations, private artifact bodies, signed URLs, service-role-derived internals, bearer tokens, or provider secrets.
- Prompts are workflow starters only. They may recommend safe tools to call, but must not smuggle hidden instructions, override client/user intent, or imply facts that were not returned by MCP tools or supplied by the user.
- Any future resource that streams private artifacts must use a dedicated scoped authorization path rather than a broad generic resource URI.

## Rate Limiting And Abuse Controls

FundLoop does not yet have a complete distributed MCP-specific rate limiter. Until it does:

- keep the public remote MCP endpoint limited to authenticated non-production smoke unless an explicit production rollout approves it,
- keep generic Edge invocation disabled by default,
- prefer read-only operator tools,
- document any temporary integration allowlist,
- rely on Edge Function/domain-level idempotency and audit events where already present.

Before production publication, add per-actor and per-tool throttling at the Edge runtime, gateway, or backing command layer.

Session MCP-10 added structured MCP dispatch events that can be converted into hosted log metrics. Use `docs/mcp/runbook.md` for the current metric names, alert recommendations, and emergency tool-disable process.

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

MCP-3 logs structured authentication failures, authorization failures, and successful tool dispatches without bearer tokens or payload bodies. MCP-10 expanded those events with request id, hashed client/user/tenant identifiers, tool category, status, latency, and stable error code fields.

## Threat Model Summary

- Prompt injection through user-generated content: tools should treat returned text as data and avoid including model instructions in output.
- Cross-project access: every project slug/id must be authorized server-side.
- Token misuse: do not accept wrong-audience tokens or pass tokens to unrelated services.
- Replay/retry duplication: write tools need idempotency or explicit attempt IDs.
- Secret leakage: no secret values in `content`, `structuredContent`, `_meta`, logs, or widget state.
- Tool explosion: keep tools intent-based and avoid exporting every backend operation.

# FundLoop MCP Operations Runbook

This runbook covers the current FundLoop MCP runtime: local stdio plus the authenticated Supabase Edge Function at `/functions/v1/mcp`.

## Quick Triage

For a reported MCP issue, first identify:

- Environment: local, Preview/dev, or Production.
- Transport: stdio or Streamable HTTP.
- Request id from logs, if available.
- Tool name and actor role.
- Whether the failure is auth, authorization, validation, backing Edge command, or MCP protocol shape.

Do not ask users to share bearer tokens, cookies, Supabase keys, payout destinations, raw CUBID payloads, or private report artifacts.

## Logs And Metrics

MCP tool dispatch emits structured JSON log events with:

- `requestId`
- hashed `clientId`
- hashed `userIdHash`
- hashed `tenantIdHash`
- `actorRole`
- `toolName`
- `toolCategory`
- `status`
- `latencyMs`
- `errorCode`

Use hosted log search or GitHub/Supabase deploy logs to filter by `surface=mcp`, `requestId`, `toolName`, or `errorCode`. Treat these logs as operational metadata only; payload bodies and bearer tokens should not appear.

Recommended hosted log metrics:

- calls per tool: count `event=tool_success` plus failures by `toolName`
- error rate per tool: failure count divided by total calls
- p50/p95/p99 latency: aggregate `latencyMs` by `toolName`
- auth failures: count `event=auth_failure`
- authorization failures: count `event=authorization_failure`
- validation failures: count `event=validation_failure`
- disabled-tool attempts: count `event=tool_disabled`

Recommended alerts:

- elevated `tool_failure` or `workflow_read_failed` rate
- spikes in `auth_failure`
- spikes in `authorization_failure`
- any unexpected destructive/operator mutation tool exposure
- sudden increases in high-volume resource reads or export-like tool calls

## Common Failures

- `not_authenticated`: missing, expired, invalid, wrong-audience, or wrong-issuer Supabase bearer token. Ask the client to refresh auth and retry.
- `forbidden`: actor is authenticated but lacks tool access, usually internal-operator access for `operator.*`.
- `invalid_payload`: input failed the strict MCP schema or safety validator.
- `payload_too_large`: input exceeded byte, string, array, object, or depth limits.
- `not_allowlisted`: the generic Edge command bridge was asked to call a function not present in `FUNDLOOP_MCP_ALLOWED_EDGE_FUNCTIONS`.
- `tool_disabled`: the tool is currently hidden/blocked by `FUNDLOOP_MCP_DISABLED_TOOLS`.
- `workflow_read_failed`: backing read gateway failed or returned an unexpected result.

## Disable A Tool

For emergency mitigation, set `FUNDLOOP_MCP_DISABLED_TOOLS` in the target Supabase Edge Function environment to a comma-separated list of exact tool names.

Example:

```env
FUNDLOOP_MCP_DISABLED_TOOLS=fundloop.edge_command.invoke,founder.project.onchain_receipt.record
```

After updating the secret/environment value, redeploy or restart the function runtime through the normal Supabase deploy path. Disabled tools are removed from `tools/list`. The local registry returns `tool_disabled` if called directly; remote SDK clients may see the tool as unavailable because it is no longer registered.

## Revoke Client Access

Current MCP auth is first-party Supabase bearer auth.

- Revoke or expire the user's Supabase session when a single actor is compromised.
- Remove the user email from `FUNDLOOP_INTERNAL_ADMIN_EMAILS` when operator access should be revoked.
- Rotate Supabase project keys only for broader environment compromise; coordinate with hosted app and Edge Function runtime owners before doing so.

## Rotate Secrets

- Rotate Supabase publishable/anon keys through the hosted app and Edge Function environment contract.
- Rotate service-role keys only through Supabase project settings and update Edge Function secrets; never put service-role keys in browser or MCP client config.
- Rotate MCP-specific allowlists by updating `FUNDLOOP_MCP_ALLOWED_EDGE_FUNCTIONS` and `FUNDLOOP_MCP_DISABLED_TOOLS`.
- Re-run `pnpm mcp:edge:smoke` against Preview/dev after rotation.

## Inspect Audit Logs

Search for `surface=mcp`. Start with:

- `event=auth_failure`
- `event=authorization_failure`
- `event=validation_failure`
- `event=tool_success`
- `event=tool_disabled`
- `toolName=<exact tool name>`
- `requestId=<reported request id>`

Do not rely on raw actor identifiers in logs; use the hashed fields to correlate repeated behavior without exposing identity details.

## Roll Back A Deployment

Preferred rollback is the repository deploy flow:

1. Revert the offending commit on `dev` or `main`.
2. Let the Supabase deploy workflow redeploy migrations/functions from the reverted branch state.
3. If only a tool is unsafe, prefer `FUNDLOOP_MCP_DISABLED_TOOLS` before reverting unrelated deploys.
4. Re-run `pnpm mcp:edge:smoke` and the relevant negative auth/authorization smoke.

Do not reset remote Supabase databases as a rollback mechanism.

## Escalation

Escalate immediately when:

- logs show repeated authorization bypass attempts,
- a tool exposes private data or secrets,
- a write tool executes for the wrong actor/project,
- operator-only data appears for a non-operator,
- the remote endpoint accepts unauthenticated tool traffic.

Use the normal FundLoop engineering/support escalation path and include only redacted request ids, tool names, hashed actor fields, timestamps, and error codes.

# FundLoop MCP Validation

This file records the repeatable MCP smoke path for local and Preview/dev validation. Do not paste bearer tokens, Supabase keys, service-role keys, CUBID secrets, payout destinations, or raw private payloads into this transcript.

## Local Stdio Smoke

Command:

```bash
pnpm mcp:smoke
```

Current expected coverage:

- `initialize`
- `tools/list`
- `tools/call` for `fundloop.health`
- `resources/list`
- `resources/read` for `fundloop://docs/mcp-overview`
- `prompts/list`
- `prompts/get` for `review-pending-tasks`

Latest transcript:

```json
{
  "ok": true,
  "server": {
    "name": "fundloop-mcp-server",
    "version": "0.1.0"
  },
  "checkedTools": ["fundloop.health"],
  "checkedResources": ["fundloop://docs/mcp-overview"],
  "checkedPrompts": ["review-pending-tasks"],
  "toolCount": 15,
  "resourceCount": 4,
  "promptCount": 4
}
```

## Local Edge Smoke

Start local Supabase and serve the MCP function with an explicit local-only test-token override. On this workstation, use the `/var/run/docker.sock` Docker endpoint when Colima's direct socket path cannot be mounted by the Edge runtime:

```bash
DOCKER_HOST=unix:///var/run/docker.sock supabase start
cat > /tmp/fundloop-mcp-local.env <<'EOF'
NEXT_PUBLIC_SUPABASE_URL=http://host.docker.internal:54321
NEXT_PUBLIC_SUPABASE_ANON_KEY=<local-publishable-key-from-supabase-start>
FUNDLOOP_MCP_ALLOW_LOCAL_TEST_TOKEN=true
FUNDLOOP_MCP_ALLOWED_EDGE_FUNCTIONS=
FUNDLOOP_INTERNAL_ADMIN_EMAILS=
EOF
DOCKER_HOST=unix:///var/run/docker.sock SUPABASE_FUNCTIONS_WATCH_LIMIT=12000 \
  supabase functions serve --no-verify-jwt mcp --env-file /tmp/fundloop-mcp-local.env
FUNDLOOP_MCP_HTTP_URL=http://127.0.0.1:54321/functions/v1/mcp \
  FUNDLOOP_MCP_BEARER_TOKEN=local-smoke-token \
  pnpm mcp:edge:smoke
```

If testing protocol wiring without JWT verification, keep it local and document it as unauthenticated development only:

```bash
supabase functions serve --no-verify-jwt mcp --env-file .env.local
```

The Edge smoke script checks:

- public `GET /health`
- authenticated `initialize`
- `tools/list`
- `resources/list`
- `prompts/list`
- `tools/call` for `fundloop.health`

Latest local Edge transcript:

```json
{
  "ok": true,
  "endpoint": "http://127.0.0.1:54321/functions/v1/mcp",
  "health": {
    "ok": true,
    "service": "fundloop-mcp-server",
    "version": "0.1.0",
    "transport": "streamable_http"
  },
  "server": {
    "name": "fundloop-mcp-server",
    "version": "0.1.0"
  },
  "toolCount": 15,
  "resourceCount": 4,
  "promptCount": 4,
  "checkedTools": ["fundloop.health"],
  "checkedResources": ["fundloop://docs/mcp-overview"],
  "checkedPrompts": ["review-pending-tasks"]
}
```

## Curl Shape

Streamable HTTP requests must include both JSON and event-stream support:

```bash
curl -sS http://127.0.0.1:54321/functions/v1/mcp \
  -H "Content-Type: application/json" \
  -H "Accept: application/json, text/event-stream" \
  -H "Authorization: Bearer $FUNDLOOP_MCP_BEARER_TOKEN" \
  -d '{"jsonrpc":"2.0","id":1,"method":"tools/list","params":{}}'
```

## Required Negative Smokes

Before promoting MCP changes beyond Preview/dev, verify:

- Missing bearer token fails for remote `POST`.
- Invalid or expired Supabase JWT fails before tool dispatch.
- Non-operator actors cannot see or read `fundloop://operator/cycles`.
- Non-operator actors cannot call `operator.*` tools.
- Cross-project slugs fail through `mcp-workflow-read` or the backing Edge command.

## Session MCP-8 Notes

The tracked smoke scripts now cover tools, resources, and prompts. Live local Edge smoke still depends on local Supabase being started with compatible `.env.local` values and should be rerun whenever MCP auth, SDK registration, or `supabase/functions/mcp/index.ts` changes.

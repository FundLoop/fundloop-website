# FundLoop MCP Server

This package is the local stdio MCP runtime for FundLoop agents. It is intentionally thin: tools call the same typed Edge Function contracts and read gateways used by the web app instead of inventing a second backend.

## Runtime

Run from the repo root:

```bash
pnpm mcp:dev
```

Required environment:

```env
FUNDLOOP_MCP_BEARER_TOKEN=
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
```

Optional environment:

```env
FUNDLOOP_MCP_ALLOWED_EDGE_FUNCTIONS=
```

The stdio server writes MCP JSON-RPC frames to stdout. Keep logs on stderr so protocol clients do not receive non-protocol output.

## Smoke

```bash
pnpm mcp:smoke
```

The smoke sends `initialize`, `tools/list`, and `tools/call` for `fundloop.health` over Content-Length framed stdio messages.

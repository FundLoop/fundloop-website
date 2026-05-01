# MCP Server

FundLoop's MCP server is the protocol-facing entry point for agents acting on behalf of founders, project members, and selected internal operators.

The server must not become a second backend. It should use the same typed Edge Function command contracts, read-model boundaries, authorization assumptions, and observability streams as the web app.

## Package

Session 38 introduced `packages/mcp-server` as a lightweight workspace package.

- `src/protocol.ts` defines the small JSON-RPC/MCP response shapes used by the skeleton.
- `src/auth.ts` creates an MCP actor context from an authenticated bearer token.
- `src/edge-client.ts` invokes Supabase Edge Functions with the standard `{ ok, data | error }` command envelope.
- `src/tools.ts` owns tool registration and dispatch.
- `src/server.ts` provides the stdio server entrypoint for local MCP clients.

## Runtime Configuration

The skeleton expects:

- `FUNDLOOP_MCP_BEARER_TOKEN`: Supabase user bearer token for the agent's current actor.
- `NEXT_PUBLIC_SUPABASE_URL` or `SUPABASE_URL`: Supabase project URL.
- `NEXT_PUBLIC_SUPABASE_ANON_KEY` or `SUPABASE_ANON_KEY`: public anon key used to invoke Edge Functions.
- `FUNDLOOP_MCP_ALLOWED_EDGE_FUNCTIONS`: comma-separated allowlist for the generic low-level Edge Function tool.

The generic Edge Function invoker is intentionally allowlisted. Product tools added in later sessions should prefer explicit typed handlers over exposing arbitrary function names to agents.

## Tool Rules

- Tool inputs and outputs should be stable, typed, and small.
- Founder/project-member tools should enforce role boundaries through the same Edge Function commands and read models used by the app.
- Internal-operator tools should start read-only unless a session explicitly introduces a safe mutation.
- Tool failures should return protocol-visible error content and should also be visible through the relevant app observability stream.

## Current Skeleton

Session 38 registers:

- `fundloop.health`: returns service and actor context.
- `fundloop.edge_command.invoke`: low-level allowlisted Edge Function invocation for local development and early integration tests.

Sessions 39 and 40 should add first-class domain tools for founder, project-member, and operator workflows so agents do not need to use the low-level invoker directly.

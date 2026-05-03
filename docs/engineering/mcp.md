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

## Founder Tools

Session 39 added the first explicit founder tools:

- `founder.projects.list`
- `founder.project.cycle_status`
- `founder.project.crypto_route.create`
- `founder.project.crypto_route.update`
- `founder.project.onchain_receipt.record`

Founder reads go through a `FounderWorkflowReader` boundary. The default implementation uses authenticated Supabase REST reads with the same bearer token as the agent. Founder writes call the existing typed Edge Function command names for route management and onchain receipt recording.

Sessions 40 should add project-member and operator workflows so agents do not need to use the low-level invoker directly.

## Project-Member And Operator Tools

Session 40 added read-only project-member and operator tools:

- `project_member.project.reporting_status`
- `operator.cycles.list`
- `operator.cycle.observability`
- `operator.payments.reconciliation_visibility`
- `operator.reporting.coverage`

These tools intentionally do not mutate state. They use `ProjectMemberWorkflowReader` and `OperatorWorkflowReader` boundaries so the implementation can move from direct authenticated Supabase REST reads to Edge Function read models in Session 41 without changing the MCP tool contract.

## Read Boundary

Session 41 added `mcp-workflow-read` as the first typed Edge Function read gateway for MCP-facing workflow reads. The default MCP founder, project-member, and operator readers now call this Edge Function instead of reading Supabase REST tables directly.

Current operations:

- `founder.projects.list`
- `founder.project.cycle_status`
- `project_member.project.reporting_status`
- `operator.cycles.list`
- `operator.cycle.observability`
- `operator.payments.reconciliation_visibility`
- `operator.reporting.coverage`

This keeps MCP read behavior behind the same auth and command envelope style as writes, while preserving narrow reader interfaces for future app-side reuse.

## Artifact References

Session 43 standardized Supabase Storage artifact references in `lib/storage/artifacts.ts`. MCP tools should return artifact metadata such as bucket, path, kind, hash, visibility, and retention instead of inventing paths or streaming private storage contents directly. Any future raw artifact download tool should be backed by a scoped Edge Function authorization check.

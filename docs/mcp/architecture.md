# FundLoop MCP Architecture

FundLoop's MCP capability should expose agent workflows without becoming a second backend. The MCP layer must call the same Edge Function command contracts, read gateways, and authorization checks used by the web app.

## Current State

The repository already has a local stdio MCP package at `packages/mcp-server`.

- Runtime: Node stdio package for local clients.
- Smoke path: `pnpm mcp:smoke`.
- Current read gateway: Supabase Edge Function `mcp-workflow-read`.
- Current write path: typed Edge Function command invocations for founder payment-route and onchain receipt workflows.
- Current low-level bridge: `fundloop.edge_command.invoke`, restricted by `FUNDLOOP_MCP_ALLOWED_EDGE_FUNCTIONS`.

This is useful for local and controlled agent experiments, but it is not yet the preferred production shape.

## Target Runtime

The target production shape is a remote MCP server over Streamable HTTP, deployed as a Supabase Edge Function once auth and operational controls are ready.

- Remote endpoint: `https://<project-ref>.supabase.co/functions/v1/mcp`.
- Local endpoint for Edge development: `http://127.0.0.1:54321/functions/v1/mcp`.
- Local stdio wrapper: optional compatibility layer that forwards to the same tool registry and Edge/read contracts.
- SDK choice: official MCP TypeScript SDK with an Edge-compatible Streamable HTTP transport if it bundles cleanly under Supabase Deno; otherwise evaluate `mcp-lite` or `mcp-handler` as a narrow runtime adapter.

Session MCP-2 added `supabase/functions/mcp/index.ts` as the first remote Streamable HTTP endpoint. It uses the official MCP TypeScript SDK with `WebStandardStreamableHTTPServerTransport`, while the local stdio package remains the compatibility harness for local clients and smoke checks.

Session MCP-3 hardened the remote endpoint so Streamable HTTP tool traffic must resolve to a real Supabase user through `auth.getUser()` before MCP tool registration or dispatch. The MCP registry now also performs a front-door authorization check for operator-prefixed tools and operator/destructive generic Edge command names.

Session MCP-6 added first-class MCP resources and prompts to the same stdio and remote Streamable HTTP runtimes. Resources are read-only JSON snapshots backed by existing workflow readers, and prompts are workflow starters that point clients at safe read tools rather than embedding hidden instructions.

## Tool Handler Rule

Tool handlers should be thin orchestration layers:

1. Validate MCP input with strict schemas.
2. Build an actor context from the authenticated request.
3. Call a typed Edge Function command, an Edge read gateway, or a server-owned read-model boundary.
4. Return stable `structuredContent` that contains no secrets or privileged internal payloads.
5. Record or rely on the same workflow audit events used by the app.

Session MCP-4 moved the first validation and output-safety checks into the shared registry path so SDK, stdio, and remote Streamable HTTP transports all enforce the same limits before handlers run. Tool-specific handlers may still validate domain rules, but they should not be the only place that rejects unknown fields, oversized values, unsafe URL-shaped input, or malformed ids/slugs.

MCP tools must not query raw tables directly in production unless a design doc records the temporary exception and the same authorization logic is reusable outside MCP.

## Auth Model

Initial production auth uses Supabase JWT validation for first-party or workspace-bound clients. OAuth 2.1 can be added later for broader third-party MCP clients.

- `GET /health` is public and returns only non-sensitive service metadata.
- Streamable HTTP `POST` requests require an `Authorization: Bearer <token>` header and a successful Supabase `auth.getUser()` lookup before tool registration or dispatch.
- User/founder/project-member tools run as the signed-in Supabase user.
- Operator tools require the same internal-admin allowlist and role checks used by the app.
- Generic command invocation remains disabled unless explicitly allowlisted for a non-production integration.
- No token passthrough to downstream services.

MCP-3 keeps OAuth 2.1, PKCE, dynamic client registration, and public registry publication deferred. The only production auth model introduced here is first-party Supabase JWT validation.

## Tenant Model

FundLoop tenancy is role and entity scoped rather than a separate tenant table.

- User tools are scoped to the authenticated user.
- Founder tools are scoped to projects the actor manages through existing project/organization membership rules.
- Project-member tools are scoped to projects the actor belongs to.
- Operator tools are global only after internal-operator authorization.

Resources follow the same model: user resources are scoped to the authenticated user, founder resources are scoped to managed projects, and operator resources are hidden from `resources/list` and blocked on read unless the actor is an internal operator.

## Deployment Environments

- Local: stdio package plus local Supabase; useful for smoke and tool development.
- Local Edge smoke: `FUNDLOOP_MCP_HTTP_URL=http://127.0.0.1:54321/functions/v1/mcp pnpm mcp:edge:smoke`.
- Preview/dev: remote Supabase project and Preview app environment; suitable for MCP integration testing with non-production actors.
- Production/main: only after Streamable HTTP auth, rate limiting, audit expectations, and publication docs are complete.

## Publication Plan

Do not publish FundLoop MCP to a public registry from the current stdio package alone. Publication should wait until:

- remote Streamable HTTP runtime exists,
- auth and scopes are documented,
- `docs/mcp/security-model.md` is accepted,
- tool catalog is reviewed,
- production smoke transcript exists,
- support/contact/version metadata exists.

## Readiness Gates

- `pnpm mcp:smoke` passes locally.
- `mcp-workflow-read` deploys through the Supabase deploy workflow.
- Every tool in `docs/mcp/tool-catalog.md` has a source boundary.
- No production MCP tool depends on service-role credentials in the MCP runtime.
- Operator tools are read-only unless a session introduces a specific audited mutation.

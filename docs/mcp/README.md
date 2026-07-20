# FundLoop MCP Docs

FundLoop MCP lets authenticated agents interact with selected FundLoop workflows through a small, typed, auditable protocol surface.

Current runtimes:

- local stdio harness: `packages/mcp-server`
- remote Streamable HTTP endpoint: `supabase/functions/mcp`
- public landing page: `/mcp`

## Start Here

- [Architecture](./architecture.md): runtime, transport, tenant model, deployment environments, publication plan.
- [Tool Catalog](./tool-catalog.md): current tools, actor expectations, source boundaries, and failure cases.
- [Auth and Scopes](./auth-and-scopes.md): Supabase bearer auth, actor roles, operator allowlist, and deferred OAuth scope model.
- [Security Model](./security-model.md): data classification, resource/prompt safety, abuse controls, audit expectations, and threat model.
- [Testing](./testing.md): local tests, smoke scripts, Edge smoke, registry metadata check, and promotion gates.
- [Validation](./validation.md): latest local smoke transcript and negative-smoke checklist.
- [Readiness Ledger](./readiness.md): implementation-ready versus production-launched gate status.
- [Deployment](./deployment.md): Preview/Production secrets, deploy workflow, hosted smoke, and rollback.
- [Publication](./publication.md): `server.json`, registry/directory status, and publication gates.
- [Runbook](./runbook.md): operational triage, logs/metrics, disabling tools, secret rotation, access revocation, and escalation.
- [Changelog](./changelog.md): MCP capability milestones.

## Connect Locally

Run the stdio harness smoke:

```bash
pnpm mcp:smoke
```

Serve and smoke the local Edge endpoint when local Supabase is running:

```bash
FUNDLOOP_MCP_HTTP_URL=http://127.0.0.1:55321/functions/v1/mcp \
  FUNDLOOP_MCP_BEARER_TOKEN=local-smoke-token \
  pnpm mcp:edge:smoke
```

For hosted Preview/Production smoke, use a real non-production Supabase access token and set:

```bash
FUNDLOOP_MCP_REQUIRE_HTTPS=true
```

## Add A Tool

1. Add or reuse a typed Edge Function/read-model boundary. Do not bypass product authorization.
2. Register an intent-based tool in `packages/mcp-server/src/*-tools.ts`.
3. Add strict `inputSchema`, `outputSchema`, annotations, and bounded descriptions.
4. Ensure the handler uses existing Edge/read clients and returns stable error codes.
5. Add unit/contract coverage under `tests/mcp-*.test.ts`.
6. Update [Tool Catalog](./tool-catalog.md), [Security Model](./security-model.md), and [Validation](./validation.md) when the surface changes.

Do not expose raw SQL, shell execution, filesystem access, arbitrary URL fetching, service-role keys, or open-ended admin tools.

# FundLoop MCP Testing

## Local Unit And Contract Tests

Run the MCP package test suite:

```bash
pnpm mcp:test
```

This covers:

- stdio JSON-RPC request handling
- SDK adapter schema conversion
- remote auth context creation
- founder/user/project-member/operator tools
- registry-wide schema, annotation, auth, resource, prompt, redaction, and error-shape coverage

Run the whole app gate when MCP changes touch shared app code:

```bash
pnpm dlx node@22.22.1 /opt/homebrew/bin/pnpm check
```

## Stdio Smoke

```bash
pnpm mcp:smoke
```

The stdio smoke verifies:

- initialize
- tools/list
- fundloop.health
- resources/list
- docs resource read
- prompts/list
- review-pending-tasks prompt

## Edge Smoke

Local:

```bash
FUNDLOOP_MCP_HTTP_URL=http://127.0.0.1:55321/functions/v1/mcp \
  FUNDLOOP_MCP_BEARER_TOKEN=local-smoke-token \
  pnpm mcp:edge:smoke
```

Hosted:

```bash
FUNDLOOP_MCP_HTTP_URL=https://<project-ref>.supabase.co/functions/v1/mcp \
  FUNDLOOP_MCP_BEARER_TOKEN=<non-production-smoke-token> \
  FUNDLOOP_MCP_REQUIRE_HTTPS=true \
  pnpm mcp:edge:smoke
```

The Edge smoke verifies public health, missing-bearer failure, initialize, tools/list, resources/list, prompts/list, and fundloop.health.

## Registry Metadata

```bash
pnpm mcp:registry:check
```

This validates the local `server.json` publication metadata baseline. It is not a substitute for the official registry validator or `mcp-publisher`.

## Negative Tests Before Production Publication

Before public production publication, verify:

- missing bearer token fails
- invalid/expired bearer token fails
- non-operator cannot call `operator.*`
- non-operator cannot read `fundloop://operator/cycles`
- cross-project slug fails through `mcp-workflow-read` or the backing Edge command
- generic `fundloop.edge_command.invoke` is disabled unless explicitly justified
- `FUNDLOOP_MCP_DISABLED_TOOLS` hides and blocks a known test tool

## Deferred Stress Coverage

The current suite does not yet include distributed rate-limit/load tests, concurrent hosted calls, timeout/retry stress, or a live seeded Supabase integration matrix for every tool. Those remain promotion gates for a later hardening pass.

# FundLoop MCP Publication

FundLoop MCP is not published to the official MCP Registry yet. Session MCP-12 adds the metadata and validation baseline so publication can happen deliberately after the remote Preview/Production deployment gates are green.

## Current Decision

- Primary distribution target: hosted remote MCP server over Streamable HTTP.
- Local harness: keep `packages/mcp-server` as a private stdio compatibility package for local development and smoke testing.
- Public package publication: deferred. The registry can point at the hosted remote endpoint first.
- Registry metadata file: `server.json`.
- Local metadata check: `pnpm mcp:registry:check`.

## Registry Notes

The official MCP Registry is still marked as preview by the MCP docs, so publication should be treated as reversible and versioned carefully. The registry stores server metadata in `server.json`; remote servers use the `remotes` property with a `streamable-http` URL. GitHub authentication requires an `io.github.<user-or-org>/*` server name, so FundLoop currently uses:

```text
io.github.FundLoop/fundloop-mcp
```

Because the deployed Supabase project ref differs by environment, `server.json` uses a `{supabase_project_ref}` URL variable rather than hard-coding Preview or Production.

## Before Publishing

Complete these gates first:

- Remote MCP deploy succeeds on Preview/dev.
- `FUNDLOOP_MCP_REQUIRE_HTTPS=true pnpm mcp:edge:smoke` passes against Preview/dev with a non-production actor.
- Production deploy and production smoke transcript are recorded in `docs/mcp/validation.md`.
- Operator-only resource/tool negative smokes pass.
- Cross-project/tenant negative smoke passes through `mcp-workflow-read` or the backing Edge command.
- `FUNDLOOP_MCP_ALLOWED_EDGE_FUNCTIONS` is empty or explicitly justified.
- `FUNDLOOP_MCP_DISABLED_TOOLS` is tested as the emergency rollback control.
- Support and escalation route in `docs/mcp/runbook.md` is accepted.

## Publish Flow

When ready:

1. Install the current `mcp-publisher` release from the official registry project.
2. Authenticate with GitHub for the `FundLoop` namespace.
3. Run `pnpm mcp:registry:check`.
4. Publish `server.json`.
5. Record the registry URL, publisher version, timestamp, and smoke transcript here.

Do not publish from a dirty worktree, from an unreviewed feature branch, or before the hosted remote endpoint is intentionally public.

## Pending Publication Record

- Registry URL: TBD
- Publisher version: TBD
- Published version: TBD
- Timestamp: TBD
- Production endpoint: TBD
- Validation transcript: TBD

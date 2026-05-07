# MCP Server

FundLoop's MCP server is the protocol-facing entry point for agents acting on behalf of founders, project members, and selected internal operators.

The server must not become a second backend. It should use the same typed Edge Function command contracts, read-model boundaries, authorization assumptions, and observability streams as the web app.

The MCP-specific roadmap and design artifacts now live in:

- `agent-context/todo-mcp.md` for active MCP session tracking.
- `docs/mcp/tool-catalog.md` for current and candidate tool contracts.
- `docs/mcp/architecture.md` for the target remote/runtime architecture.
- `docs/mcp/deployment.md` for Preview/Production deploy and smoke expectations.
- `docs/mcp/publication.md` for registry metadata, publication gates, and pending publication records.
- `docs/mcp/security-model.md` for auth, authorization, data-safety, and threat-model rules.
- `docs/mcp/runbook.md` for MCP operations, disabling tools, log inspection, secret rotation, and rollback.

## Package

Session 38 introduced `packages/mcp-server` as a lightweight workspace package.

- `src/protocol.ts` defines the small JSON-RPC/MCP response shapes used by the skeleton.
- `src/auth.ts` creates an MCP actor context from an authenticated bearer token.
- `src/edge-client.ts` invokes Supabase Edge Functions with the standard `{ ok, data | error }` command envelope.
- `src/tools.ts` owns tool registration and dispatch.
- `src/sdk-adapter.ts` adapts the same registry tools into the official MCP TypeScript SDK for Streamable HTTP.
- `src/server.ts` provides the stdio server entrypoint for local MCP clients.

Session MCP-2 added `supabase/functions/mcp/index.ts` as the remote Streamable HTTP endpoint. The remote function reuses the same registry/tool modules, creates request-scoped bearer-token context, and invokes the same Edge Function command/read gateways as stdio.

Session MCP-3 hardened the remote endpoint so `POST` tool traffic must validate the bearer token through Supabase `auth.getUser()` before tool registration or dispatch. The MCP registry also applies a front-door tool authorization layer for authenticated calls, operator-prefixed tools, and operator/destructive generic Edge command names.

Session MCP-4 added a registry-level safety layer for tool inputs and outputs. Tool calls now pass through strict JSON-object validation, unknown-field rejection, payload size limits, string/number/object bounds, slug/cycle/transaction/wallet format checks, URL rejection for non-URL fields, and output redaction before results return to MCP clients.

## Runtime Configuration

The stdio runtime expects:

- `FUNDLOOP_MCP_BEARER_TOKEN`: Supabase user bearer token for the agent's current actor.
- `NEXT_PUBLIC_SUPABASE_URL` or `SUPABASE_URL`: Supabase project URL.
- `NEXT_PUBLIC_SUPABASE_ANON_KEY` or `SUPABASE_ANON_KEY`: public anon key used to invoke Edge Functions.
- `FUNDLOOP_MCP_ALLOWED_EDGE_FUNCTIONS`: comma-separated allowlist for the generic low-level Edge Function tool.

The generic Edge Function invoker is intentionally allowlisted. Product tools added in later sessions should prefer explicit typed handlers over exposing arbitrary function names to agents.

## Local Runtime

Session 49 made the package runnable through repo-owned scripts.

Run the stdio server from the repo root:

```bash
pnpm mcp:dev
```

Equivalent package command:

```bash
pnpm --filter @fundloop/mcp-server dev
```

The server speaks MCP-style JSON-RPC over Content-Length framed stdio messages. Protocol output goes to stdout. Operational logs and fatal startup errors must go to stderr so stdio clients do not receive non-protocol bytes.
The package launch scripts suppress Node's `MODULE_TYPELESS_PACKAGE_JSON` warning for the shared root TypeScript import path so local MCP clients and smoke output stay focused on protocol behavior.

For local smoke without a live Supabase session, the package exposes a non-mutating health smoke:

```bash
pnpm mcp:smoke
```

The smoke harness sends:

- `initialize`
- `tools/list`
- `tools/call` for `fundloop.health`

It verifies framing, server identity, tool registration, and health response shape. It does not call workflow read tools or mutating tools.

For local Edge Function smoke after serving `mcp`, use:

```bash
FUNDLOOP_MCP_HTTP_URL=http://127.0.0.1:54321/functions/v1/mcp pnpm mcp:edge:smoke
```

The Edge smoke checks `GET /health`, `initialize`, `tools/list`, and `tools/call` for `fundloop.health`.
When running the Edge handler directly without a live Supabase auth service, set `FUNDLOOP_MCP_ALLOW_LOCAL_TEST_TOKEN=true` and use the default `local-smoke-token`. Do not set this flag in Preview or Production.
For hosted smoke, set `FUNDLOOP_MCP_REQUIRE_HTTPS=true`; the smoke script also checks that missing bearer auth fails with `401`.

For package tests:

```bash
pnpm mcp:test
```

Session MCP-9 expanded `pnpm mcp:test` beyond per-tool behavior checks. The package test suite now includes registry-level contract coverage that fails when a registered tool lacks strict input/output schemas, annotations, closed-world metadata, auth coverage, operator gating, resource safety, prompt safety, stable JSON-RPC error shapes, or output redaction checks.

For interactive inspection when the MCP Inspector is available:

```bash
pnpm mcp:inspect
```

`mcp:inspect` launches the upstream inspector through `pnpm dlx` against the local stdio server. Keep real bearer tokens scoped to non-production actors unless explicitly validating a protected environment.

## Environment Contract

Minimum local stdio runtime:

```env
FUNDLOOP_MCP_BEARER_TOKEN=non_production_supabase_access_token
NEXT_PUBLIC_SUPABASE_URL=http://127.0.0.1:54321
NEXT_PUBLIC_SUPABASE_ANON_KEY=local_publishable_or_anon_key
```

Optional low-level invoker allowlist:

```env
FUNDLOOP_MCP_ALLOWED_EDGE_FUNCTIONS=project-crypto-route-create,project-crypto-route-update
```

The explicit workflow tools do not require the low-level allowlist. They call typed reader/writer boundaries directly. Leave `FUNDLOOP_MCP_ALLOWED_EDGE_FUNCTIONS` empty unless a session specifically needs a generic command bridge for integration work.

Emergency tool disable list:

```env
FUNDLOOP_MCP_DISABLED_TOOLS=fundloop.edge_command.invoke,founder.project.onchain_receipt.record
```

Disabled tools are hidden from `tools/list`; local registry calls return `tool_disabled` if called directly, while remote SDK clients may see the disabled tool as unavailable because it is no longer registered.

## Packaging Status

`packages/mcp-server` is currently a private workspace package and local stdio runtime. It is not yet published to npm, the official MCP registry, Smithery, Docker, or any hosted remote runtime.

Current package entrypoints:

- package export: `@fundloop/mcp-server`
- stdio server export: `@fundloop/mcp-server/server`
- bin name: `fundloop-mcp-server`

The root `pnpm mcp:publish` command is intentionally metadata-only guidance for now. Actual publication should happen only after the MCP-specific roadmap in `agent-context/todo-mcp.md` defines the target registry, auth model, hosted endpoint, and validation transcript.

## Troubleshooting

- `FUNDLOOP_MCP_BEARER_TOKEN is required`: provide a Supabase user access token for the actor the agent represents.
- `NEXT_PUBLIC_SUPABASE_URL or SUPABASE_URL is required`: point the runtime at local, preview, or production Supabase.
- `invalid_edge_response`: the target Edge Function did not return the standard `{ ok: true, data } | { ok: false, error }` envelope.
- `invalid_payload`: the MCP input did not match the tool's strict schema, used an unsupported field, or provided an unsafe value such as an unexpected URL.
- `payload_too_large`: the MCP input exceeded registry-level byte, string, object, array, or nesting limits.
- `not allowlisted`: the generic `fundloop.edge_command.invoke` tool was asked to call a function not listed in `FUNDLOOP_MCP_ALLOWED_EDGE_FUNCTIONS`.
- stdio client hangs: confirm the client is sending Content-Length framed messages, not newline-delimited JSON.
- Edge MCP `not_authenticated`: include `Authorization: Bearer <non-production Supabase access token>` for `POST /functions/v1/mcp`; `GET /health` is the only public endpoint.
- Edge MCP `forbidden`: the authenticated user is missing the role required for the tool, most commonly internal-operator access for `operator.*` tools or operator/destructive generic Edge commands.

## Tool Rules

- Tool inputs and outputs should be stable, typed, and small.
- Tool schemas should include concrete limits: required fields, `additionalProperties: false` by default, max string lengths, integer/range constraints for ids, and format markers for slugs, cycle keys, tx hashes, wallet addresses, and attempt ids.
- The registry validates inputs before handlers run and sanitizes text output before returning it to clients.
- Founder/project-member tools should enforce role boundaries through the same Edge Function commands and read models used by the app.
- Internal-operator tools should start read-only unless a session explicitly introduces a safe mutation.
- Operator tools are blocked before handler execution unless `FUNDLOOP_INTERNAL_ADMIN_EMAILS` includes the authenticated user's email.
- Tool failures should return protocol-visible error content and should also be visible through the relevant app observability stream.
- Do not log bearer tokens, Supabase keys, service role keys, raw private artifact URLs, or command payloads containing secrets.
- Tool dispatch logs are structured and redacted. They include request id, hashed client/user/tenant identifiers, tool category, status, latency, and error code, but not bearer tokens, raw emails, payload bodies, cookies, or secret values.

## Current Skeleton

Session 38 registered the base tools, and Session MCP-5.2 finalized health as the canonical readiness smoke:

- `fundloop.health`: read-only, annotated, structured health output with service/version and a minimal actor summary. It intentionally does not expose bearer tokens, Supabase keys, service-role state, tenant data, or environment internals.
- `fundloop.edge_command.invoke`: low-level allowlisted Edge Function invocation for local development and early integration tests. It is explicitly non-read-only, bounded by strict input validation, requires a configured function allowlist, and returns `not_allowlisted` when a target command is not enabled for this MCP runtime.

## Founder Tools

Session 39 added the first explicit founder tools:

- `founder.projects.list`: read-only, annotated, structured founder/project-member project index with compact project summaries, setup status when available, and safe empty/error states.
- `founder.project.cycle_status`: read-only, annotated, structured project/cycle briefing with payment, route, cycle status, safe next-action hints, and no raw backend payload leakage.
- `founder.project.crypto_route.create`: annotated founder write tool backed by the typed `project-crypto-route-create` Edge command, with strict curated-route inputs and protocol-visible Edge failure codes.
- `founder.project.crypto_route.update`: annotated founder write tool backed by the typed `project-crypto-route-update` Edge command, with strict route-reference inputs and stable backend failure envelopes.
- `founder.project.onchain_receipt.record`: annotated founder write tool backed by the typed `project-onchain-payment-submission-record` Edge command, requiring explicit receipt, wallet, amount, period, and curated route references without bypassing reconciliation.
- `founder.project.payment_drafts.create`: annotated founder write tool backed by the typed `project-payment-drafts-create` Edge command, requiring an MCP attempt id and returning compact draft summaries instead of raw payment rows.

Founder reads go through a `FounderWorkflowReader` boundary. The default implementation uses authenticated Supabase REST reads with the same bearer token as the agent. Founder writes call the existing typed Edge Function command names for route management, draft payment creation, and onchain receipt recording.

Session 40 added project-member and operator workflows so agents do not need to use the low-level invoker directly.

## User, Project-Member, And Operator Tools

Session 40 added read-only project-member and operator tools, and MCP-5.16 added the first regular-user workspace summary:

- `user.workspace.summary`: annotated read-only user workspace summary backed by `mcp-workflow-read`, returning identity/completion status, participation footprint, current results visibility, payout readiness, discovery next actions, and warning states for the authenticated user only. It intentionally omits raw CUBID payloads, CUBID user ids, payout destinations, and other users' data.
- `user.payout.routes.list`: annotated read-only user payout route summary backed by `mcp-workflow-read`, returning route labels, rails, currency, status, default state, readiness counts, and warnings without exposing route destinations or provider secrets.
- `project_member.project.reporting_status`: annotated read-only project-member status tool backed by `mcp-workflow-read`, returning compact reporting counts, attribution readiness, and safe next-action hints without artifact paths or operator-only internals.
- `operator.cycles.list`: annotated internal-operator read-only overview backed by `mcp-workflow-read`, returning a bounded recent-cycle list with lifecycle timestamps and safe empty/error states.
- `operator.cycle.observability`: annotated internal-operator read-only event view backed by `mcp-workflow-read`, returning bounded cycle-event summaries by cycle key or attempt id with sanitized messages.
- `operator.payments.reconciliation_visibility`: annotated internal-operator read-only reconciliation health view backed by `mcp-workflow-read`, returning status counts, open-queue totals, warning states, and safe next actions.
- `operator.reporting.coverage`: annotated internal-operator read-only publication coverage view backed by `mcp-workflow-read`, returning audience counts, missing-audience gaps, artifact coverage, and safe next actions without artifact bodies or signed URLs.

These tools intentionally do not mutate state. They use `UserWorkflowReader`, `ProjectMemberWorkflowReader`, and `OperatorWorkflowReader` boundaries so tool contracts stay stable while the underlying read model evolves.

## Read Boundary

Session 41 added `mcp-workflow-read` as the first typed Edge Function read gateway for MCP-facing workflow reads. The default MCP founder, project-member, and operator readers now call this Edge Function instead of reading Supabase REST tables directly.

Current operations:

- `founder.projects.list`
- `founder.project.cycle_status`
- `user.workspace.summary`
- `user.payout.routes.list`
- `project_member.project.reporting_status`
- `operator.cycles.list`
- `operator.cycle.observability`
- `operator.payments.reconciliation_visibility`
- `operator.reporting.coverage`

This keeps MCP read behavior behind the same auth and command envelope style as writes, while preserving narrow reader interfaces for future app-side reuse.

Session 50 aligned the app-side operator payment operations and reconciliation pages around `lib/operator/payment-workspaces.ts`. That module is the web-app counterpart to the MCP operator read contract for payment and reconciliation visibility: pages should consume stable workspace shapes and warnings rather than reconstructing raw Supabase rows locally.

## Resources And Prompts

MCP-6 added first-class resources and prompts to both the stdio harness and remote SDK endpoint.

Resources are read-only, JSON, bounded, and tenant-scoped by the same authenticated actor context used by tools:

- `fundloop://docs/mcp-overview`: stable non-sensitive MCP overview and safety model.
- `fundloop://workspace/summary`: authenticated user's redacted workspace summary.
- `fundloop://user/payout-routes`: authenticated user's destination-redacted payout route readiness.
- `fundloop://founder/projects`: authenticated founder/project-member managed project summary.
- `fundloop://operator/cycles`: internal-operator-only recent monthly cycle status summary.

Prompts are workflow starters, not hidden policy. They tell the client which safe read tools to call and explicitly require agents to use only MCP-visible or user-provided facts:

- `create-funding-update`
- `summarize-project-status`
- `prepare-investor-follow-up`
- `review-pending-tasks`

Do not add large unbounded resources, raw artifact downloads, raw CUBID payloads, payout destinations, signed URLs, or service-role-derived internals as MCP resources. If future resources need private artifact access, back them with a scoped Edge Function authorization check first.

For local smoke coverage, use `pnpm mcp:smoke` for the stdio harness and `pnpm mcp:edge:smoke` against a served Supabase Edge Function. The tracked smoke scripts now verify tools, resources, and prompts; keep `docs/mcp/validation.md` updated with the latest transcript and any local Edge caveats.

## Artifact References

Session 43 standardized Supabase Storage artifact references in `lib/storage/artifacts.ts`. MCP tools should return artifact metadata such as bucket, path, kind, hash, visibility, and retention instead of inventing paths or streaming private storage contents directly. Any future raw artifact download tool should be backed by a scoped Edge Function authorization check.

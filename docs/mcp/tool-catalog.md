# FundLoop MCP Tool Catalog

This catalog is the MCP planning source of truth for FundLoop tools. It is intentionally intent-based rather than a one-to-one export of backend endpoints.

## Tool Classification

- `read`: returns current state and must not mutate data.
- `write`: creates or updates workflow data through typed Edge Function commands.
- `destructive`: performs irreversible or high-risk changes and requires explicit confirmation.
- `admin`: requires internal-operator authorization and extra audit expectations.

## Current Tools

| Tool | User intent | Entity or workflow | Class | Required auth scope | Tenant rule | Input schema | Output schema | Source boundary | Rate limit | Audit event | Failure cases |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| `fundloop.health` | Confirm the MCP runtime is reachable and identify the current actor context. | MCP runtime | read | authenticated actor for non-local workflow use; unauthenticated local smoke allowed only for health shape | none; no tenant data returned | `{}` | service name, version/capabilities, actor summary when present | `packages/mcp-server/src/tools.ts` | low; suitable for smoke checks | runtime health check only | missing runtime config, malformed MCP request |
| `fundloop.edge_command.invoke` | Early integration bridge for allowlisted Edge Function commands. | Edge Function command bridge | write, potentially admin depending on target | Supabase bearer token plus explicit function allowlist | enforced by target Edge Function | `{ functionName: string; payload?: unknown }` | standard Edge command envelope | `packages/mcp-server/src/edge-client.ts` | strict per actor/function; keep disabled unless needed | target command audit event | missing allowlist, invalid Edge response, target auth failure |
| `founder.projects.list` | Let a founder or project member see projects they manage. | Founder workspace | read | founder/project-member actor | only projects available to the actor | `{}` | managed project summaries | `mcp-workflow-read` operation `founder.projects.list` | moderate per actor | workflow read event | unauthenticated, no project access, read failure |
| `founder.project.cycle_status` | Inspect the current monthly-cycle and reporting state for a managed project. | Founder project cycle status | read | founder/project-member actor | project slug must belong to actor-managed projects | `{ projectSlug: string }` | cycle status, reporting readiness, outstanding actions | `mcp-workflow-read` operation `founder.project.cycle_status` | moderate per actor/project | workflow read event | unknown slug, forbidden project, partial read warnings |
| `founder.project.crypto_route.create` | Add a founder-managed crypto contribution route. | Payment route operations | write | founder/project admin actor | project slug must belong to actor-managed projects | typed `project-crypto-route-create` contract | route summary envelope | Edge Function `project-crypto-route-create` | low per actor/project | payment flow event | duplicate route, inactive reference data, forbidden project |
| `founder.project.crypto_route.update` | Update founder-managed crypto contribution route metadata or defaults. | Payment route operations | write | founder/project admin actor | route must belong to actor-managed project | typed `project-crypto-route-update` contract | route summary envelope | Edge Function `project-crypto-route-update` | low per actor/project | payment flow event | missing route, disabled default, forbidden project |
| `founder.project.onchain_receipt.record` | Record a contribution receipt for a project payment. | Inbound contribution recording | write | founder/project admin actor | payment and route must belong to actor-managed project | typed `project-onchain-payment-submission-record` contract | onchain submission summary envelope | Edge Function `project-onchain-payment-submission-record` | low per actor/project/payment | payment flow event | amount mismatch, invalid route, duplicate unresolved submission, forbidden project |
| `project_member.project.reporting_status` | Let a project member understand reporting/data-submission state. | Project reporting | read | project-member actor | project slug must belong to actor access set | `{ projectSlug: string }` | reporting status and required actions | `mcp-workflow-read` operation `project_member.project.reporting_status` | moderate per actor/project | workflow read event | forbidden project, missing cycle, partial read warnings |
| `operator.cycles.list` | Let an internal operator inspect recent monthly cycles. | Monthly cycles | read, admin | internal operator | global operator workspace only | pagination/status filters | monthly cycle summaries | `mcp-workflow-read` operation `operator.cycles.list` | moderate per operator | operator workflow read event | forbidden, query failure |
| `operator.cycle.observability` | Inspect pipeline events for one monthly cycle. | Monthly-cycle observability | read, admin | internal operator | global operator workspace only | `{ cycleKey: string }` | events, warnings, status timeline | `mcp-workflow-read` operation `operator.cycle.observability` | moderate per operator/cycle | operator workflow read event | invalid month, cycle not found, forbidden |
| `operator.payments.reconciliation_visibility` | Inspect reconciliation queue and payment operations health. | Payment reconciliation | read, admin | internal operator | global operator workspace only | optional filters for project/payment/submission | reconciliation visibility summary | `mcp-workflow-read` operation `operator.payments.reconciliation_visibility` | moderate per operator | operator workflow read event | forbidden, partial read warnings |
| `operator.reporting.coverage` | Inspect reporting publication coverage by cycle. | Reporting publication | read, admin | internal operator | global operator workspace only | `{ cycleKey?: string }` | coverage summary and gaps | `mcp-workflow-read` operation `operator.reporting.coverage` | moderate per operator | operator workflow read event | forbidden, missing artifacts, partial read warnings |

## Near-Term Candidate Tools

These are good candidates after the remote/auth design lands. They are not approved for implementation until their Edge Function/read-model boundaries and audit behavior are explicit.

| Candidate | User intent | Class | Source boundary to define |
| --- | --- | --- | --- |
| `founder.project.contribution.submit` | Submit structured founder contribution data for a locked/open cycle. | write | founder attribution/contribution Edge command |
| `founder.project.payment_drafts.create` | Draft monthly payment obligations from project revenue input. | write | existing `project-payment-drafts-create` command |
| `user.workspace.summary` | Let a regular user or their agent inspect identity, participation, and earnings state. | read | user workspace read contract |
| `user.payout.routes.list` | Let a user inspect payout routes and readiness. | read | payout workspace read contract |
| `operator.cycle.lock` | Lock a monthly cycle with explicit unresolved-onchain override handling. | admin write | `monthly-cycle-lock`; likely deferred until remote MCP auth is stronger |

## Explicitly Out Of Scope

- Raw SQL tools.
- Arbitrary Edge Function invokers without allowlists.
- Generic admin mutation tools.
- Private artifact byte streaming through MCP.
- Tools that bypass Supabase Edge Function command envelopes, read-model boundaries, or existing role checks.

# FundLoop MCP Roadmap

## Recommended default architecture

Build a **remote MCP server over Streamable HTTP** as a Supabase Edge Function, with an optional local `stdio` wrapper only if the product needs local-client support. MCP supports `stdio` and Streamable HTTP transports, and remote servers are a natural fit for HTTP-based product APIs. Supabase’s current MCP guidance shows Edge Functions using the official MCP TypeScript SDK with `WebStandardStreamableHTTPServerTransport`, and also notes that `mcp-lite` / `mcp-handler` can work on the Edge Runtime. ([Model Context Protocol][1])

For production, do **not** blindly copy the unauthenticated Supabase MCP quickstart. Supabase’s MCP guide currently says its example is for MCP servers that do not require authentication, and its local/deploy examples use `--no-verify-jwt`; authenticated product-control servers need explicit OAuth, JWT, or API-key validation inside the server or at a gateway. ([Supabase][2])

Tool handlers should normally call the same Supabase Edge Function middleware or shared service layer that the Next.js UI uses. Do not let the MCP server become a backdoor that bypasses product business logic, tenant isolation, audit logging, RLS assumptions, or permission checks.

## Non-negotiable implementation rules

* Treat the MCP server as a **public product API surface**, not an internal dev helper.
* Every tool must have explicit input schemas, output schemas, auth requirements, rate limits, and audit behavior.
* Do not expose raw SQL, arbitrary URL fetchers, arbitrary filesystem access, shell execution, service-role keys, or generic “admin action” tools.
* Do not map every backend endpoint into a tool. Create tools around clear user/agent intents, because Docker’s MCP guidance warns against simply exposing every API operation as a tool and recommends managing the “tool budget.” ([Docker][3])
* All write/destructive tools must be idempotent or have idempotency keys, because model-driven clients may retry tool calls. OpenAI’s Apps SDK guidance also treats tool descriptors and handlers as the contract the model relies on. ([OpenAI Developers][4])
* No secrets, API tokens, Supabase service keys, internal JWTs, private URLs, or privileged debug data may appear in MCP `content`, `structuredContent`, `_meta`, logs, or widget state. OpenAI’s Apps SDK guidance explicitly warns against embedding secrets in tool results or widget metadata. ([OpenAI Developers][4])

---

# MCP server capability TODOs

## Platform follow-up. Rebrand EverFund references to VentureFamily

- Status: Not started
- Timestamp started: TBD
- Head when starting: TBD
- Timestamp completed: 2026-05-06T20:10:07-0400
- Feature branch(es): TBD
- Session-log reference(s): TBD

Check out a new feature branch from current `dev`, then rename this tool/platform from EverFund to VentureFamily throughout the repo. When the name is printed in user-facing UI, docs intended for users, marketing copy, navigation, or support surfaces, stylize it as `VentureFamily`. Keep code identifiers, filenames, and migration names reviewable and only rename technical symbols when doing so is safe and clearly tied to visible branding. Do not start this rebrand from the current MCP branch; it should be isolated as a future product/platform branch.

## MCP-0. Initialize this document

- Status: Complete
- Timestamp started: 2026-05-06T04:42:09-0400
- Head when starting: c31e185
- Timestamp completed: 2026-05-06T04:42:09-0400
- Feature branch(es): codex/mcp-roadmap-kickoff
- Session-log reference(s): session v136

This document is the FundLoop-specific MCP roadmap. The baseline product context is:

* [x] Product name: FundLoop.
* [x] MCP server name: FundLoop MCP Server.
* [x] Current local runtime: `packages/mcp-server` stdio package.
* [x] Target remote runtime: Supabase Edge Function over Streamable HTTP.
* [x] Local base URL: `http://127.0.0.1:54321`.
* [x] Hosted base URL: the active Supabase project function URL for Preview or Production.
* [x] Initial auth mode: Supabase JWT actor validation, with OAuth 2.1 deferred until third-party client onboarding is intentional.
* [x] Tenant model: user-owned, project-scoped founder/member access, and internal-operator access for admin reads.
* [x] Support path: internal FundLoop engineering/support operators through the normal repo and operations-runbook process.

---

## MCP-1. Discovery and design

- Status: Complete
- Timestamp started: 2026-05-06T04:42:09-0400
- Head when starting: c31e185
- Timestamp completed: 2026-05-06T04:42:09-0400
- Feature branch(es): codex/mcp-roadmap-kickoff
- Session-log reference(s): session v136

* [x] Read the product’s engineering docs, API docs, database docs, auth docs, and existing Supabase Edge Function docs.
* [x] Identify the product’s core entities, workflows, and user roles.
* [x] Create `docs/mcp/tool-catalog.md` with a table for each proposed tool:

  * tool name
  * user intent
  * entity or workflow touched
  * read/write/destructive/admin classification
  * required auth scope
  * required tenant context
  * input schema
  * output schema
  * source Edge Function or service method
  * rate limit
  * audit log event
  * failure cases

* [x] Decide which capabilities should be MCP **tools**, **resources**, and **prompts**. MCP servers can expose tools, resources, and prompts; tools are callable actions, resources are contextual data, and prompts are reusable interaction templates. ([Model Context Protocol][5])
* [x] Create `docs/mcp/architecture.md` describing:

  * transport: Streamable HTTP
  * runtime: Supabase Deno Edge Function
  * SDK/library: official MCP TypeScript SDK, `mcp-lite`, or another Edge-compatible MCP library
  * auth mode
  * tenant isolation model
  * logging and monitoring
  * deployment environments
  * publication plan

* [x] Create `docs/mcp/security-model.md` describing:

  * authentication
  * authorization
  * scope model
  * tenant isolation
  * data classification
  * threat model
  * rate limiting
  * audit logging
  * abuse handling
  * incident response contacts

* [x] If an MCP implementation had already been started, then update the language in todos below accordingly and as needed.
* [x] Assess critically the repo readiness for MCP, and report out any suggested criteria or proposed gates prior to commencing work on the MCP functionality.

Readiness assessment: FundLoop already has a useful local stdio MCP package, explicit founder/project-member/operator tools, and an `mcp-workflow-read` Edge Function gateway. The main gap is not another local skeleton; it is a production-safe remote MCP endpoint with validated auth, rate limits, publication metadata, and a tighter distinction between supported product tools and temporary generic command bridges.

**Acceptance criteria**

* [x] `docs/mcp/tool-catalog.md` exists and has no vague tools like `run_action`, `query_database`, `call_api`, or `admin_tool`.
* [x] Every proposed tool maps to a real user/agent workflow.
* [x] Every proposed tool has an auth scope and tenant rule.
* [x] The design explicitly states which tools are read-only, mutating, destructive, or admin-level.

---

## MCP-2. Create the Supabase Edge Function MCP server

- Status: Complete
- Timestamp started: 2026-05-06T05:09:22-0400
- Head when starting: c5ea417
- Timestamp completed: 2026-05-06T05:09:22-0400
- Feature branch(es): codex/mcp-roadmap-kickoff
- Session-log reference(s): session v137

* [x] Add or promote a Supabase Edge Function for remote MCP over Streamable HTTP, preferably `supabase/functions/mcp/index.ts`, unless product conventions require another name.
* [x] Keep the current `packages/mcp-server` stdio runtime as the local compatibility harness unless this session replaces it with a wrapper around the remote implementation.
* [x] Use an Edge-compatible MCP implementation:

  * preferred: official MCP TypeScript SDK with `WebStandardStreamableHTTPServerTransport`
  * acceptable: `mcp-lite` or `mcp-handler` if better suited to Supabase Edge Functions
* [x] Add routing for FundLoop deployed function URLs:

  * local: `http://127.0.0.1:54321/functions/v1/mcp`
  * preview/production: `https://<supabase-project-ref>.supabase.co/functions/v1/mcp`
* [x] Add a simple `GET /health` or equivalent health endpoint that does not expose sensitive data.
* [x] Implement MCP initialization, capability negotiation, `tools/list`, and `tools/call`.
* [x] Ensure the server returns correct MCP/JSON-RPC responses over Streamable HTTP.
* [x] For local unauthenticated development only, document when `supabase functions serve --no-verify-jwt mcp` is acceptable. For authenticated production, do not deploy in a way that bypasses auth unless the MCP handler itself fully validates credentials.
* [x] Add Deno tasks or package scripts:

  * `mcp:dev`
  * `mcp:test`
  * `mcp:smoke`
  * `mcp:inspect`
  * `mcp:publish`
  * `mcp:edge:smoke`
* [x] Ensure logs do not write protocol-breaking output to stdout for `stdio` mode. MCP’s transport docs allow logging to stderr for `stdio`, while JSON-RPC messages flow over stdin/stdout. ([Model Context Protocol][1])

**Acceptance criteria**

* [x] `initialize` works locally.
* [x] `tools/list` returns the expected tool list.
* [x] At least one read-only tool works locally.
* [x] The server has no direct privileged database access unless explicitly justified in `docs/mcp/security-model.md`.
* [x] The server can run under Supabase local development.

---

## MCP-3. Authentication and authorization

- Status: Complete
- Timestamp started: 2026-05-06T08:00:15-0400
- Head when starting: 310a578
- Timestamp completed: 2026-05-06T08:07:44-0400
- Feature branch(es): codex/mcp-roadmap-kickoff
- Session-log reference(s): session v138

* [x] Decide the production auth mode:

  * Supabase JWT validation for first-party or workspace-bound clients is the MCP-3 production auth mode.
  * OAuth 2.1 for third-party remote clients remains deferred.
  * signed API keys are not introduced in MCP-3.

* [x] If using OAuth, follow the MCP authorization spec:

  * OAuth is deferred; do not add partial OAuth behavior in MCP-3.
  * The current bearer-token path validates Supabase tokens through `auth.getUser()` before MCP tool registration or dispatch.

* [x] Do not accept tokens issued for another audience. The MCP authorization spec says MCP servers must validate tokens for their own service and must not accept or pass through tokens intended for other services. ([Model Context Protocol][6])
* [x] Do not implement token passthrough to downstream services. MCP security guidance explicitly identifies token passthrough as a serious anti-pattern. ([Model Context Protocol][7])
* [x] Create a scope model, for example:

  * MCP-3 uses the repo's current role/capability model first: authenticated user, founder/project-member access enforced by workflow Edge boundaries, and internal-operator access through `FUNDLOOP_INTERNAL_ADMIN_EMAILS`.
  * OAuth-style named scopes remain deferred until the OAuth session.

* [x] Use least-privilege and progressive authorization. MCP security guidance recommends minimal scopes, avoiding wildcard scopes, and elevating permissions only when needed. ([Model Context Protocol][7])
* [x] Enforce authorization server-side for every tool call.
* [x] Enforce tenant isolation server-side for every tool call.
* [x] For destructive/admin tools, require an explicit confirmation field in the input schema, such as:

  * No destructive/admin mutation is exposed in MCP-3.
  * Future destructive/operator MCP tools must add `confirm: true`, exact entity identifiers, and an audit reason before being enabled.

* [x] Add audit logs for:

  * authentication success/failure
  * authorization failure
  * tenant mismatch
  * read tool calls
  * write tool calls
  * destructive/admin tool calls
  * rate-limit violations

* [x] Redact secrets and sensitive tokens from all logs.

**Acceptance criteria**

* [x] Missing credentials fail.
* [x] Expired credentials fail.
* [x] Wrong audience fails through Supabase JWT validation.
* [x] Wrong issuer fails through Supabase JWT validation.
* [x] Missing scope fails through the role/tool authorization layer; OAuth scopes remain deferred.
* [x] Cross-tenant access fails through existing workflow Edge/domain authorization after the MCP front-door role gate.
* [x] Destructive tools fail because they are not exposed in MCP-3; future destructive/operator tools require explicit confirmation.
* [x] Auth decisions are tested and documented.

---

## MCP-4. Input validation, output safety, and threat protection

- Status: Complete
- Timestamp started: 2026-05-06T08:29:03-0400
- Head when starting: 2a75cee
- Timestamp completed: 2026-05-06T08:32:04-0400
- Feature branch(es): codex/mcp-roadmap-kickoff
- Session-log reference(s): session v139

* [x] Define all tool input schemas with strict validation, preferably using Zod or the project’s existing schema system.
* [x] Reject unknown fields unless there is a specific reason to allow them.
* [x] Add limits for:

  * string length
  * array length
  * pagination size
  * date ranges
  * file size
  * number of IDs
  * nested object depth

* [x] Validate IDs, slugs, enum values, URLs, email addresses, and date ranges.
* [x] Never concatenate user input into SQL, shell commands, filesystem paths, or URLs.
* [x] Use parameterized queries and safe APIs. Snyk’s MCP security guidance specifically recommends strict input validation, safe APIs such as `execFile` instead of `exec`, parameterized queries, defense in depth, SAST, least privilege, and documenting the security model. ([Snyk][8])
* [x] Block SSRF-prone behavior:

  * no arbitrary outbound URL fetching unless explicitly required
  * if URL fetching is required, use allowlists
  * block local IP ranges, metadata services, private networks, and redirects to forbidden destinations

* [x] Treat all external text returned by tools as untrusted data.
* [x] Do not let tool output contain instructions telling the model to ignore previous instructions, change auth behavior, reveal secrets, or call other tools.
* [x] Add output sanitization for HTML, markdown, URLs, and user-generated content.
* [x] Add structured error responses with stable error codes.
* [x] Do not expose internal stack traces to MCP clients.
* [ ] Add rate limiting per user, per tenant, per token/client, and per tool. Deferred to MCP-6 because it needs a durable remote runtime strategy rather than an in-memory Edge-process counter.
* [ ] Add abuse detection for repeated failed auth, repeated destructive calls, unusually large queries, and automated scraping. Deferred to MCP-6 with rate limiting and operator alerting.

**Acceptance criteria**

* [x] Injection test cases fail safely.
* [x] SSRF test cases fail safely.
* [x] Oversized inputs fail safely.
* [x] Unauthorized tenant/entity access fails safely through MCP-3 auth plus existing Edge/domain authorization.
* [x] Tool output never includes secrets.
* [x] Error responses are useful but do not leak internals.

---

## MCP-5. Implement the tools

Create tools around product workflows, not implementation details.

### MCP-5.1. Create a TODO for each of the tools

- Status: Complete
- Timestamp started: 2026-05-06T09:29:38-0400
- Head when starting: b8768f1
- Timestamp completed: 2026-05-06T09:29:38-0400
- Feature branch(es): codex/mcp-roadmap-kickoff
- Session-log reference(s): session v140

* [x] For each of the tools in `docs/mcp/tool-catalog.md` create a new sub-TODO, starting at 5.2. Use the following FundLoop-oriented baseline pattern, replacing the example tool names with catalog entries as needed:

```template

* [ ] `founder.projects.list`

  * read-only
  * project-scoped to the actor's managed projects
  * returns compact summaries

* [ ] `founder.project.cycle_status`

  * read-only
  * fetches one project by slug
  * founder/project-member scoped

* [ ] `founder.project.crypto_route.create`

  * mutating
  * idempotency key required
  * validates all required fields

* [ ] `founder.project.crypto_route.update`

  * mutating
  * requires route ID and project slug
  * partial update schema
  * optimistic concurrency if available

* [ ] `operator.cycle.lock`

  * sensitive operator mutation
  * only if product requirements and remote auth justify it
  * explicit confirmation required

* [ ] `operator.reporting.coverage`

  * read-only operator workflow
  * calls existing workflow/read-model logic
  * returns status and next steps

```

### For each tool

* [ ] Register name, title, description, input schema, output schema, and annotations.
* [ ] Use accurate annotations:

  * read-only tools: `readOnlyHint: true`
  * destructive tools: `destructiveHint: true`
  * external-world tools: `openWorldHint: true`
* [ ] Treat missing or inaccurate annotations as validation errors. OpenAI’s Apps SDK guidance requires accurate tool annotations such as `readOnlyHint`, `destructiveHint`, and `openWorldHint`. ([OpenAI Developers][4])
* [ ] Call the existing Supabase Edge Function or shared service method.
* [ ] Pass authenticated user/tenant context to the service layer.
* [ ] Return `structuredContent` for machine-readable data.
* [ ] Return short human-readable `content` summaries.
* [ ] Return stable error codes for failures.
* [ ] Add idempotency handling for writes.
* [ ] Add audit logging.
* [ ] Add unit and integration tests.

**Acceptance criteria**

* [ ] The tool has a strict schema.
* [ ] The tool has tests.
* [ ] The tool is tenant-scoped.
* [ ] If mutating, the tool has idempotency or retry protection.
* [ ] If destructive, the tool has explicit confirmation.
* [ ] The tool does not bypass the product’s existing permission model.

```end of template

### MCP-5.2. Harden and annotate `fundloop.health`

- Status: Complete
- Timestamp started: 2026-05-06T09:31:13-0400
- Head when starting: 2d52631
- Timestamp completed: 2026-05-06T09:36:15-0400
- Feature branch(es): codex/mcp-roadmap-kickoff
- Session-log reference(s): session v141

Finish `fundloop.health` as the canonical remote/readiness smoke tool. Keep it read-only and non-sensitive: it may return service name, version, transport capability, and a minimal actor summary for authenticated tool traffic, but it must not expose bearer tokens, Supabase project secrets, service-role state, tenant data, or environment internals. Add accurate tool annotations, a concise human-readable summary, and machine-readable structured output once the MCP result shape supports it. Preserve public `GET /health` as the unauthenticated health endpoint and keep `tools/call` health authenticated on remote POST. Add tests covering stdio smoke, remote authenticated health, no-secret output, and malformed input rejection.

### MCP-5.3. Harden and constrain `fundloop.edge_command.invoke`

- Status: Complete
- Timestamp started: 2026-05-06T09:36:50-0400
- Head when starting: 9dd9e6d
- Timestamp completed: 2026-05-06T09:39:15-0400
- Feature branch(es): codex/mcp-roadmap-kickoff
- Session-log reference(s): session v142

Keep `fundloop.edge_command.invoke` as a narrow transitional bridge, not a permanent broad backend portal. Require authenticated actor context, a configured allowlist, strict function-name validation, and stable Edge command envelopes. Preserve the MCP-3 operator/destructive command block for non-operators and extend tests so allowlisted founder commands succeed while unallowlisted, malformed, oversized, and operator/destructive names fail before dispatch. Add explicit annotations reflecting that the tool can mutate state depending on the target command, document that product-specific tools are preferred, and avoid adding generic payload freedoms beyond the current bounded object contract.

### MCP-5.4. Finalize `founder.projects.list`

- Status: Complete
- Timestamp started: 2026-05-06T17:36:18-0400
- Head when starting: 9fe1bd3
- Timestamp completed: 2026-05-06T17:41:27-0400
- Feature branch(es): codex/mcp-roadmap-kickoff
- Session-log reference(s): session v143

Finalize the founder project listing tool as a compact read-only workspace index for founders and project members. It should call the existing `mcp-workflow-read` operation, return only projects visible to the authenticated actor, and provide stable summaries with project id, slug, name, setup/status cues, and next-action hints where already available. Add read-only annotations, structured output, stable error codes, and tests proving authenticated users only receive scoped projects, no-project users get a calm empty state, and reader failures return protocol-visible errors without stack traces or raw Supabase payloads.

### MCP-5.5. Finalize `founder.project.cycle_status`

- Status: Complete
- Timestamp started: 2026-05-06T17:42:03-0400
- Head when starting: 9e9411b
- Timestamp completed: 2026-05-06T17:45:45-0400
- Feature branch(es): codex/mcp-roadmap-kickoff
- Session-log reference(s): session v144

Finalize the founder project cycle-status tool as a read-only project/cycle briefing. Require a valid `projectSlug` and optional `cycleKey`, call the `mcp-workflow-read` operation, and return cycle status, payment readiness, reporting readiness, outstanding actions, and non-fatal warnings in compact structured output. Keep project ownership enforced by the read gateway rather than duplicating membership rules locally. Add tests for valid slugs, invalid cycle keys, forbidden/unknown projects, partial warning output, and no leakage of raw database rows, private artifact paths, or internal operator-only data.

### MCP-5.6. Finalize `founder.project.crypto_route.create`

- Status: Complete
- Timestamp started: 2026-05-06T17:54:46-0400
- Head when starting: b5b3cc1
- Timestamp completed: 2026-05-06T17:58:51-0400
- Feature branch(es): codex/mcp-roadmap-kickoff
- Session-log reference(s): session v145

Finalize the founder crypto-route creation tool as a mutating project-admin operation backed only by the typed `project-crypto-route-create` Edge Function. Require strict ids, project slug, and an idempotency/attempt identifier if the underlying command supports or can safely accept one. Add write annotations, concise success/failure summaries, structured Edge envelope output, and tests for valid creation, duplicate/inactive-reference failures, forbidden project behavior, malformed ids, oversized labels, and retry-safe behavior. Do not let this tool accept arbitrary chain/token configuration outside the existing curated reference-data model.

### MCP-5.7. Finalize `founder.project.crypto_route.update`

- Status: Complete
- Timestamp started: 2026-05-06T18:02:23-0400
- Head when starting: 9788902
- Timestamp completed: 2026-05-06T18:05:17-0400
- Feature branch(es): codex/mcp-roadmap-kickoff
- Session-log reference(s): session v146

Finalize the founder crypto-route update tool as a mutating project-admin operation backed only by the typed `project-crypto-route-update` Edge Function. Require valid `projectSlug` and `paymentMethodId`, keep updates limited to supported mutable fields, and preserve the existing backend rules for default-route safety and ownership. Add write annotations, structured output, stable errors, and tests for success, missing route, disabled/default conflicts, malformed payloads, forbidden projects, and no handler execution when MCP validation fails. Do not expand this into move/enable/disable variants unless the catalog and roadmap explicitly add separate tools.

### MCP-5.8. Finalize `founder.project.onchain_receipt.record`

- Status: Complete
- Timestamp started: 2026-05-06T18:50:17-0400
- Head when starting: ab6f7ad
- Timestamp completed: 2026-05-06T18:53:00-0400
- Feature branch(es): codex/mcp-roadmap-kickoff
- Session-log reference(s): session v147

Finalize onchain receipt recording as a mutating founder/project-admin tool backed by `project-onchain-payment-submission-record`. Require valid project slug, payment id, payment method id, transaction hash, and optional wallet/amount/attempt fields within strict limits. Add write annotations, structured output, and tests for success, invalid tx hash/wallet/amount, project-payment mismatch, duplicate unresolved submission, forbidden project, and backend amount mismatch failures. Preserve existing payment-flow observability and ensure the tool never asks agents to infer confirmations or bypass the reconciliation pipeline.

### MCP-5.9. Finalize `project_member.project.reporting_status`

- Status: Complete
- Timestamp started: 2026-05-06T19:07:24-0400
- Head when starting: fa475b8
- Timestamp completed: 2026-05-06T19:10:23-0400
- Feature branch(es): codex/mcp-roadmap-kickoff
- Session-log reference(s): session v148

Finalize the project-member reporting-status tool as a read-only status briefing for members who contribute attribution/reporting data. Require valid `projectSlug` and optional `cycleKey`, call the `mcp-workflow-read` operation, and return reporting status, attribution/data-submission readiness, published report availability, and next actions. Add read-only annotations, structured output, and tests for accessible project, forbidden project, invalid cycle key, no-current-cycle empty state, partial warnings, and no exposure of founder-only payment route details or operator-private artifact internals.

### MCP-5.10. Finalize `operator.cycles.list`

- Status: Complete
- Timestamp started: 2026-05-06T19:12:56-0400
- Head when starting: 4d9c904
- Timestamp completed: 2026-05-06T19:15:55-0400
- Feature branch(es): codex/mcp-roadmap-kickoff
- Session-log reference(s): session v149

Finalize the operator monthly-cycle listing tool as an internal-operator read-only overview. Require internal-operator context from the MCP-3 allowlist gate, keep output compact and paginated or bounded, and call the `mcp-workflow-read` operation. Add read-only/admin annotations, structured output, stable errors, and tests proving non-operators are blocked before handler execution, operators receive bounded cycle summaries, read failures are safe, and no private manifest contents, artifact bodies, service keys, or raw exception payloads appear in tool output.

### MCP-5.11. Finalize `operator.cycle.observability`

- Status: Complete
- Timestamp started: 2026-05-06T19:16:45-0400
- Head when starting: a039783
- Timestamp completed: 2026-05-06T19:20:42-0400
- Feature branch(es): codex/mcp-roadmap-kickoff
- Session-log reference(s): session v150

Finalize the operator cycle-observability tool as a bounded internal read for cycle events by `cycleKey` or `attemptId`. Require internal-operator authorization, strict cycle/attempt validation, and compact event summaries with severity, event type, outcome, timestamp, and safe messages. Add read-only/admin annotations, structured output, and tests for valid filters, no-filter defaults, invalid filters, non-operator rejection, partial read failures, and output redaction of any sensitive payload fragments. Keep this read-only; mutation or replay actions belong in separate explicitly confirmed tools.

### MCP-5.12. Finalize `operator.payments.reconciliation_visibility`

- Status: Complete
- Timestamp started: 2026-05-06T19:21:32-0400
- Head when starting: 7928247
- Timestamp completed: 2026-05-06T19:24:35-0400
- Feature branch(es): codex/mcp-roadmap-kickoff
- Session-log reference(s): session v151

Finalize the operator reconciliation visibility tool as a read-only internal health summary for payment reconciliation queues. Require internal-operator authorization and call the `mcp-workflow-read` operation rather than direct table reads. Return bounded counts, warning states, stale-queue indicators, and safe next-action hints. Add read-only/admin annotations, structured output, stable errors, and tests for operator success, non-operator rejection, empty queues, partial read warnings, and no leakage of private wallet credentials, service-role details, raw transaction payloads, or command bodies.

### MCP-5.13. Finalize `operator.reporting.coverage`

- Status: Complete
- Timestamp started: 2026-05-06T19:52:17-0400
- Head when starting: d083707
- Timestamp completed: 2026-05-06T19:55:29-0400
- Feature branch(es): codex/mcp-roadmap-kickoff
- Session-log reference(s): session v152

Finalize the operator reporting-coverage tool as a read-only internal overview of public, user, founder, and operator report publication coverage. Require internal-operator authorization, optional valid `cycleKey`, and the existing `mcp-workflow-read` operation. Return compact coverage counts, gaps, warning states, and safe links or identifiers where appropriate. Add read-only/admin annotations, structured output, and tests for current-cycle default, explicit cycle, invalid cycle key, non-operator rejection, partial warnings, and no private artifact body or storage signed URL leakage.

### MCP-5.14. Candidate `founder.project.contribution.submit`

- Status: Not started
- Timestamp started: TBD
- Head when starting: TBD
- Timestamp completed: 2026-05-06T20:14:52-0400
- Feature branch(es): TBD
- Session-log reference(s): TBD

Design and implement this candidate only after the founder attribution/contribution Edge command is explicitly ready for MCP use. The tool should submit structured founder contribution data for a project/cycle, require project-admin or authorized member context, use strict schemas with idempotency, and return a compact submission summary. Before enabling it, document the exact source Edge Function, audit event, retry behavior, and confirmation model if the submission changes locked-cycle artifacts. Add tests for tenant scoping, idempotency, malformed data, forbidden projects, and backend validation failures.

### MCP-5.15. Candidate `founder.project.payment_drafts.create`

- Status: Complete
- Timestamp started: 2026-05-06T19:58:24-0400
- Head when starting: cf00eca
- Timestamp completed: 2026-05-06T20:00:56-0400
- Feature branch(es): codex/mcp-roadmap-kickoff
- Session-log reference(s): session v153

Design and implement this candidate only if founder agents should draft monthly payment obligations through MCP. It should wrap the existing `project-payment-drafts-create` command, require project-admin access, strict project/cycle/payment input validation, and idempotent attempt handling. Output should summarize created draft rows and warnings, not raw payment rows. Add write annotations, tests for validation failure, permission failure, backend failure, success, and retry behavior. Keep actual payment confirmation, reconciliation, and monthly-cycle lock flows in their existing dedicated operator/founder tools.

### MCP-5.16. Candidate `user.workspace.summary`

- Status: Complete
- Timestamp started: 2026-05-06T20:04:03-0400
- Head when starting: 664feef
- Timestamp completed: 2026-05-06T20:23:32-0400
- Feature branch(es): codex/mcp-roadmap-kickoff
- Session-log reference(s): session v154

Design and implement this candidate as the first regular-user MCP read tool only after the user workspace read boundary is confirmed safe for agent access. It should return identity/completion status, participation footprint, current results visibility, payout readiness summary, and discovery next actions for the authenticated user only. Add read-only annotations, structured output, stable empty states, and tests for unauthenticated rejection, active user with no participation, user with results, partial read warnings, and no leakage of CUBID raw payloads, private payout credentials, or other users' data.

### MCP-5.17. Candidate `user.payout.routes.list`

- Status: Complete
- Timestamp started: 2026-05-06T20:10:50-0400
- Head when starting: 0ea6b1e
- Timestamp completed: TBD
- Feature branch(es): codex/mcp-roadmap-kickoff
- Session-log reference(s): session v155

Design and implement this candidate only after payout route read models are stable and safe for agent exposure. It should list the authenticated user's payout readiness and route summaries without revealing secrets, private wallet credentials, or raw provider tokens. Keep it read-only unless a later session introduces explicit payout-route mutation tools with confirmation and idempotency. Add read-only annotations, structured output, and tests for no routes, configured routes, provider warning states, unauthorized access, partial read failures, and output redaction.

### MCP-5.18. Candidate `operator.cycle.lock`

- Status: Not started
- Timestamp started: TBD
- Head when starting: TBD
- Timestamp completed: TBD
- Feature branch(es): TBD
- Session-log reference(s): TBD

Do not expose this candidate until remote MCP auth, operator authorization, confirmation, audit, and abuse controls are strong enough for a sensitive monthly-cycle mutation. If implemented, it must wrap `monthly-cycle-lock`, require internal-operator access, exact cycle key, `confirm: true`, an explicit reason, and any unresolved-onchain override fields required by the backend command. Add destructive/admin annotations, idempotency/attempt handling, and tests for non-operator rejection, missing confirmation, unresolved-onchain block, override reason requirement, success, and audit logging. This remains candidate-only until explicitly approved.

**Acceptance criteria for TODO 5**

* [ ] Every tool has a strict schema.
* [ ] Every tool has tests.
* [ ] Every tool is tenant-scoped.
* [ ] Every mutating tool has idempotency or retry protection.
* [ ] Every destructive tool has explicit confirmation.
* [ ] No tool bypasses the product’s existing permission model.

---

## MCP-6. Implement resources and prompts where useful

- Status: Complete
- Timestamp started: 2026-05-06T20:20:30-0400
- Head when starting: 5912fe4
- Timestamp completed: TBD
- Feature branch(es): codex/mcp-roadmap-kickoff
- Session-log reference(s): session v156

* [ ] Add MCP resources only where agents benefit from browsing stable, read-only product context.
* [ ] Add resources for:

  * product documentation
  * workspace/project summaries
  * read-only entity snapshots
  * user-accessible reports
  * changelogs or activity feeds

* [ ] Keep resources tenant-scoped and paginated.
* [ ] Avoid exposing large unbounded datasets.
* [ ] Add MCP prompts for common workflows, for example:

  * “Create a funding update”
  * “Summarize project status”
  * “Prepare investor follow-up”
  * “Review pending tasks”

* [ ] Ensure prompts do not smuggle hidden instructions or override client/user intent.

**Acceptance criteria**

* [ ] `resources/list` works if resources are implemented.
* [ ] `prompts/list` works if prompts are implemented.
* [ ] Resources and prompts are documented.
* [ ] Resources do not leak cross-tenant or private data.

---

## MCP-7. Optional: ChatGPT / OpenAI Apps SDK integration

- Status: Not started
- Timestamp started: TBD
- Head when starting: TBD
- Timestamp completed: TBD
- Feature branch(es): TBD
- Session-log reference(s): TBD

Only do this if the product should expose interactive UI widgets inside ChatGPT or another Apps SDK-compatible client.

* [ ] Add Apps SDK-compatible tool descriptors.
* [ ] Add widget resources where useful.
* [ ] Ensure the MCP server enforces auth and returns data; OpenAI’s Apps SDK describes the MCP server as the component that defines tools, enforces auth, returns data, and points tools to UI. ([OpenAI Developers][4])
* [ ] Add `_meta["openai/outputTemplate"]` for tools that render widgets.
* [ ] Add widget CSP via `_meta["openai/widgetCSP"]` or the current Apps SDK equivalent.
* [ ] Restrict `connect_domains`, `resource_domains`, and `frame_domains`.
* [ ] Avoid broad `frame_domains`; OpenAI’s guidance says frame domains are discouraged unless core to the experience. ([OpenAI Developers][4])
* [ ] Do not rely on client-provided hints for auth or authorization.
* [ ] Test read-only tools first.
* [ ] Avoid destructive/admin tools in ChatGPT unless identity, auth, intent, and confirmation are very strong.

**Acceptance criteria**

* [ ] Apps SDK scan passes.
* [ ] Widget CSP has no avoidable wildcard domains.
* [ ] Widget state contains no secrets.
* [ ] ChatGPT/client-side rendering works for at least one tool.

---

## MCP-8. Local development and smoke testing

- Status: Complete
- Timestamp started: 2026-05-06T20:24:00-0400
- Head when starting: 718850b
- Timestamp completed: 2026-05-06T20:30:20-0400
- Feature branch(es): codex/mcp-roadmap-kickoff
- Session-log reference(s): session v157

* [ ] Add seed data for MCP tests in Supabase local development.
* [ ] Start Supabase locally:

```bash
supabase start
```

* [ ] Serve the MCP Edge Function locally:

```bash
supabase functions serve mcp
```

* [ ] For unauthenticated local-only testing, document this separately:

```bash
supabase functions serve --no-verify-jwt mcp
```

* [ ] Test initialization with curl. Streamable HTTP requires the correct `Accept` header; Supabase’s MCP example uses `application/json, text/event-stream`. ([Supabase][2])

```bash
curl -sS http://localhost:54321/functions/v1/mcp \
  -H "Content-Type: application/json" \
  -H "Accept: application/json, text/event-stream" \
  -d '{
    "jsonrpc": "2.0",
    "id": 1,
    "method": "initialize",
    "params": {
      "protocolVersion": "2025-11-25",
      "capabilities": {},
      "clientInfo": {
        "name": "local-smoke",
        "version": "0.1.0"
      }
    }
  }'
```

* [ ] Test `tools/list`:

```bash
curl -sS http://localhost:54321/functions/v1/mcp \
  -H "Content-Type: application/json" \
  -H "Accept: application/json, text/event-stream" \
  -d '{
    "jsonrpc": "2.0",
    "id": 2,
    "method": "tools/list",
    "params": {}
  }'
```

* [ ] Test one read-only tool:

```bash
curl -sS http://localhost:54321/functions/v1/mcp \
  -H "Content-Type: application/json" \
  -H "Accept: application/json, text/event-stream" \
  -H "Authorization: Bearer $FUNDLOOP_MCP_LOCAL_TEST_TOKEN" \
  -d '{
    "jsonrpc": "2.0",
    "id": 3,
    "method": "tools/call",
    "params": {
      "name": "founder.projects.list",
      "arguments": {}
    }
  }'
```

* [ ] Run the MCP Inspector:

```bash
pnpm dlx @modelcontextprotocol/inspector
```

The MCP Inspector is the official interactive tool for testing and debugging MCP servers, including listing tools/resources/prompts and testing tool calls. ([Model Context Protocol][9])

**Acceptance criteria**

* [ ] Local curl initialization works.
* [ ] Local `tools/list` works.
* [ ] Local read-only tool call works.
* [ ] Local write tool call works with valid auth and confirmation.
* [ ] Invalid auth fails.
* [ ] Cross-tenant access fails.
* [ ] MCP Inspector connects successfully.
* [ ] Smoke test transcript is saved to `docs/mcp/validation.md`.

---

## MCP-9. Automated tests

- Status: Complete
- Timestamp started: 2026-05-06T20:35:04-0400
- Head when starting: 600a79d
- Timestamp completed: 2026-05-06T20:39:47-0400
- Feature branch(es): codex/mcp-roadmap-kickoff
- Session-log reference(s): session v158

### Unit tests

* [x] Tool input schema validation.
* [x] Tool output schema validation.
* [x] Auth token parsing.
* [x] Scope checks.
* [x] Tenant checks.
* [x] Service adapter behavior.
* [x] Error formatting.
* [x] Secret redaction.

### Integration tests

* [ ] Supabase local database with seed data.
* [x] Existing Supabase Edge Functions called through the same paths used by the UI.
* [x] MCP server initialization.
* [x] `tools/list`.
* [x] One test per tool.
* [x] Write-tool idempotency.
* [x] Destructive-tool confirmation.
* [ ] Rate limiting.
* [x] Audit log creation.

### Security tests

* [ ] SQL injection attempts.
* [ ] Command injection attempts.
* [x] Path traversal attempts.
* [x] SSRF attempts.
* [x] Prompt-injection payloads in user-generated content.
* [x] Forged JWT.
* [x] Expired JWT.
* [x] Wrong-audience JWT.
* [x] Wrong-issuer JWT.
* [x] Missing scope.
* [x] Cross-tenant entity ID.
* [x] Oversized input.
* [ ] Repeated failed calls.

### Contract tests

* [x] MCP initialize contract.
* [x] Capability negotiation.
* [x] `tools/list` shape.
* [x] `tools/call` success shape.
* [x] `tools/call` error shape.
* [x] `resources/list` shape if resources exist.
* [x] `prompts/list` shape if prompts exist.
* [ ] Concurrent calls.
* [ ] Timeout behavior.
* [ ] Retry behavior.

MCP best-practice guidance recommends layered testing, including unit, integration, contract, load, and resilience testing. ([MCP Protocol][10])

Session MCP-9 completes the automated local contract guardrail by adding registry-wide MCP tests to `pnpm mcp:test`. Hosted CI confirmation, live Supabase seeded integration, rate-limit/load, repeated-failure, and timeout/retry stress coverage remain promotion gates rather than this local implementation commit.

**Acceptance criteria**

* [x] All tests pass locally.
* [ ] All tests pass in CI.
* [x] Security tests are included in CI.
* [x] Test coverage includes every tool.
* [x] CI fails if a tool is missing schema, auth, scope, tenant, or annotation metadata.

---

## MCP-10. Observability, operations, and runbook

- Status: Complete
- Timestamp started: 2026-05-06T20:40:04-0400
- Head when starting: 9e8e20e
- Timestamp completed: 2026-05-06T20:44:12-0400
- Feature branch(es): codex/mcp-roadmap-kickoff
- Session-log reference(s): session v159

* [x] Add structured logs with:

  * [x] request ID
  * [x] client ID
  * [x] user ID hash
  * [x] tenant ID hash
  * [x] tool name
  * [x] tool category
  * [x] status
  * [x] latency
  * [x] error code
* [x] Redact:

  * [x] bearer tokens
  * [x] refresh tokens
  * [x] Supabase keys
  * [x] service-role keys
  * [x] authorization headers
  * [x] cookies
  * [x] raw secrets
* [x] Add metrics:

  * [x] calls per tool
  * [x] error rate per tool
  * [x] p50/p95/p99 latency
  * [x] auth failures
  * [x] authorization failures
  * [ ] rate-limit hits
  * [x] tenant mismatch attempts
* [x] Add alerts for:

  * [x] elevated error rate
  * [x] auth failure spikes
  * [x] destructive tool spikes
  * [ ] rate-limit spikes
  * [x] unusual data export volume
* [x] Create `docs/mcp/runbook.md` with:

  * [x] common failures
  * [x] how to revoke client access
  * [x] how to disable a tool
  * [x] how to rotate secrets
  * [x] how to inspect audit logs
  * [x] how to roll back a deployment
  * [x] incident escalation contacts

**Acceptance criteria**

* [x] Logs are useful and redacted.
* [x] Metrics exist for every tool.
* [x] A tool can be disabled quickly.
* [x] Runbook exists and has rollback instructions.

---

## MCP-11. Deployment

- Status: Complete (deployment readiness; hosted deployment and production smoke remain PR/promotion gates)
- Timestamp started: 2026-05-06T20:48:05-0400
- Head when starting: 07380f5
- Timestamp completed: 2026-05-06T20:50:25-0400
- Feature branch(es): codex/mcp-roadmap-kickoff
- Session-log reference(s): session v160

* [x] Add environment variables and secrets:

  * [x] auth issuer
  * [x] auth audience
  * [x] JWKS URL or verification secret
  * [x] allowed origins
  * [ ] rate-limit config
  * [x] service URLs
  * [x] logging config
* [x] Verify production uses HTTPS.
* [x] Verify production auth is enabled.
* [ ] Deploy the Edge Function:

```bash
supabase functions deploy mcp
```

* [x] Only use `--no-verify-jwt` for public unauthenticated servers or when the MCP handler itself fully validates auth.
* [ ] Run production smoke tests:

  * [x] health check
  * [x] initialize
  * [x] tools/list
  * [x] one read-only tool
  * [ ] one write tool in a test tenant
  * [x] invalid auth
  * [ ] invalid tenant
  * [ ] rate-limit behavior
* [ ] Run MCP Inspector against production.
* [ ] Record production validation results in `docs/mcp/validation.md`.

Session MCP-11 adds the deployment-readiness contract, hosted HTTPS/auth smoke hooks, and deployment docs. Actual remote deploy, MCP Inspector against Production, write-tool tenant smoke, invalid-tenant smoke, and rate-limit behavior remain promotion gates for the yeet/deploy flow rather than local commits.

**Acceptance criteria**

* [ ] Production endpoint works.
* [ ] Production auth works.
* [ ] Production invalid-auth test fails safely.
* [ ] Production cross-tenant test fails safely.
* [ ] Production smoke test transcript is saved.
* [x] Rollback path is documented.

---

## MCP-12. Packaging and official MCP registry publication

- Status: Complete (metadata prepared; actual registry publish deferred)
- Timestamp started: 2026-05-06T20:52:05-0400
- Head when starting: b961d2c
- Timestamp completed: 2026-05-06T20:54:22-0400
- Feature branch(es): codex/mcp-roadmap-kickoff
- Session-log reference(s): session v161

* [x] Decide whether the server is published as:

  * [x] hosted remote MCP server only
  * [ ] npm package
  * [ ] Docker image
  * [ ] GitHub release
  * [ ] multiple formats

* [x] If publishing to the official MCP Registry, publish the actual server artifact somewhere first. The official registry currently hosts server metadata, not artifacts. ([Model Context Protocol][11])
* [x] Create `server.json` for the official MCP Registry.
* [x] Verify package name / MCP name ownership according to registry requirements.
* [ ] Install `mcp-publisher`.
* [ ] Run registry login.
* [ ] Publish the registry entry.
* [x] Save registry URL and publication status in `docs/mcp/publication.md`.

Session MCP-12 prepares registry metadata and publication docs only. Actual `mcp-publisher` installation, login, and publication remain blocked until the hosted remote endpoint is intentionally public and the MCP-11 production smoke/promotion gates are complete.

**Acceptance criteria**

* [x] `server.json` exists.
* [x] Official registry publication succeeds or has a documented pending/error state.
* [x] Public install/connect instructions are accurate.
* [x] Versioning policy is documented.

---

## MCP-13. Public directory submissions

- Status: Complete (landing page and target tracking; external submissions deferred)
- Timestamp started: 2026-05-06T20:55:05-0400
- Head when starting: 2400449
- Timestamp completed: 2026-05-06T20:59:57-0400
- Feature branch(es): codex/mcp-roadmap-kickoff
- Session-log reference(s): session v162

Create a public MCP landing page first, for example:

```text
https://<fundloop-web-base-url>/mcp
```

It should include:

* [x] Server name.
* [x] Short description.
* [x] Supported tools.
* [x] Auth requirements.
* [x] Connection URL.
* [x] Install instructions.
* [x] Example use cases.
* [x] Security model summary.
* [x] Privacy/data handling summary.
* [x] Contact email.
* [x] Changelog.
* [x] Status page or uptime note, if available.

Then submit to relevant directories:

* [ ] **Official MCP Registry**
  Publish via `mcp-publisher` and `server.json`. The official registry is intended as a central discovery location for MCP servers. ([Model Context Protocol][11])

* [ ] **mcpservers.org**
  Submit server name, short description, link, category, and contact email. ([Awesome MCP Servers][12])

* [ ] **PulseMCP**
  Submit or verify ingestion. PulseMCP says it ingests the official MCP Registry daily and processes submitted servers weekly. ([PulseMCP][13])

* [ ] **Smithery**
  Submit as an external or hosted MCP server if the product fits. Smithery’s publishing docs say remote servers should support Streamable HTTP and use OAuth if authentication is required. ([smithery.ai][14])

* [ ] **mcp.so**
  Submit via their GitHub issue flow with name, description, features, and connection information. ([MCP.so][15])

* [ ] **Docker MCP Catalog**, if containerized
  Submit a PR to Docker’s MCP registry if the server has a Docker image. Docker’s guidance highlights container isolation, provenance, SBOMs, and catalog submission. ([GitHub][16])

* [ ] Optional: add GitHub topic `mcp-server`.

* [ ] Optional: publish a product changelog post.

* [x] Optional: publish a developer docs page.

* [ ] Optional: announce in relevant MCP communities.

* [ ] Optional: submit to curated “awesome MCP” lists if the repo meets their contribution standards.

Session MCP-13 creates the public `/mcp` landing page, adds it to public resource links, records the route inventory, and keeps external directory submissions deferred until hosted deploy, production smoke, and registry publication gates are complete.

**Acceptance criteria**

* [x] `docs/mcp/publication.md` lists every target directory.
* [x] Each directory has status: `not-started`, `submitted`, `accepted`, `rejected`, or `needs-follow-up`.
* [x] Public landing page exists.
* [x] Public connection instructions work.
* [x] Contact email works.

---

## MCP-14. Documentation deliverables

- Status: Complete
- Timestamp started: 2026-05-06T21:01:50-0400
- Head when starting: a581a06
- Timestamp completed: 2026-05-06T21:03:37-0400
- Feature branch(es): codex/mcp-roadmap-kickoff
- Session-log reference(s): session v163

Create or update:

* [x] `docs/mcp/README.md`
* [x] `docs/mcp/architecture.md`
* [x] `docs/mcp/tool-catalog.md`
* [x] `docs/mcp/auth-and-scopes.md`
* [x] `docs/mcp/security-model.md`
* [x] `docs/mcp/testing.md`
* [x] `docs/mcp/validation.md`
* [x] `docs/mcp/publication.md`
* [x] `docs/mcp/runbook.md`
* [x] `docs/mcp/changelog.md`
* [x] `server.json`
* [x] public page: `/mcp`
* [ ] optional: `.well-known/mcp/server-card.json` if useful for discovery or a target directory

**Acceptance criteria**

* [x] A new engineer can connect to the MCP server from the docs alone.
* [x] A security reviewer can understand the auth, scope, tenant, and data model.
* [x] A coding agent can add a new tool by following documented patterns.
* [x] A support/operator can disable a bad tool or revoke client access.

---

## MCP-15. Final “done” checklist

- Status: Complete (readiness ledger created; production launch gates remain pending)
- Timestamp started: 2026-05-06T21:06:58-0400
- Head when starting: 106f992
- Timestamp completed: 2026-05-06T21:10:42-0400
- Feature branch(es): codex/mcp-roadmap-kickoff
- Session-log reference(s): session v164

The MCP capability is done only when all of the following are true:

* [x] MCP server runs locally.
* [ ] MCP server runs in production. Pending hosted deploy evidence.
* [x] Streamable HTTP endpoint works locally.
* [ ] Auth is enforced in production. Pending hosted smoke with valid and invalid bearer tokens.
* [ ] Tenant isolation is enforced in hosted smoke. Architecture and tests exist; hosted cross-tenant smoke remains pending.
* [x] Every current tool has strict schemas.
* [x] Every current tool has correct annotations.
* [x] Every current tool has tests.
* [x] Every exposed write-capable bridge has allowlist/idempotency guardrails; destructive/operator MCP mutations remain deferred.
* [x] Every destructive tool requires confirmation or is not exposed.
* [x] No tool bypasses existing product authorization by design; backing Edge/read gateways remain the authorization boundary.
* [x] No secrets are exposed in results, logs, metadata, or widgets by covered redaction tests.
* [x] Local smoke tests pass.
* [ ] Production smoke tests pass. Pending deploy.
* [ ] MCP Inspector validation passes. Pending hosted endpoint.
* [ ] CI tests pass. Pending PR checks.
* [x] Security tests pass locally through MCP contract coverage.
* [x] Engineering docs are complete.
* [x] Runbook is complete.
* [ ] Public landing page is live. Implemented locally; pending web deploy.
* [x] Official registry submission is tracked.
* [x] Public directory submissions are tracked.
* [x] Product docs mention the MCP server.
* [x] Owner, contact, version, and support process are documented.

Session MCP-15 adds `docs/mcp/readiness.md` as the truthful readiness ledger. The local implementation is PR-ready, but the public MCP capability must not be called production-done until hosted deploy, production smoke, MCP Inspector, CI, and publication gates are complete.

---

## Appendix: Sources

This checklist is grounded in the official MCP, Supabase, OpenAI Apps SDK, OWASP, Snyk, Docker, and registry/directory documentation below.

[1]: https://modelcontextprotocol.io/specification/2025-11-25/basic/transports "Transports - Model Context Protocol"
[2]: https://supabase.com/docs/guides/getting-started/byo-mcp "Deploy MCP servers | Supabase Docs"
[3]: https://www.docker.com/blog/mcp-server-best-practices/ "Top 5 MCP Server Best Practices | Docker"
[4]: https://developers.openai.com/apps-sdk/build/mcp-server "Build your MCP server – Apps SDK | OpenAI Developers"
[5]: https://modelcontextprotocol.io/docs/develop/build-server "Build an MCP server - Model Context Protocol"
[6]: https://modelcontextprotocol.io/specification/2025-11-25/basic/authorization "Authorization - Model Context Protocol"
[7]: https://modelcontextprotocol.io/docs/tutorials/security/security_best_practices "Security Best Practices - Model Context Protocol"
[8]: https://snyk.io/articles/building-secure-mcp-servers/ "Building Secure MCP Servers: A Developer's Guide to Avoiding Critical Vulnerabilities | Snyk"
[9]: https://modelcontextprotocol.io/docs/tools/inspector "MCP Inspector - Model Context Protocol"
[10]: https://modelcontextprotocol.info/docs/best-practices/ "MCP Best Practices: Architecture & Implementation Guide – Model Context Protocol （MCP）"
[11]: https://modelcontextprotocol.io/registry/quickstart "Quickstart: Publish an MCP Server to the MCP Registry - Model Context Protocol"
[12]: https://mcpservers.org/submit "Submit Your MCP Server | Awesome MCP Servers"
[13]: https://www.pulsemcp.com/submit "
  PulseMCP | Keep up-to-date with MCP
"
[14]: https://smithery.ai/docs/build/publish "Publish - Smithery Documentation"
[15]: https://mcp.so/ "MCP Servers"
[16]: https://github.com/docker/mcp-registry "GitHub - docker/mcp-registry: Official Docker MCP registry · GitHub"

---

EOD

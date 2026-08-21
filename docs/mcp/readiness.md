# FundLoop MCP Readiness Ledger

This ledger records the current MCP readiness state. It is intentionally stricter than the implementation roadmap: a local feature can be complete while the public MCP capability is not yet production-launched.

## Current State

Status: **implementation ready for PR review; not production-launched**

The local stdio harness, remote Supabase Edge Function implementation, authenticated tool registry, security controls, observability, docs, landing page, and registry metadata are in place. Production readiness still depends on the hosted deploy path and post-deploy smoke evidence.

## Completed Gates

| Gate | Status | Evidence |
| --- | --- | --- |
| Local stdio server runs | Complete | `pnpm mcp:smoke` is documented and covered by the MCP validation path. |
| Remote Streamable HTTP implementation exists | Complete | `supabase/functions/mcp/index.ts` serves public health plus authenticated MCP POST traffic. |
| Strict schemas exist for current tools | Complete | `pnpm mcp:test` includes registry-wide schema, output, annotation, and auth coverage. |
| Tool annotations exist | Complete | MCP contract tests fail when current tools lack required annotations. |
| Tool-level authorization exists | Complete | Remote POST requires Supabase JWT auth and registry dispatch applies actor/tool gates. |
| Write-tool safety posture exists | Complete | Generic Edge command bridge is allowlisted; operator/destructive command exposure remains blocked/deferred. |
| Secret redaction exists | Complete | Contract tests cover output and audit redaction for bearer-like and secret-like values. |
| Local smoke tests pass | Complete | `pnpm mcp:smoke` and `pnpm mcp:test` are part of the documented validation path. |
| Engineering docs are complete | Complete | `docs/mcp/README.md` links architecture, security, auth/scopes, testing, runbook, publication, and changelog docs. |
| Runbook exists | Complete | `docs/mcp/runbook.md` covers triage, logs, disabling tools, revocation, rotation, rollback, and escalation. |
| Public landing page exists | Complete | `/[locale]/mcp` describes the server, tools, auth, setup, use cases, contact, and status. |
| Registry metadata exists | Complete | `server.json` and `pnpm mcp:registry:check` validate the metadata shape. |
| Owner/contact/version/support process is documented | Complete | Covered by `server.json`, `docs/mcp/publication.md`, `docs/mcp/runbook.md`, and `/mcp`. |

## Gated Before Public Launch

| Gate | Status | Required next evidence |
| --- | --- | --- |
| Production remote endpoint works | Pending deploy | Successful Supabase deploy run for the branch target plus hosted `GET /health` and MCP POST smoke. |
| Production auth works | Pending deploy | Hosted smoke with a valid Supabase bearer token and invalid-token negative test. |
| Tenant isolation is verified in hosted env | Pending smoke | Cross-project/user negative smoke using non-production accounts before main promotion. |
| Production smoke tests pass | Pending deploy | Redacted transcript added to `docs/mcp/validation.md`. |
| MCP Inspector validation passes | Pending deploy | Inspector transcript or summary against the hosted endpoint. |
| CI tests pass | Pending PR | GitHub checks on the PR branch. |
| Security tests pass in CI | Pending PR | MCP contract tests and repo checks green in CI. |
| Public landing page is live | Pending web deploy | Hosted app deploy serving `/mcp`. |
| Official registry submission is complete | Deferred | Run `mcp-publisher` only after production smoke gates pass. |
| Public directory submissions are complete | Deferred | Submit to tracked directories after hosted endpoint and landing page are live. |
| Product changelog announces MCP | Deferred | Publish release/changelog note after launch approval. |

## Deferred By Design

- OAuth 2.1 / dynamic client registration.
- Public registry publication before hosted smoke evidence exists.
- Destructive/operator MCP mutation exposure.
- Production rate-limit/load testing beyond basic hosted smoke.
- `.well-known/mcp/server-card.json`, unless a specific target directory requires it.

## Promotion Checklist

Before calling the MCP capability production-done:

1. Merge the MCP PR to the deploy target.
2. Confirm the Supabase deploy workflow deploys the `mcp` Edge Function.
3. Run `pnpm mcp:edge:smoke` against the hosted endpoint with `FUNDLOOP_MCP_REQUIRE_HTTPS=true`.
4. Run missing/invalid bearer negative checks against the hosted endpoint.
5. Run one tenant-bound negative smoke for a project/user the actor should not access.
6. Run MCP Inspector against the hosted endpoint.
7. Record a redacted transcript in `docs/mcp/validation.md`.
8. Publish registry/directory submissions only after the above evidence exists.

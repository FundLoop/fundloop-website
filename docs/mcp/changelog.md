# FundLoop MCP Changelog

## 0.1.0 - Roadmap Branch Baseline

- Added remote MCP over Supabase Edge Functions using Streamable HTTP.
- Preserved `packages/mcp-server` as the local stdio harness.
- Added Supabase bearer-token validation for remote tool traffic.
- Added front-door tool authorization for authenticated, founder/project-member, and internal-operator surfaces.
- Added strict MCP input validation, output redaction, and prompt/resource safety rules.
- Added founder, user, project-member, and operator tools backed by typed Edge Function/read-model boundaries.
- Added read-only MCP resources and workflow starter prompts.
- Added local stdio and Edge smoke coverage for tools, resources, and prompts.
- Added registry-wide contract tests that fail when tool schema/auth/annotation metadata drifts.
- Added structured MCP observability logs, emergency tool disablement, deployment docs, and operations runbook.
- Added `server.json`, publication docs, and public `/mcp` landing page.

## Deferred

- Hosted Production smoke transcript.
- MCP Inspector validation against Production.
- Official MCP Registry publication.
- Public directory submissions.
- OAuth 2.1 / PKCE / dynamic client registration for third-party clients.
- Distributed rate limiting and hosted load/stress tests.
- Destructive/operator mutation tools.

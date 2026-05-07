# FundLoop MCP Auth And Scopes

## Current Auth Mode

Remote MCP tool traffic uses first-party Supabase bearer tokens.

- `GET /functions/v1/mcp/health` is public and non-sensitive.
- `POST /functions/v1/mcp` requires `Authorization: Bearer <Supabase access token>`.
- The Edge Function calls Supabase `auth.getUser()` before constructing the MCP server for the request.
- Missing, expired, invalid, wrong-audience, and wrong-issuer tokens fail before tool dispatch through Supabase validation.

Local stdio uses `FUNDLOOP_MCP_BEARER_TOKEN` so local MCP clients can call the same Edge command/read boundaries as the web app.

`FUNDLOOP_MCP_ALLOW_LOCAL_TEST_TOKEN=true` is only for direct local Edge smoke with `local-smoke-token`. Do not configure it in Preview or Production.

## Actor Roles

The current role model is intentionally small:

- regular user: authenticated FundLoop user.
- founder/project member: authenticated user whose project access is enforced by `mcp-workflow-read` or backing Edge command/domain checks.
- internal operator: authenticated user whose email is present in `FUNDLOOP_INTERNAL_ADMIN_EMAILS`.

The MCP front door gates broad tool categories. Project/entity ownership still belongs to the backing Edge Function or read-model boundary.

## Tool Authorization

- `fundloop.health`: available for authenticated remote users and local smoke; public status belongs only to `GET /health`.
- `user.*`: authenticated user.
- `founder.*`: authenticated user; project access enforced by backing FundLoop workflow boundaries.
- `project_member.*`: authenticated user; project access enforced by backing FundLoop workflow boundaries.
- `operator.*`: internal operator only.
- `fundloop.edge_command.invoke`: authenticated user plus explicit `FUNDLOOP_MCP_ALLOWED_EDGE_FUNCTIONS` allowlist. Operator/destructive command names require internal-operator access even when allowlisted.

## Deferred OAuth Scopes

OAuth 2.1, PKCE, dynamic client registration, and third-party client scopes are deferred until public third-party onboarding is intentional.

When added, scopes should be narrow and map to current actor/tool categories, for example:

- `fundloop:user.read`
- `fundloop:founder.read`
- `fundloop:founder.write`
- `fundloop:project-member.read`
- `fundloop:operator.read`

Wildcard scopes should not be used.

## Revocation

- Revoke a user's Supabase session for actor-level compromise.
- Remove an email from `FUNDLOOP_INTERNAL_ADMIN_EMAILS` to revoke operator MCP access.
- Use `FUNDLOOP_MCP_DISABLED_TOOLS` for emergency tool-level mitigation.
- Rotate Supabase keys only for environment-level compromise and coordinate with hosted app/Edge runtime owners.

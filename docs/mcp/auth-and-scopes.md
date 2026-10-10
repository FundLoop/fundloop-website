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

## OAuth Scopes

Delegated access for sibling apps goes through Cubid cross-app access, not a FundLoop OAuth server
(issue #266, stage 2); see [the cross-app access doc](../engineering/cubid-cross-app-access.md). A
requesting client obtains an identity assertion grant from Cubid, where the person consents, and
redeems it at FundLoop for a short-lived FundLoop access token. The scope vocabulary is narrow and
read-only:

- `profile:read` — which account the token acts for.
- `awards:read` — that person's own award and allocation history.
- `payout-routes:read` — which payout routes they have, without any destination detail.

These replace the `fundloop:*` names sketched here before the server existed. The earlier sketch
mapped scopes to MCP tool categories, including write and operator categories; the implemented
vocabulary deliberately does not. A delegated token reads one person's own data and nothing else:
there is no founder, project-member or operator scope, and no write scope. Those capabilities stay
behind a FundLoop session, where the actor is a person we can hold accountable, not a token held by
an application.

Wildcard scopes are not used. Adding a scope is a migration (the `public.oauth_scope` enum) plus a
change to `lib/oauth/scopes.ts`, because a scope is a promise to a third-party client.

Dynamic client registration (RFC 7591) is not implemented. Requesting clients are registered by an
operator on both sides, so the set of applications that can ask for access stays curated.

FundLoop runs no authorization endpoint and no consent page: a person grants and withdraws cross-app
access in Cubid Passport, in one place for every sibling app.

## Revocation

- A person withdraws cross-app access in Cubid Passport. Cubid sends a Security Event Token to
  `POST /oauth/security-events`, and FundLoop revokes that client's grant and tokens for that person
  on receipt. The 15-minute access-token lifetime is the bound on the gap before that delivery, and
  on a withdrawal Cubid never manages to deliver.
- `POST /oauth/revoke` (RFC 7009) lets a client drop its own token.
- FundLoop issues no refresh tokens: a client renews by redeeming a fresh assertion, so a withdrawn
  consent stops renewals at the source rather than relying on FundLoop noticing.
- `update public.oauth_clients set disabled_at = now()` withdraws one application's access entirely.
- Revoke a user's Supabase session for actor-level compromise.
- Remove an email from `FUNDLOOP_INTERNAL_ADMIN_EMAILS` to revoke operator MCP access.
- Use `FUNDLOOP_MCP_DISABLED_TOOLS` for emergency tool-level mitigation.
- Rotate Supabase keys only for environment-level compromise and coordinate with hosted app/Edge runtime owners.

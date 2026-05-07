# FundLoop MCP Deployment

FundLoop MCP deploys as the `mcp` Supabase Edge Function. Deployments should use the repository Supabase deploy workflow, not ad hoc remote pushes from a local shell.

## Environments

- Preview/dev: PR dry-runs and post-merge deploys to the dev Supabase project.
- Production/main: post-merge deploys to the main Supabase project through the GitHub `Production` environment gate.
- Local: `supabase functions serve --no-verify-jwt mcp` is allowed only for local protocol development when the handler validates its own local test token path.

## Required Edge Function Secrets

Set these in the target Supabase project before deploying `mcp`:

```env
NEXT_PUBLIC_SUPABASE_URL=https://<project-ref>.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=<project publishable/anon key>
FUNDLOOP_INTERNAL_ADMIN_EMAILS=<comma-separated operator emails>
FUNDLOOP_MCP_ALLOWED_EDGE_FUNCTIONS=
FUNDLOOP_MCP_DISABLED_TOOLS=
```

Do not set `FUNDLOOP_MCP_ALLOW_LOCAL_TEST_TOKEN=true` in Preview or Production.

The current production auth model validates Supabase bearer tokens through `auth.getUser()` in the Edge Function. Issuer, audience, JWKS, and signing-key verification are handled by Supabase before/through that auth client path rather than by a separate MCP-managed JWKS verifier.

## Optional Smoke Runner Env

Use these locally or in a smoke job:

```env
FUNDLOOP_MCP_HTTP_URL=https://<project-ref>.supabase.co/functions/v1/mcp
FUNDLOOP_MCP_BEARER_TOKEN=<non-production Supabase access token for a smoke actor>
FUNDLOOP_MCP_REQUIRE_HTTPS=true
```

`FUNDLOOP_MCP_REQUIRE_HTTPS=true` makes the smoke script fail if a hosted target is accidentally configured with plain HTTP.

## Deploy Path

Preferred path:

1. Open a PR into `dev`.
2. Confirm the Supabase deploy workflow dry-run passes.
3. Merge to `dev`.
4. Confirm the push-triggered Supabase deploy workflow deploys migrations and all Edge Functions, including `mcp`.
5. Run Preview/dev smoke:

```bash
FUNDLOOP_MCP_HTTP_URL=https://<dev-project-ref>.supabase.co/functions/v1/mcp \
  FUNDLOOP_MCP_BEARER_TOKEN=<preview-smoke-token> \
  FUNDLOOP_MCP_REQUIRE_HTTPS=true \
  pnpm mcp:edge:smoke
```

Manual fallback for an approved operator:

```bash
supabase functions deploy mcp --project-ref <project-ref>
```

Do not use `--no-verify-jwt` for Preview or Production deploys.

## Smoke Coverage

The current smoke script checks:

- public `GET /health`
- missing bearer token fails with `401`
- authenticated `initialize`
- authenticated `tools/list`
- authenticated `resources/list`
- authenticated `prompts/list`
- authenticated `tools/call` for `fundloop.health`

Before production publication, also perform manual or automated tenant-specific negative checks:

- non-operator cannot call `operator.*`
- non-operator cannot read `fundloop://operator/cycles`
- cross-project slug fails through `mcp-workflow-read` or the backing Edge Function
- generic `fundloop.edge_command.invoke` stays disabled unless explicitly needed

## Rollback

If the deploy fails or exposes unsafe behavior:

1. Prefer `FUNDLOOP_MCP_DISABLED_TOOLS` for tool-specific mitigation.
2. Revert the offending commit and let the Supabase deploy workflow redeploy the previous function state.
3. Re-run the smoke script and negative auth/authorization checks.
4. Do not reset or relink remote Supabase projects as a rollback mechanism.

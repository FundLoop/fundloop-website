import { OAUTH_SCOPES } from "@/lib/oauth/scopes"

// GET /.well-known/oauth-authorization-server — RFC 8414 (#266 stage 2).
//
// Served from here and rewritten in next.config.mjs, because Next's router ignores a directory
// whose name begins with a dot, so `app/.well-known/` would never match.
//
// The issuer is derived from the request's own origin rather than configuration. RFC 8414 requires
// the issuer to match the URL the document was fetched from, and this app is served on more than
// one host (production and the dev.fundloop.org sandbox), so one configured value would be wrong on
// the other. The app sits behind a trusted proxy that sets the forwarded host.
export const dynamic = "force-dynamic"

export function GET(request: Request) {
  const issuer = new URL(request.url).origin

  return Response.json(
    {
      issuer,
      authorization_endpoint: `${issuer}/oauth/authorize`,
      token_endpoint: `${issuer}/oauth/token`,
      revocation_endpoint: `${issuer}/oauth/revoke`,
      scopes_supported: [...OAUTH_SCOPES],
      response_types_supported: ["code"],
      // OAuth 2.1: the authorization code grant with PKCE, and refresh tokens. No implicit grant,
      // no password grant.
      grant_types_supported: ["authorization_code", "refresh_token"],
      code_challenge_methods_supported: ["S256"],
      token_endpoint_auth_methods_supported: ["none", "client_secret_basic", "client_secret_post"],
      revocation_endpoint_auth_methods_supported: ["none", "client_secret_basic", "client_secret_post"],
      service_documentation: `${issuer}/api/v1/openapi.json`,
      ui_locales_supported: ["en", "fr", "es"],
      // There is no dynamic client registration (RFC 7591): clients are registered by an operator,
      // so the absence of registration_endpoint is deliberate rather than an omission.
    },
    { headers: { "Cache-Control": "public, max-age=300" } },
  )
}

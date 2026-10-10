import { OAUTH_SCOPES } from "@/lib/oauth/scopes"

// GET /.well-known/oauth-authorization-server — RFC 8414 (#266 stage 2).
//
// FundLoop is a *resource app* in Cubid cross-app access, so this document describes a redemption
// endpoint, not an authorization server a person is sent to. It exists so a requesting client can
// discover where to redeem an assertion rather than being told out of band.
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
      token_endpoint: `${issuer}/oauth/token`,
      revocation_endpoint: `${issuer}/oauth/revoke`,
      scopes_supported: [...OAUTH_SCOPES],
      // FundLoop is a resource app in Cubid cross-app access: it redeems identity assertion grants
      // and runs no authorization endpoint of its own, so there is no authorization_endpoint, no
      // response type and no PKCE method to advertise. Consent is captured at Cubid, in Passport.
      grant_types_supported: ["urn:ietf:params:oauth:grant-type:jwt-bearer"],
      token_endpoint_auth_methods_supported: ["client_secret_basic", "client_secret_post"],
      revocation_endpoint_auth_methods_supported: ["client_secret_basic", "client_secret_post"],
      service_documentation: `${issuer}/api/v1/openapi.json`,
      ui_locales_supported: ["en", "fr", "es"],
      // There is no dynamic client registration (RFC 7591): a requesting client is registered by an
      // operator, so the absence of registration_endpoint is deliberate rather than an omission.
    },
    { headers: { "Cache-Control": "public, max-age=300" } },
  )
}

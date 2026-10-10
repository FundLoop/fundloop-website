import { verifyIdJag } from "@/lib/cross-app/id-jag"
import { readClientCredentials } from "@/lib/oauth/client-auth"
import { crossAppConfig, cubidJwksCache } from "@/lib/cross-app/config"
import { oauthErrorResponse, oauthTokenResponse } from "@/lib/oauth/errors"
import { isScopeSubset, parseScopeParam, scopeString, type OAuthScope } from "@/lib/oauth/scopes"
import {
  authenticateClient,
  findRequestingClient,
  findUserForCubidSubject,
  issueAccessToken,
  noteSubjectSeen,
  recordAssertionJti,
} from "@/lib/oauth/store"

// POST /oauth/token — redeems a Cubid identity assertion grant (#266 stage 2).
//
// FundLoop is a resource app: consent lives at Cubid, and a requesting client arrives here with an
// ID-JAG it obtained there. This endpoint verifies the assertion and issues FundLoop's own
// short-lived access token. There is no authorization code, no PKCE and no refresh token: a client
// renews by redeeming a fresh assertion, so consent is re-checked at Cubid on every renewal.
//
// Contract: cubid-monorepo docs/engineering/oidc-cross-app-access.md, "Redemption".
export const dynamic = "force-dynamic"

const JWT_BEARER_GRANT = "urn:ietf:params:oauth:grant-type:jwt-bearer"

export async function POST(request: Request) {
  try {
    return await redeem(request)
  } catch (error) {
    // Next's generic 500 is not something an OAuth client can parse, and the reason belongs in the
    // log rather than in the response.
    console.error(`[oauth/token] redemption failed: ${error instanceof Error ? error.message : "unknown"}`)
    return oauthErrorResponse("server_error", "The assertion could not be redeemed. Please retry.")
  }
}

async function redeem(request: Request) {
  let form: URLSearchParams
  try {
    form = new URLSearchParams(await request.text())
  } catch {
    return oauthErrorResponse("invalid_request", "The request body must be application/x-www-form-urlencoded.")
  }

  if (form.get("grant_type") !== JWT_BEARER_GRANT) {
    return oauthErrorResponse("unsupported_grant_type", `The only supported grant type is ${JWT_BEARER_GRANT}.`)
  }

  const { clientId, clientSecret } = readClientCredentials(request, form)
  if (!clientId) return oauthErrorResponse("invalid_client", "Client authentication failed.")

  const client = await findRequestingClient(clientId)
  // An unknown client, a disabled one and a wrong secret answer identically, so this endpoint
  // cannot be used to enumerate which clients exist.
  if (!client || !authenticateClient(client, clientSecret)) {
    return oauthErrorResponse("invalid_client", "Client authentication failed.")
  }

  const assertion = form.get("assertion")
  if (!assertion) return oauthErrorResponse("invalid_request", "assertion is required.")

  const config = crossAppConfig()
  // Unconfigured means there is no issuer to verify against, so there is nothing safe to do.
  if (!config) return oauthErrorResponse("temporarily_unavailable", "Cross-app access is not configured on this deployment.")

  const jwks = await cubidJwksCache(config).get()
  if (!jwks) return oauthErrorResponse("temporarily_unavailable", "The issuer's signing keys are unavailable.")

  let verified = await verifyIdJag(assertion, {
    jwks,
    issuer: config.issuer,
    audience: config.audience,
    acceptedClientIds: [client.cubid_client_id],
  })

  // An unknown key is the one denial worth retrying: it is what a key rotation looks like. The
  // cache's own floor stops this from becoming a request amplifier.
  if (!verified.ok && verified.reason === "unknown_key") {
    const refreshed = await cubidJwksCache(config).refresh()
    if (refreshed.outcome === "refreshed") {
      verified = await verifyIdJag(assertion, {
        jwks: refreshed.keys,
        issuer: config.issuer,
        audience: config.audience,
        acceptedClientIds: [client.cubid_client_id],
      })
    } else if (!verified.ok) {
      // Throttled by the refresh floor, or the issuer did not answer. We do not know whether this
      // key exists, and `invalid_grant` would tell the client its assertion is bad on the strength
      // of a check we could not make. A retryable answer is the honest one.
      return oauthErrorResponse("temporarily_unavailable", "The issuer's signing keys could not be checked. Please retry.")
    }
  }

  if (!verified.ok) {
    // The reason is logged, never returned: which check failed is information an attacker can use
    // to shape the next attempt.
    console.warn(`[oauth/token] assertion denied for ${client.client_id}: ${verified.reason}`)
    return oauthErrorResponse("invalid_grant", "The assertion is not valid for this deployment.")
  }

  const { claims } = verified

  // Scope comes from the assertion and nowhere else.
  //
  // An absent `scope` claim means none was requested, or the Cubid pairing allows none — it never
  // means "all of them". Reading it as this client's registered list would hand out scopes beyond
  // the pairing's own limit, because that list is a separate ceiling an operator keeps here, not
  // the person's consent. So an assertion without a scope is refused.
  if (!claims.scope) {
    return oauthErrorResponse("invalid_scope", "The assertion carries no scope, so there is nothing to grant. Request the scopes you need when exchanging at Cubid.")
  }
  const fromAssertion = parseScopeParam(claims.scope)
  if (!fromAssertion.ok) return oauthErrorResponse("invalid_scope", "The assertion names a scope this app does not offer.")
  // The registered list is still a ceiling: an operator here can withdraw a scope without waiting
  // for the pairing to change.
  if (!isScopeSubset(fromAssertion.scopes, client.allowed_scopes)) {
    return oauthErrorResponse("invalid_scope", "The assertion names a scope this client is not registered for.")
  }
  // What this assertion carried. Under the contract this is what the client requested for this
  // exchange, bounded by the pairing's own limit — not the person's standing consent, so a smaller
  // value here must never be read as consent narrowing.
  const assertionScopes: OAuthScope[] = fromAssertion.scopes

  // A client may ask for less again at the token endpoint, which narrows this token only.
  let granted: OAuthScope[] = assertionScopes
  const requested = form.get("scope")
  if (requested) {
    const parsed = parseScopeParam(requested)
    if (!parsed.ok) return oauthErrorResponse("invalid_scope", "The requested scope is not one this app offers.")
    if (!isScopeSubset(parsed.scopes, assertionScopes)) {
      return oauthErrorResponse("invalid_scope", "The requested scope is wider than the assertion allows.")
    }
    granted = parsed.scopes
  }

  // Recorded before the token is issued, so a replay cannot win a race against its own first use.
  const replay = await recordAssertionJti({
    jti: claims.jti,
    issuer: claims.iss,
    clientId: client.client_id,
    subject: claims.sub,
    expiresAt: new Date(claims.exp * 1000).toISOString(),
  })
  if (!replay.ok) return oauthErrorResponse("invalid_grant", "This assertion has already been redeemed.")

  // The pairwise subject is all we get. Without a mapping there is no FundLoop user to act for, and
  // inventing one from an assertion is not something this endpoint may do.
  const userId = await findUserForCubidSubject(claims.iss, claims.sub)
  if (!userId) {
    console.warn(`[oauth/token] no FundLoop account is linked to the subject presented by ${client.client_id}`)
    return oauthErrorResponse("invalid_grant", "No FundLoop account is linked to that Cubid identity. The person needs to sign in with Cubid or link their account first.")
  }

  const issued = await issueAccessToken({
    clientId: client.client_id,
    userId,
    assertionScopes,
    scopes: granted,
    assertionJti: claims.jti,
    assertionIssuedAt: new Date(claims.iat * 1000),
    issuer: claims.iss,
    subject: claims.sub,
  })
  if (!issued.ok) {
    // Either the assertion predates a withdrawal, so it is not evidence that consent is live, or
    // the person has disconnected Cubid from their FundLoop account and there is no longer an
    // identity here to issue against. Both answer the same way: the client's route back is a new
    // authorization at Cubid, and which of the two it was is not its business.
    return oauthErrorResponse("invalid_grant", "Consent for this application was withdrawn. A new authorization is required.")
  }

  // Bookkeeping must never cost a credential: the token is issued and the assertion is spent, so a
  // failure here is logged and the client still gets what it earned.
  try {
    await noteSubjectSeen(claims.iss, claims.sub)
  } catch (error) {
    console.warn(`[oauth/token] could not record the subject's last use: ${error instanceof Error ? error.message : "unknown"}`)
  }

  return oauthTokenResponse({
    access_token: issued.accessToken,
    token_type: "Bearer",
    expires_in: issued.expiresIn,
    scope: scopeString(granted),
  })
}

export async function GET() {
  return oauthErrorResponse("invalid_request", "The token endpoint accepts POST only.", { status: 405, headers: { Allow: "POST" } })
}

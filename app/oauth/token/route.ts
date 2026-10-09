import { verifyCodeChallenge } from "@/lib/oauth/crypto"
import { oauthErrorResponse, oauthTokenResponse } from "@/lib/oauth/errors"
import { scopeString } from "@/lib/oauth/scopes"
import {
  authenticateConfidentialClient,
  consumeAuthorizationCode,
  findEnabledClient,
  findRefreshToken,
  issueTokenPair,
  linkRotation,
  readGrant,
  revokeGrantFamily,
  rotateRefreshToken,
} from "@/lib/oauth/store"

// POST /oauth/token — RFC 6749 §4.1.3 (authorization_code) and §6 (refresh_token), OAuth 2.1 rules
// (#266 stage 2). Form-encoded in, JSON out, never cached.
export const dynamic = "force-dynamic"

type ClientCredentials = { clientId: string | null; clientSecret: string | null }

// RFC 6749 §2.3.1: a confidential client may authenticate with Basic or in the body. A public
// client sends only client_id.
function readClientCredentials(request: Request, form: URLSearchParams): ClientCredentials {
  const header = request.headers.get("authorization")
  if (header?.toLowerCase().startsWith("basic ")) {
    try {
      const decoded = Buffer.from(header.slice(6).trim(), "base64").toString("utf8")
      const separator = decoded.indexOf(":")
      if (separator > 0) {
        return {
          clientId: decodeURIComponent(decoded.slice(0, separator)),
          clientSecret: decodeURIComponent(decoded.slice(separator + 1)),
        }
      }
    } catch {
      return { clientId: null, clientSecret: null }
    }
  }
  return { clientId: form.get("client_id"), clientSecret: form.get("client_secret") }
}

export async function POST(request: Request) {
  let form: URLSearchParams
  try {
    form = new URLSearchParams(await request.text())
  } catch {
    return oauthErrorResponse("invalid_request", "The request body must be application/x-www-form-urlencoded.")
  }

  const { clientId, clientSecret } = readClientCredentials(request, form)
  if (!clientId) return oauthErrorResponse("invalid_client", "Client authentication failed.")

  const client = await findEnabledClient(clientId)
  // An unknown client and a wrong secret answer identically, so this endpoint cannot be used to
  // enumerate which client ids exist.
  if (!client || !(await authenticateConfidentialClient(client, clientSecret))) {
    return oauthErrorResponse("invalid_client", "Client authentication failed.")
  }

  const grantType = form.get("grant_type")
  if (grantType === "authorization_code") return exchangeAuthorizationCode(form, client.client_id)
  if (grantType === "refresh_token") return exchangeRefreshToken(form, client.client_id)
  return oauthErrorResponse("unsupported_grant_type", "Supported grant types are authorization_code and refresh_token.")
}

async function exchangeAuthorizationCode(form: URLSearchParams, clientId: string) {
  const code = form.get("code")
  const redirectUri = form.get("redirect_uri")
  const codeVerifier = form.get("code_verifier")
  if (!code || !redirectUri || !codeVerifier) {
    return oauthErrorResponse("invalid_request", "code, redirect_uri and code_verifier are required.")
  }

  // Consuming first means a replayed code is already spent by the time any other check runs.
  const record = await consumeAuthorizationCode(code)
  if (!record) return oauthErrorResponse("invalid_grant", "The authorization code is invalid, expired or already used.")

  // §4.1.3: the code is bound to the client and the redirect URI it was issued for. A mismatch here
  // is a sign the code was obtained by someone else, so the grant is not salvaged.
  if (record.client_id !== clientId || record.redirect_uri !== redirectUri) {
    await revokeGrantFamily(record.grant_id, "reuse")
    return oauthErrorResponse("invalid_grant", "The authorization code was not issued for this client and redirect URI.")
  }

  if (!verifyCodeChallenge(codeVerifier, record.code_challenge, record.code_challenge_method)) {
    return oauthErrorResponse("invalid_grant", "The code verifier does not match the challenge.")
  }

  const grant = await readGrant(record.grant_id)
  if (!grant || grant.revoked_at) return oauthErrorResponse("invalid_grant", "The grant has been revoked.")

  const issued = await issueTokenPair({
    grantId: record.grant_id,
    clientId,
    userId: record.user_id,
    scopes: record.scopes,
    fromCodeId: record.id,
  })
  return oauthTokenResponse({
    access_token: issued.accessToken,
    token_type: "Bearer",
    expires_in: issued.expiresIn,
    refresh_token: issued.refreshToken,
    scope: scopeString(record.scopes),
  })
}

async function exchangeRefreshToken(form: URLSearchParams, clientId: string) {
  const presented = form.get("refresh_token")
  if (!presented) return oauthErrorResponse("invalid_request", "refresh_token is required.")

  const record = await findRefreshToken(presented)
  if (!record || record.client_id !== clientId) {
    return oauthErrorResponse("invalid_grant", "The refresh token is invalid or expired.")
  }

  // A rotated token presented again means two parties hold it, so the whole grant goes (RFC 9700).
  if (record.rotated_to_id !== null) {
    await revokeGrantFamily(record.grant_id, "reuse")
    return oauthErrorResponse("invalid_grant", "The refresh token has already been used. The grant has been revoked.")
  }
  if (record.revoked_at) return oauthErrorResponse("invalid_grant", "The refresh token has been revoked.")

  const grant = await readGrant(record.grant_id)
  if (!grant || grant.revoked_at) return oauthErrorResponse("invalid_grant", "The grant has been revoked.")

  // Claim the old token before issuing a new one: if two refreshes race, only one proceeds.
  const rotation = await rotateRefreshToken(record)
  if (!rotation.ok) return oauthErrorResponse("invalid_grant", "The refresh token has already been used.")

  // The scopes come from the stored grant, never from the request: a refresh cannot widen access.
  const issued = await issueTokenPair({
    grantId: record.grant_id,
    clientId,
    userId: record.user_id,
    scopes: grant.scopes,
  })
  await linkRotation(record.id, issued.refreshToken)
  return oauthTokenResponse({
    access_token: issued.accessToken,
    token_type: "Bearer",
    expires_in: issued.expiresIn,
    refresh_token: issued.refreshToken,
    scope: scopeString(grant.scopes),
  })
}

export async function GET() {
  return oauthErrorResponse("invalid_request", "The token endpoint accepts POST only.", { status: 405, headers: { Allow: "POST" } })
}

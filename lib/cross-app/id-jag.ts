// Verification of a Cubid identity assertion grant (ID-JAG), for a resource app redeeming one.
//
// Framework-free on purpose: Web Crypto, TextEncoder and an injected fetch only, so this file runs
// unchanged on Node, Deno and an edge runtime, and can be lifted into a shared kit for the other
// sibling apps. Nothing here reads configuration, touches a database or imports a framework.
//
// The signature and header rules live in `jws.ts`, shared with the Security Event Token receiver.
// What is left here is the claim contract that makes an assertion an assertion.
//
// Contract: cubid-monorepo docs/engineering/oidc-cross-app-access.md, "The assertion".
//
// Every check fails closed and returns a reason rather than throwing, so the caller can audit the
// denial and answer in the OAuth error vocabulary without a try/catch around the happy path.

import { asNumber, asString, audienceMatches, verifyCompactJws, type JsonWebKeySet, type JwsDenial } from "./jws"

export type { JsonWebKey, JsonWebKeySet } from "./jws"

export type IdJagClaims = {
  iss: string
  sub: string
  aud: string
  client_id: string
  jti: string
  iat: number
  exp: number
  scope?: string
  auth_time?: number
  acr?: string
  amr?: string[]
}

export type IdJagDenial =
  | JwsDenial
  | "wrong_issuer"
  | "wrong_audience"
  | "untrusted_client"
  | "expired"
  | "not_yet_valid"
  | "missing_claim"
  | "lifetime_too_long"
  | "malformed_scope"

export type IdJagResult =
  | { ok: true; claims: IdJagClaims; keyId: string }
  | { ok: false; reason: IdJagDenial; detail?: string }

export type VerifyIdJagOptions = {
  jwks: JsonWebKeySet
  /** The Cubid issuer URL, compared exactly. */
  issuer: string
  /** This resource app's configured audience, compared exactly. */
  audience: string
  /** The Cubid client ids of requesting clients this app accepts. */
  acceptedClientIds: readonly string[]
  now?: Date
  /** Tolerance for clock drift between Cubid and here. Deliberately small. */
  clockSkewSeconds?: number
  /** An assertion may not claim a longer life than the contract allows. */
  maxLifetimeSeconds?: number
}

// RFC 7519 §4.1 leaves `typ` optional, but the contract uses it to keep an ID-JAG and an ID token
// from being interchangeable, so it is required here.
const ID_JAG_TYP = "oauth-id-jag+jwt"
const DEFAULT_CLOCK_SKEW_SECONDS = 30
// The contract gives assertions a five-minute lifetime. Accepting more would widen the window in
// which an assertion minted before a withdrawal is still replayable.
const DEFAULT_MAX_LIFETIME_SECONDS = 300

export async function verifyIdJag(assertion: string, options: VerifyIdJagOptions): Promise<IdJagResult> {
  const verified = await verifyCompactJws(assertion, { jwks: options.jwks, typ: ID_JAG_TYP })
  if (!verified.ok) return verified
  const { payload, keyId } = verified

  const iss = asString(payload.iss)
  const sub = asString(payload.sub)
  const clientId = asString(payload.client_id)
  const jti = asString(payload.jti)
  const iat = asNumber(payload.iat)
  const exp = asNumber(payload.exp)
  if (!iss || !sub || !clientId || !jti || iat === null || exp === null) {
    return { ok: false, reason: "missing_claim", detail: "iss, sub, aud, client_id, jti, iat and exp are all required" }
  }

  if (iss !== options.issuer) return { ok: false, reason: "wrong_issuer", detail: iss }
  if (!audienceMatches(payload.aud, options.audience)) return { ok: false, reason: "wrong_audience" }
  if (!options.acceptedClientIds.includes(clientId)) return { ok: false, reason: "untrusted_client", detail: clientId }

  const nowSeconds = Math.floor((options.now ?? new Date()).getTime() / 1000)
  const skew = options.clockSkewSeconds ?? DEFAULT_CLOCK_SKEW_SECONDS
  if (exp + skew <= nowSeconds) return { ok: false, reason: "expired" }
  if (iat - skew > nowSeconds) return { ok: false, reason: "not_yet_valid" }
  // A long-lived assertion is outside the contract even if correctly signed, and accepting one would
  // widen the window in which a stolen assertion is replayable.
  if (exp - iat > (options.maxLifetimeSeconds ?? DEFAULT_MAX_LIFETIME_SECONDS)) {
    return { ok: false, reason: "lifetime_too_long", detail: String(exp - iat) }
  }

  // A `scope` that is present but not a string must not be read as absent: absent means "none was
  // requested or allowed", and silently treating a malformed claim the same way would let a
  // hostile or buggy issuer payload pick the caller's default instead of being refused.
  if (payload.scope !== undefined && asString(payload.scope) === null) {
    return { ok: false, reason: "malformed_scope" }
  }

  return {
    ok: true,
    keyId,
    claims: {
      iss,
      sub,
      aud: options.audience,
      client_id: clientId,
      jti,
      iat,
      exp,
      scope: asString(payload.scope) ?? undefined,
      auth_time: asNumber(payload.auth_time) ?? undefined,
      acr: asString(payload.acr) ?? undefined,
      amr: Array.isArray(payload.amr) ? payload.amr.filter((entry): entry is string => typeof entry === "string") : undefined,
    },
  }
}

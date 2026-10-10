// Verification of a Cubid ID token, for an app signing a person in with Cubid.
//
// Framework-free on purpose, like the rest of `lib/cross-app/`: Web Crypto, TextEncoder and an
// injected fetch only. The signature and header rules live in `jws.ts`, shared with the identity
// assertion verifier and the Security Event Token verifier; what is here is the claim contract that
// makes an ID token an ID token.
//
// Contract: cubid-monorepo docs/engineering/login-with-cubid-oidc-architecture.md, "Token claim
// envelopes" and "Audience Separation".
//
// Every check fails closed and returns a reason rather than throwing, so the caller can log the
// denial and show the person one message without a try/catch around the happy path.

import { asNumber, asString, audienceMatches, verifyCompactJws, type JsonWebKeySet, type JwsDenial } from "./jws"

// OpenID Connect Core §3.1.3.7 does not require a `typ` on an ID token, and RFC 7519 §5.1 registers
// `JWT` for a plain one, so all three spellings are accepted — `undefined` meaning no header at all.
// The artefacts that *do* carry a distinguishing `typ` still cannot pass as one of these: an
// `oauth-id-jag+jwt` or a `secevent+jwt` matches none of them.
const ID_TOKEN_TYPS = ["JWT", "jwt", undefined] as const

const DEFAULT_CLOCK_SKEW_SECONDS = 30
// The contract gives ID tokens a 15-minute lifetime. One claiming longer is outside it.
const DEFAULT_MAX_LIFETIME_SECONDS = 15 * 60

export type IdTokenClaims = {
  iss: string
  sub: string
  aud: string
  iat: number
  exp: number
  nonce?: string
  /** Only when Cubid has verified it and the person consented to releasing it. */
  email?: string
  name?: string
  picture?: string
  auth_time?: number
  acr?: string
  amr?: string[]
}

export type IdTokenDenial =
  | JwsDenial
  | "wrong_issuer"
  | "wrong_audience"
  | "wrong_authorized_party"
  | "missing_claim"
  | "expired"
  | "not_yet_valid"
  | "lifetime_too_long"
  | "nonce_mismatch"
  | "malformed_email"

export type IdTokenResult =
  | { ok: true; claims: IdTokenClaims; keyId: string }
  | { ok: false; reason: IdTokenDenial; detail?: string }

export type VerifyIdTokenOptions = {
  jwks: JsonWebKeySet
  issuer: string
  /** This app's client id at Cubid. */
  audience: string
  /** The nonce this app put in the authorization request. Required: its absence is a replay hole. */
  nonce: string
  now?: Date
  clockSkewSeconds?: number
  maxLifetimeSeconds?: number
}

export async function verifyIdToken(idToken: string, options: VerifyIdTokenOptions): Promise<IdTokenResult> {
  const verified = await verifyCompactJws(idToken, { jwks: options.jwks, typ: ID_TOKEN_TYPS })
  if (!verified.ok) return verified
  const { payload, keyId } = verified

  const iss = asString(payload.iss)
  const sub = asString(payload.sub)
  const iat = asNumber(payload.iat)
  const exp = asNumber(payload.exp)
  if (!iss || !sub || iat === null || exp === null) {
    return { ok: false, reason: "missing_claim", detail: "iss, sub, aud, iat and exp are all required" }
  }

  if (iss !== options.issuer) return { ok: false, reason: "wrong_issuer", detail: iss }
  if (!audienceMatches(payload.aud, options.audience)) return { ok: false, reason: "wrong_audience" }
  // OpenID Connect Core §3.1.3.7: when `azp` is present it must be this client. An ID token minted
  // for another client and relayed here must not sign anybody in.
  const azp = asString(payload.azp)
  if (azp !== null && azp !== options.audience) return { ok: false, reason: "wrong_authorized_party", detail: azp }

  const nowSeconds = Math.floor((options.now ?? new Date()).getTime() / 1000)
  const skew = options.clockSkewSeconds ?? DEFAULT_CLOCK_SKEW_SECONDS
  if (exp + skew <= nowSeconds) return { ok: false, reason: "expired" }
  if (iat - skew > nowSeconds) return { ok: false, reason: "not_yet_valid" }
  if (exp - iat > (options.maxLifetimeSeconds ?? DEFAULT_MAX_LIFETIME_SECONDS)) {
    return { ok: false, reason: "lifetime_too_long", detail: String(exp - iat) }
  }

  // The nonce binds this token to the authorization request this browser started. Without the
  // comparison, a token obtained elsewhere could be injected into somebody else's callback.
  if (asString(payload.nonce) !== options.nonce) return { ok: false, reason: "nonce_mismatch" }

  // An `email` that is present but not a string must not read as absent: absent means Cubid has
  // none to release or the person did not consent, and that distinction decides whether sign-in can
  // continue at all.
  if (payload.email !== undefined && asString(payload.email) === null) {
    return { ok: false, reason: "malformed_email" }
  }

  return {
    ok: true,
    keyId,
    claims: {
      iss,
      sub,
      aud: options.audience,
      iat,
      exp,
      nonce: asString(payload.nonce) ?? undefined,
      email: asString(payload.email) ?? undefined,
      name: asString(payload.name) ?? undefined,
      picture: asString(payload.picture) ?? undefined,
      auth_time: asNumber(payload.auth_time) ?? undefined,
      acr: asString(payload.acr) ?? undefined,
      amr: Array.isArray(payload.amr) ? payload.amr.filter((entry): entry is string => typeof entry === "string") : undefined,
    },
  }
}

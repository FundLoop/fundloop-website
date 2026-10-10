// Verification of a Cubid identity assertion grant (ID-JAG), for a resource app redeeming one.
//
// Framework-free on purpose: Web Crypto, TextEncoder and an injected fetch only, so this file runs
// unchanged on Node, Deno and an edge runtime, and can be lifted into a shared kit for the other
// sibling apps. Nothing here reads configuration, touches a database or imports a framework.
//
// Contract: cubid-monorepo docs/engineering/oidc-cross-app-access.md, "The assertion".
//
// Every check fails closed and returns a reason rather than throwing, so the caller can audit the
// denial and answer in the OAuth error vocabulary without a try/catch around the happy path.

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

export type JsonWebKey = { kty: string; kid?: string; alg?: string; use?: string; n?: string; e?: string }
export type JsonWebKeySet = { keys: JsonWebKey[] }

export type IdJagDenial =
  | "malformed"
  | "wrong_type"
  | "unsupported_algorithm"
  | "unknown_key"
  | "bad_signature"
  | "wrong_issuer"
  | "wrong_audience"
  | "untrusted_client"
  | "expired"
  | "not_yet_valid"
  | "missing_claim"
  | "lifetime_too_long"
  | "malformed_scope"
  | "unsupported_critical_header"

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

function base64UrlToBytes(value: string): Uint8Array | null {
  if (!/^[A-Za-z0-9_-]*$/.test(value)) return null
  const padded = value.replace(/-/g, "+").replace(/_/g, "/") + "=".repeat((4 - (value.length % 4)) % 4)
  try {
    const binary = atob(padded)
    const bytes = new Uint8Array(binary.length)
    for (let index = 0; index < binary.length; index += 1) bytes[index] = binary.charCodeAt(index)
    return bytes
  } catch {
    return null
  }
}

function decodeJson(segment: string): Record<string, unknown> | null {
  const bytes = base64UrlToBytes(segment)
  if (!bytes) return null
  try {
    const parsed: unknown = JSON.parse(new TextDecoder().decode(bytes))
    return parsed && typeof parsed === "object" && !Array.isArray(parsed) ? (parsed as Record<string, unknown>) : null
  } catch {
    return null
  }
}

function asString(value: unknown): string | null {
  return typeof value === "string" && value.length > 0 ? value : null
}

function asNumber(value: unknown): number | null {
  return typeof value === "number" && Number.isFinite(value) ? value : null
}

// `aud` may be a string or an array of strings (RFC 7519 §4.1.3).
function audienceMatches(value: unknown, expected: string): boolean {
  if (typeof value === "string") return value === expected
  if (Array.isArray(value)) return value.some((entry) => entry === expected)
  return false
}

export async function verifyIdJag(assertion: string, options: VerifyIdJagOptions): Promise<IdJagResult> {
  const parts = assertion.split(".")
  if (parts.length !== 3) return { ok: false, reason: "malformed", detail: "expected three segments" }

  const [headerSegment, payloadSegment, signatureSegment] = parts
  const header = decodeJson(headerSegment)
  const payload = decodeJson(payloadSegment)
  const signature = base64UrlToBytes(signatureSegment)
  if (!header || !payload || !signature) return { ok: false, reason: "malformed", detail: "segment is not base64url JSON" }

  // An ID token must never be accepted here, and an ID-JAG must never pass as one.
  if (header.typ !== ID_JAG_TYP) return { ok: false, reason: "wrong_type", detail: String(header.typ ?? "absent") }
  if (header.alg !== "RS256") return { ok: false, reason: "unsupported_algorithm", detail: String(header.alg ?? "absent") }
  // RFC 7515 §4.1.11: a `crit` header names extensions the verifier must understand. We understand
  // none, so any `crit` at all is a refusal rather than something to ignore.
  if (header.crit !== undefined) return { ok: false, reason: "unsupported_critical_header" }

  const keyId = asString(header.kid)
  if (!keyId) return { ok: false, reason: "unknown_key", detail: "no kid" }
  const key = options.jwks.keys.find((candidate) => candidate.kid === keyId)
  // Only a key the issuer currently publishes is acceptable; an embedded key would let the
  // assertion vouch for itself. A key published for encryption, or for another algorithm, is not a
  // key for verifying this signature.
  if (!key || key.kty !== "RSA") return { ok: false, reason: "unknown_key", detail: keyId }
  if (key.use !== undefined && key.use !== "sig") return { ok: false, reason: "unknown_key", detail: "key is not for signing" }
  if (key.alg !== undefined && key.alg !== "RS256") return { ok: false, reason: "unknown_key", detail: "key is not RS256" }

  let publicKey: CryptoKey
  try {
    publicKey = await crypto.subtle.importKey(
      "jwk",
      { kty: key.kty, n: key.n, e: key.e, alg: "RS256", ext: true },
      { name: "RSASSA-PKCS1-v1_5", hash: "SHA-256" },
      false,
      ["verify"],
    )
  } catch {
    return { ok: false, reason: "unknown_key", detail: "key is not importable" }
  }

  const signed = new TextEncoder().encode(`${headerSegment}.${payloadSegment}`)
  const signatureBuffer = new Uint8Array(signature).buffer as ArrayBuffer
  const signatureValid = await crypto.subtle.verify({ name: "RSASSA-PKCS1-v1_5" }, publicKey, signatureBuffer, signed)
  // The signature is checked before any claim is trusted, so a claim can never steer verification.
  if (!signatureValid) return { ok: false, reason: "bad_signature" }

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

// A JWKS cache with a floor between refreshes, so an assertion naming an unknown kid cannot be used
// to drive unbounded requests at the issuer, and key rotation is still picked up without a deploy.
export type JwksCache = { get: (options?: { force?: boolean }) => Promise<JsonWebKeySet | null> }

export function createJwksCache(config: {
  jwksUri: string
  fetchImpl?: typeof fetch
  ttlSeconds?: number
  minRefreshSeconds?: number
  /** How long a cached set may still be served once refreshes are failing. */
  maxStaleSeconds?: number
  timeoutMs?: number
  now?: () => number
}): JwksCache {
  const ttl = (config.ttlSeconds ?? 600) * 1000
  const minRefresh = (config.minRefreshSeconds ?? 60) * 1000
  // A removed key must stop being trusted even while the endpoint is failing, so staleness is
  // bounded rather than indefinite: after this, no key is served and verification fails closed.
  const maxStale = (config.maxStaleSeconds ?? 3600) * 1000
  const timeoutMs = config.timeoutMs ?? 5000
  const clock = config.now ?? (() => Date.now())
  let cached: JsonWebKeySet | null = null
  let fetchedAt = 0
  let inFlight: Promise<JsonWebKeySet | null> | null = null

  async function load(): Promise<JsonWebKeySet | null> {
    const doFetch = config.fetchImpl ?? fetch
    try {
      const response = await doFetch(config.jwksUri, {
        headers: { Accept: "application/json" },
        // Without a deadline, undici's default 300s timeouts apply and every caller waiting on this
        // one in-flight promise hangs with it.
        signal: AbortSignal.timeout(timeoutMs),
        // The issuer's keys come from the issuer. A redirect would let whoever controls it move the
        // key set somewhere else.
        redirect: "manual",
      })
      if (!response.ok) return null
      const body: unknown = await response.json()
      const keys = (body as JsonWebKeySet | null)?.keys
      if (!Array.isArray(keys)) return null
      // An empty set is a valid answer, not a failure: if the issuer has published no keys, nothing
      // should verify, and the previous keys must not be kept alive by treating it as an outage.
      cached = { keys }
      fetchedAt = clock()
      return cached
    } catch {
      return null
    }
  }

  function servableCache(options?: { force?: boolean }) {
    if (!cached) return null
    const age = clock() - fetchedAt
    if (age >= maxStale) return null
    if (options?.force) return age < minRefresh ? cached : null
    return age < ttl ? cached : null
  }

  return {
    async get(options) {
      const fresh = servableCache(options)
      if (fresh) return fresh
      if (!inFlight) {
        inFlight = load().finally(() => {
          inFlight = null
        })
      }
      const loaded = await inFlight
      if (loaded) return loaded
      // A failed refresh may serve the previous set only while it is inside the staleness bound.
      return cached && clock() - fetchedAt < maxStale ? cached : null
    },
  }
}

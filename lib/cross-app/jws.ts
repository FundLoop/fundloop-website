// Compact JWS verification and a JWKS cache, shared by every Cubid artefact FundLoop verifies.
//
// Framework-free on purpose: Web Crypto, TextEncoder and an injected fetch only, so this file runs
// unchanged on Node, Deno and an edge runtime, and can be lifted into a shared kit for the other
// sibling apps. Nothing here reads configuration, touches a database or imports a framework.
//
// This is the half of verification that is identical for an identity assertion (`id-jag.ts`) and a
// Security Event Token (`secevent.ts`): both are RS256 compact JWS signed by the same Cubid key,
// distinguished by their `typ`. The two differ only in which claims they then require, so the
// signature rules live here once rather than in two copies that could drift apart.

/** A JSON value, as `JSON.parse` can produce. Declared here so the verified claims of a token stay
 *  typed as what they are — data decoded from JSON — without importing a framework's JSON type. */
export type JsonValue = string | number | boolean | null | JsonValue[] | { [key: string]: JsonValue }
export type JsonObject = { [key: string]: JsonValue }

export type JsonWebKey = { kty: string; kid?: string; alg?: string; use?: string; n?: string; e?: string }
export type JsonWebKeySet = { keys: JsonWebKey[] }

export type JwsDenial =
  | "malformed"
  | "wrong_type"
  | "unsupported_algorithm"
  | "unknown_key"
  | "bad_signature"
  | "unsupported_critical_header"

export type VerifiedJws = {
  header: JsonObject
  payload: JsonObject
  keyId: string
}

export type JwsResult = { ok: true } & VerifiedJws | { ok: false; reason: JwsDenial; detail?: string }

export function base64UrlToBytes(value: string): Uint8Array | null {
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

export function decodeJsonSegment(segment: string): JsonObject | null {
  const bytes = base64UrlToBytes(segment)
  if (!bytes) return null
  try {
    const parsed: unknown = JSON.parse(new TextDecoder().decode(bytes))
    return parsed && typeof parsed === "object" && !Array.isArray(parsed) ? (parsed as JsonObject) : null
  } catch {
    return null
  }
}

export function asString(value: unknown): string | null {
  return typeof value === "string" && value.length > 0 ? value : null
}

export function asNumber(value: unknown): number | null {
  return typeof value === "number" && Number.isFinite(value) ? value : null
}

// `aud` may be a string or an array of strings (RFC 7519 §4.1.3).
export function audienceMatches(value: unknown, expected: string): boolean {
  if (typeof value === "string") return value === expected
  if (Array.isArray(value)) return value.some((entry) => entry === expected)
  return false
}

// Verifies the signature and the header, and nothing else: no claim is examined here, because which
// claims matter depends on what the token is. The caller supplies the `typ` it will accept.
export async function verifyCompactJws(token: string, options: { jwks: JsonWebKeySet; typ: string }): Promise<JwsResult> {
  const parts = token.split(".")
  if (parts.length !== 3) return { ok: false, reason: "malformed", detail: "expected three segments" }

  const [headerSegment, payloadSegment, signatureSegment] = parts
  const header = decodeJsonSegment(headerSegment)
  const payload = decodeJsonSegment(payloadSegment)
  const signature = base64UrlToBytes(signatureSegment)
  if (!header || !payload || !signature) return { ok: false, reason: "malformed", detail: "segment is not base64url JSON" }

  // `typ` is what keeps Cubid's artefacts from being interchangeable: an ID token must never be
  // accepted as an assertion, and an assertion must never be accepted as an event.
  if (header.typ !== options.typ) return { ok: false, reason: "wrong_type", detail: String(header.typ ?? "absent") }
  if (header.alg !== "RS256") return { ok: false, reason: "unsupported_algorithm", detail: String(header.alg ?? "absent") }
  // RFC 7515 §4.1.11: a `crit` header names extensions the verifier must understand. We understand
  // none, so any `crit` at all is a refusal rather than something to ignore.
  if (header.crit !== undefined) return { ok: false, reason: "unsupported_critical_header" }

  const keyId = asString(header.kid)
  if (!keyId) return { ok: false, reason: "unknown_key", detail: "no kid" }
  const key = options.jwks.keys.find((candidate) => candidate.kid === keyId)
  // Only a key the issuer currently publishes is acceptable; an embedded key would let the token
  // vouch for itself. A key published for encryption, or for another algorithm, is not a key for
  // verifying this signature.
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

  return { ok: true, header, payload, keyId }
}

// A JWKS cache with a floor between refreshes, so a token naming an unknown kid cannot be used to
// drive unbounded requests at the issuer, and key rotation is still picked up without a deploy.
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

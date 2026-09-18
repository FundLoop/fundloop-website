import { createPublicKey, verify, type KeyObject } from "node:crypto"
import { Buffer } from "node:buffer"
import {
  CUBID_ALLOCATOR_CLIENT_NAME,
  CUBID_ALLOCATOR_CONTRACT_VERSION,
  CUBID_ALLOCATOR_DEFAULT_ROUTE,
  buildSigningString,
  canonicalJsonStringify,
  validateCubidAllocatorRequestBody,
  type CubidAllocatorEnvironment,
  type CubidAllocatorRequestBody,
} from "./private-allocator-client.ts"

// Verifier for requests signed by PrivateCubidAllocatorClient (#217).
// Status mapping: 422 malformed request, 403 caller or key not permitted,
// 401 authenticity or freshness failure (bad signature, clock skew, replayed nonce).

export const SIGNED_REQUEST_MAX_CLOCK_SKEW_MS = 5 * 60 * 1000

export type VerifierKey = {
  keyId: string
  publicKeyPem: string
  // Inclusive activation and exclusive retirement instants (ms since epoch). Omit for open-ended.
  notBeforeMs?: number
  notAfterMs?: number
  revoked?: boolean
}

export interface NonceStore {
  // Records the nonce and returns true if it was unseen; returns false for a replay.
  claim(keyId: string, nonce: string, nowMs: number): boolean
}

export class InMemoryNonceStore implements NonceStore {
  private readonly seen = new Map<string, number>()

  constructor(private readonly retentionMs = SIGNED_REQUEST_MAX_CLOCK_SKEW_MS * 2) {}

  claim(keyId: string, nonce: string, nowMs: number) {
    for (const [entry, expiresAt] of this.seen) if (expiresAt <= nowMs) this.seen.delete(entry)
    const entry = `${keyId}\n${nonce}`
    if (this.seen.has(entry)) return false
    this.seen.set(entry, nowMs + this.retentionMs)
    return true
  }

  get size() {
    return this.seen.size
  }
}

export type SignedRequestVerifierConfig = {
  environment: CubidAllocatorEnvironment
  keys: VerifierKey[]
  nonceStore: NonceStore
  route?: string
  maxClockSkewMs?: number
  now?: () => number
}

export type SignedRequestInput = {
  method: string
  route?: string
  headers: Record<string, string | undefined>
  rawBody: string
}

export type SignedRequestVerification =
  | { ok: true; keyId: string; requestId: string; idempotencyKey: string; body: CubidAllocatorRequestBody }
  | { ok: false; status: 401 | 403 | 422; code: string; error: string }

const REQUIRED_HEADERS = [
  "x-cubid-allocator-client",
  "x-cubid-allocator-environment",
  "x-cubid-allocator-key-id",
  "x-cubid-allocator-contract-version",
  "x-cubid-allocator-request-id",
  "x-cubid-allocator-timestamp",
  "x-cubid-allocator-nonce",
  "idempotency-key",
  "x-cubid-allocator-signature",
] as const

const ISO_TIMESTAMP = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/
const TOKEN = /^[A-Za-z0-9_-]{8,128}$/
const BASE64URL = /^[A-Za-z0-9_-]+$/

const fail = (status: 401 | 403 | 422, code: string, error: string): SignedRequestVerification => ({ ok: false, status, code, error })

export class SignedRequestVerifier {
  private readonly keys: Map<string, VerifierKey & { publicKey: KeyObject }>
  private readonly route: string
  private readonly maxClockSkewMs: number
  private readonly now: () => number

  constructor(private readonly config: SignedRequestVerifierConfig) {
    this.keys = new Map()
    for (const key of config.keys) {
      if (this.keys.has(key.keyId)) throw new Error(`Duplicate verifier key id: ${key.keyId}`)
      const publicKey = createPublicKey(key.publicKeyPem)
      if (publicKey.asymmetricKeyType !== "ed25519") throw new Error(`Verifier key ${key.keyId} is not Ed25519`)
      this.keys.set(key.keyId, { ...key, publicKey })
    }
    this.route = config.route ?? CUBID_ALLOCATOR_DEFAULT_ROUTE
    this.maxClockSkewMs = config.maxClockSkewMs ?? SIGNED_REQUEST_MAX_CLOCK_SKEW_MS
    this.now = config.now ?? Date.now
  }

  verify(request: SignedRequestInput): SignedRequestVerification {
    const headers = Object.fromEntries(Object.entries(request.headers).map(([name, value]) => [name.toLowerCase(), value]))
    for (const name of REQUIRED_HEADERS) {
      if (typeof headers[name] !== "string" || headers[name] === "") return fail(422, "header_missing", `Missing header: ${name}`)
    }
    const header = (name: (typeof REQUIRED_HEADERS)[number]) => headers[name] as string

    if (request.method.toUpperCase() !== "POST" || (request.route ?? this.route) !== this.route) {
      return fail(422, "route_invalid", "Signed requests must POST to the allocator route")
    }
    if (header("x-cubid-allocator-contract-version") !== CUBID_ALLOCATOR_CONTRACT_VERSION) {
      return fail(422, "contract_version_unsupported", `Contract version must be ${CUBID_ALLOCATOR_CONTRACT_VERSION}`)
    }
    const timestamp = header("x-cubid-allocator-timestamp")
    const timestampMs = Date.parse(timestamp)
    if (!ISO_TIMESTAMP.test(timestamp) || Number.isNaN(timestampMs)) return fail(422, "timestamp_invalid", "Timestamp must be ISO-8601 UTC with milliseconds")
    for (const name of ["x-cubid-allocator-request-id", "x-cubid-allocator-nonce", "idempotency-key"] as const) {
      if (!TOKEN.test(header(name))) return fail(422, "header_invalid", `Header ${name} is malformed`)
    }
    if (!BASE64URL.test(header("x-cubid-allocator-signature"))) return fail(422, "signature_malformed", "Signature must be base64url")

    if (header("x-cubid-allocator-client") !== CUBID_ALLOCATOR_CLIENT_NAME) return fail(403, "client_forbidden", "Unknown allocator client")
    if (header("x-cubid-allocator-environment") !== this.config.environment) return fail(403, "environment_mismatch", "Environment does not match verifier")

    const nowMs = this.now()
    const keyId = header("x-cubid-allocator-key-id")
    const key = this.keys.get(keyId)
    if (!key) return fail(403, "key_unknown", "Unknown signing key")
    if (key.revoked) return fail(403, "key_revoked", "Signing key is revoked")
    if (key.notBeforeMs != null && nowMs < key.notBeforeMs) return fail(403, "key_not_yet_active", "Signing key is not yet active")
    if (key.notAfterMs != null && nowMs >= key.notAfterMs) return fail(403, "key_retired", "Signing key is retired")

    if (Math.abs(nowMs - timestampMs) > this.maxClockSkewMs) {
      return fail(401, timestampMs > nowMs ? "timestamp_in_future" : "timestamp_expired", "Request timestamp is outside the allowed clock skew")
    }

    let parsed: unknown
    try {
      parsed = JSON.parse(request.rawBody)
    } catch {
      return fail(422, "body_invalid_json", "Body is not valid JSON")
    }
    if (canonicalJsonStringify(parsed) !== request.rawBody) return fail(422, "body_not_canonical", "Body must be canonical JSON")
    const body = validateCubidAllocatorRequestBody(parsed)
    if (!body.ok) return fail(422, "body_invalid", body.error)

    const signingString = buildSigningString({
      method: "POST",
      route: this.route,
      contractVersion: CUBID_ALLOCATOR_CONTRACT_VERSION,
      client: CUBID_ALLOCATOR_CLIENT_NAME,
      environment: this.config.environment,
      keyId,
      requestId: header("x-cubid-allocator-request-id"),
      timestamp,
      nonce: header("x-cubid-allocator-nonce"),
      canonicalBody: request.rawBody,
    })
    const signature = Buffer.from(header("x-cubid-allocator-signature"), "base64url")
    if (signature.length !== 64 || !verify(null, Buffer.from(signingString, "utf8"), key.publicKey, signature)) {
      return fail(401, "signature_invalid", "Signature verification failed")
    }

    // Nonces are claimed only after the signature verifies, so forged requests cannot burn them.
    if (!this.config.nonceStore.claim(keyId, header("x-cubid-allocator-nonce"), nowMs)) {
      return fail(401, "nonce_replayed", "Nonce has already been used")
    }

    return {
      ok: true,
      keyId,
      requestId: header("x-cubid-allocator-request-id"),
      idempotencyKey: header("idempotency-key"),
      body: body.data,
    }
  }
}

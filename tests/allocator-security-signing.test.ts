import { createHash, generateKeyPairSync } from "node:crypto"
import { describe, expect, test } from "vitest"
import {
  CUBID_ALLOCATOR_CLIENT_NAME,
  CUBID_ALLOCATOR_CONTRACT_VERSION,
  CUBID_ALLOCATOR_DEFAULT_ROUTE,
  PrivateCubidAllocatorClient,
  buildSignedHeaders,
  buildSigningString,
  canonicalJsonStringify,
  type CubidAllocatorKeyConfig,
  type CubidAllocatorRequestBody,
} from "@/lib/cubid/private-allocator-client"
import {
  InMemoryNonceStore,
  SIGNED_REQUEST_MAX_CLOCK_SKEW_MS,
  SignedRequestVerifier,
  type VerifierKey,
} from "@/lib/cubid/verify-signed-request"

const NOW = Date.parse("2026-09-18T12:00:00.000Z")
const MINUTE = 60_000

function keyPair(keyId: string) {
  const { privateKey, publicKey } = generateKeyPairSync("ed25519")
  return {
    signing: { keyId, privateKeyPem: privateKey.export({ type: "pkcs8", format: "pem" }) as string } satisfies CubidAllocatorKeyConfig,
    publicKeyPem: publicKey.export({ type: "spki", format: "pem" }) as string,
  }
}

const primary = keyPair("fl-key-primary")
const secondary = keyPair("fl-key-secondary")
const outsider = keyPair("fl-key-outsider")

const body: CubidAllocatorRequestBody = {
  contract_version: CUBID_ALLOCATOR_CONTRACT_VERSION,
  project_id: 42,
  items: [{ project_scoped_uuid: "3f0c2c1e-8a4b-4c2d-9e1f-0a1b2c3d4e5f" }],
}
const canonicalBody = canonicalJsonStringify(body)

function verifierAt(nowMs: number, keys: VerifierKey[] = [{ keyId: primary.signing.keyId, publicKeyPem: primary.publicKeyPem }], nonceStore = new InMemoryNonceStore()) {
  return new SignedRequestVerifier({ environment: "preview", keys, nonceStore, now: () => nowMs })
}

function signed(overrides: { keyConfig?: CubidAllocatorKeyConfig; timestampMs?: number; nonce?: string; rawBody?: string } = {}) {
  const rawBody = overrides.rawBody ?? canonicalBody
  const headers = buildSignedHeaders({
    environment: "preview",
    keyConfig: overrides.keyConfig ?? primary.signing,
    canonicalBody: rawBody,
    timestamp: new Date(overrides.timestampMs ?? NOW).toISOString(),
    nonce: overrides.nonce,
  })
  return { method: "POST", headers: { ...headers } as Record<string, string | undefined>, rawBody }
}

describe("canonical JSON and signing string", () => {
  test("canonical JSON sorts keys recursively, keeps array order, drops undefined", () => {
    expect(canonicalJsonStringify({ z: 1, a: { d: "x", b: [3, 1, 2], c: undefined }, m: null }))
      .toBe('{"a":{"b":[3,1,2],"d":"x"},"m":null,"z":1}')
    expect(canonicalBody).toBe('{"contract_version":"2026-08-14","items":[{"project_scoped_uuid":"3f0c2c1e-8a4b-4c2d-9e1f-0a1b2c3d4e5f"}],"project_id":42}')
  })

  test("signing string is exactly 10 newline-separated fields ending in the body SHA-256", () => {
    const signingString = buildSigningString({
      method: "post", route: CUBID_ALLOCATOR_DEFAULT_ROUTE, contractVersion: CUBID_ALLOCATOR_CONTRACT_VERSION,
      client: CUBID_ALLOCATOR_CLIENT_NAME, environment: "preview", keyId: "k1", requestId: "fl_req_1",
      timestamp: "2026-09-18T12:00:00.000Z", nonce: "fl_nonce_1", canonicalBody,
    })
    const lines = signingString.split("\n")
    expect(lines).toEqual([
      "POST", CUBID_ALLOCATOR_DEFAULT_ROUTE, "2026-08-14", "fundloop-allocator", "preview", "k1", "fl_req_1",
      "2026-09-18T12:00:00.000Z", "fl_nonce_1", createHash("sha256").update(canonicalBody, "utf8").digest("hex"),
    ])
  })
})

describe("signed request verification", () => {
  test("accepts a freshly signed canonical request", () => {
    const result = verifierAt(NOW).verify(signed())
    expect(result).toMatchObject({ ok: true, keyId: primary.signing.keyId, body })
  })

  test("accepts timestamps exactly at the 5-minute skew boundary", () => {
    expect(verifierAt(NOW).verify(signed({ timestampMs: NOW - SIGNED_REQUEST_MAX_CLOCK_SKEW_MS })).ok).toBe(true)
    expect(verifierAt(NOW).verify(signed({ timestampMs: NOW + SIGNED_REQUEST_MAX_CLOCK_SKEW_MS })).ok).toBe(true)
  })

  test.each([
    ["expired timestamp", { timestampMs: NOW - SIGNED_REQUEST_MAX_CLOCK_SKEW_MS - 1 }, 401, "timestamp_expired"],
    ["future timestamp", { timestampMs: NOW + SIGNED_REQUEST_MAX_CLOCK_SKEW_MS + 1 }, 401, "timestamp_in_future"],
    ["unknown key id", { keyConfig: outsider.signing }, 403, "key_unknown"],
    ["wrong key under a trusted key id", { keyConfig: { ...outsider.signing, keyId: primary.signing.keyId } }, 401, "signature_invalid"],
  ] as const)("rejects %s", (_name, overrides, status, code) => {
    expect(verifierAt(NOW).verify(signed(overrides))).toMatchObject({ ok: false, status, code })
  })

  test("rejects a replayed nonce but only after the first request succeeds", () => {
    const verifier = verifierAt(NOW)
    const request = signed({ nonce: "fl_nonce_replay_0001" })
    expect(verifier.verify(request).ok).toBe(true)
    expect(verifier.verify(request)).toMatchObject({ ok: false, status: 401, code: "nonce_replayed" })
    // A fresh signature over a new request id still cannot reuse the nonce.
    expect(verifier.verify(signed({ nonce: "fl_nonce_replay_0001" }))).toMatchObject({ status: 401, code: "nonce_replayed" })
  })

  test("forged requests do not burn nonces", () => {
    const verifier = verifierAt(NOW)
    const forged = signed({ nonce: "fl_nonce_forged_0001", keyConfig: { ...outsider.signing, keyId: primary.signing.keyId } })
    expect(verifier.verify(forged)).toMatchObject({ status: 401, code: "signature_invalid" })
    expect(verifier.verify(signed({ nonce: "fl_nonce_forged_0001" })).ok).toBe(true)
  })

  test("rejects tampered bodies and headers", () => {
    const tamperedBody = signed()
    tamperedBody.rawBody = canonicalJsonStringify({ ...body, project_id: 43 })
    expect(verifierAt(NOW).verify(tamperedBody)).toMatchObject({ status: 401, code: "signature_invalid" })

    for (const name of ["X-Cubid-Allocator-Request-Id", "X-Cubid-Allocator-Nonce", "X-Cubid-Allocator-Timestamp"]) {
      const request = signed()
      const value = request.headers[name] as string
      request.headers[name] = name.endsWith("Timestamp") ? new Date(NOW + 1).toISOString() : `${value.slice(0, -1)}0`
      if (request.headers[name] === value) request.headers[name] = `${value.slice(0, -1)}1`
      expect(verifierAt(NOW).verify(request), name).toMatchObject({ status: 401, code: "signature_invalid" })
    }

    const truncated = signed()
    truncated.headers["X-Cubid-Allocator-Signature"] = (truncated.headers["X-Cubid-Allocator-Signature"] as string).slice(0, 40)
    expect(verifierAt(NOW).verify(truncated)).toMatchObject({ status: 401, code: "signature_invalid" })
  })

  test("rejects malformed requests with 422", () => {
    const missing = signed()
    delete missing.headers["X-Cubid-Allocator-Nonce"]
    expect(verifierAt(NOW).verify(missing)).toMatchObject({ status: 422, code: "header_missing" })

    const pretty = JSON.stringify(body, null, 2)
    expect(verifierAt(NOW).verify(signed({ rawBody: pretty }))).toMatchObject({ status: 422, code: "body_not_canonical" })

    const schema = canonicalJsonStringify({ ...body, items: [] })
    expect(verifierAt(NOW).verify(signed({ rawBody: schema }))).toMatchObject({ status: 422, code: "body_invalid" })

    expect(verifierAt(NOW).verify(signed({ rawBody: "{" }))).toMatchObject({ status: 422, code: "body_invalid_json" })

    const version = signed()
    version.headers["X-Cubid-Allocator-Contract-Version"] = "2026-01-01"
    expect(verifierAt(NOW).verify(version)).toMatchObject({ status: 422, code: "contract_version_unsupported" })

    const signature = signed()
    signature.headers["X-Cubid-Allocator-Signature"] = "not base64url!"
    expect(verifierAt(NOW).verify(signature)).toMatchObject({ status: 422, code: "signature_malformed" })

    expect(verifierAt(NOW).verify({ ...signed(), method: "GET" })).toMatchObject({ status: 422, code: "route_invalid" })
  })

  test("rejects callers outside the configured client and environment with 403", () => {
    const client = signed()
    client.headers["X-Cubid-Allocator-Client"] = "someone-else"
    expect(verifierAt(NOW).verify(client)).toMatchObject({ status: 403, code: "client_forbidden" })

    const environment = signed()
    environment.headers["X-Cubid-Allocator-Environment"] = "production"
    expect(verifierAt(NOW).verify(environment)).toMatchObject({ status: 403, code: "environment_mismatch" })

    const revoked = verifierAt(NOW, [{ keyId: primary.signing.keyId, publicKeyPem: primary.publicKeyPem, revoked: true }])
    expect(revoked.verify(signed())).toMatchObject({ status: 403, code: "key_revoked" })
  })

  test("refuses non-Ed25519 and duplicate verifier keys", () => {
    const rsa = generateKeyPairSync("rsa", { modulusLength: 2048 }).publicKey.export({ type: "spki", format: "pem" }) as string
    expect(() => verifierAt(NOW, [{ keyId: "rsa", publicKeyPem: rsa }])).toThrow("not Ed25519")
    expect(() => verifierAt(NOW, [
      { keyId: "dup", publicKeyPem: primary.publicKeyPem },
      { keyId: "dup", publicKeyPem: secondary.publicKeyPem },
    ])).toThrow("Duplicate verifier key id")
  })
})

describe("key rotation", () => {
  // Timeline: secondary activates at T+10m; primary retires at T+60m.
  const keys: VerifierKey[] = [
    { keyId: primary.signing.keyId, publicKeyPem: primary.publicKeyPem, notAfterMs: NOW + 60 * MINUTE },
    { keyId: secondary.signing.keyId, publicKeyPem: secondary.publicKeyPem, notBeforeMs: NOW + 10 * MINUTE },
  ]

  test.each([
    [0, true, "key_not_yet_active"],
    [10, true, true],
    [59, true, true],
    [60, "key_retired", true],
  ] as const)("at T+%im primary=%s secondary=%s", (offsetMinutes, primaryOutcome, secondaryOutcome) => {
    const at = NOW + offsetMinutes * MINUTE
    const verifier = verifierAt(at, keys)
    for (const [key, outcome] of [[primary, primaryOutcome], [secondary, secondaryOutcome]] as const) {
      const result = verifier.verify(signed({ keyConfig: key.signing, timestampMs: at }))
      if (outcome === true) expect(result.ok, key.signing.keyId).toBe(true)
      else expect(result, key.signing.keyId).toMatchObject({ ok: false, status: 403, code: outcome })
    }
  })

  test("some configured key verifies at every minute of the rotation (no downtime)", () => {
    for (let minute = 0; minute <= 90; minute += 1) {
      const at = NOW + minute * MINUTE
      const verifier = verifierAt(at, keys)
      const accepted = [primary, secondary].some((key) => verifier.verify(signed({ keyConfig: key.signing, timestampMs: at })).ok)
      expect(accepted, `T+${minute}m`).toBe(true)
    }
  })

  test("the client switches to the secondary key end to end", async () => {
    // The client stamps real wall-clock time, so this path builds its key windows around Date.now().
    const start = Date.now()
    const serve = (verifier: SignedRequestVerifier) => (async (_url: string, init: RequestInit) => {
      const result = verifier.verify({ method: init.method ?? "GET", headers: init.headers as Record<string, string>, rawBody: init.body as string })
      if (!result.ok) return new Response(JSON.stringify({ code: result.code, error: result.error }), { status: result.status })
      const item = { project_scoped_uuid: body.items[0].project_scoped_uuid, fundloop_scoped_uid: null, score: null,
        score_version: null, score_observed_at: null, evidence_hash: null, status: "not_found" }
      return new Response(JSON.stringify({ contract_version: CUBID_ALLOCATOR_CONTRACT_VERSION, request_id: result.requestId, items: [item] }), { status: 200 })
    }) as typeof fetch
    const client = (verifier: SignedRequestVerifier) => new PrivateCubidAllocatorClient({
      baseUrl: "https://allocator.test", environment: "preview", primaryKey: primary.signing, secondaryKey: secondary.signing, fetchFn: serve(verifier),
    })
    const live = (primaryNotAfterMs: number) => new SignedRequestVerifier({
      environment: "preview", nonceStore: new InMemoryNonceStore(),
      keys: [
        { keyId: primary.signing.keyId, publicKeyPem: primary.publicKeyPem, notAfterMs: primaryNotAfterMs },
        { keyId: secondary.signing.keyId, publicKeyPem: secondary.publicKeyPem, notBeforeMs: start - MINUTE },
      ],
    })

    const overlap = client(live(start + 30 * MINUTE))
    await expect(overlap.resolveBatch(body)).resolves.toMatchObject({ ok: true })
    await expect(overlap.resolveBatch(body, { useSecondaryKey: true })).resolves.toMatchObject({ ok: true })

    const retired = client(live(start - 1))
    await expect(retired.resolveBatch(body)).resolves.toMatchObject({ ok: false, status: 403, code: "key_retired", retryable: false })
    await expect(retired.resolveBatch(body, { useSecondaryKey: true })).resolves.toMatchObject({ ok: true })
  })
})

describe("client surfaces verifier rejections as non-retryable", () => {
  test.each([
    [401, "signature_invalid"],
    [403, "key_unknown"],
    [422, "body_invalid"],
  ] as const)("HTTP %i %s", async (status, code) => {
    const fetchFn = (async () => new Response(JSON.stringify({ code, error: code }), { status })) as typeof fetch
    const client = new PrivateCubidAllocatorClient({ baseUrl: "https://allocator.test", environment: "preview", primaryKey: primary.signing, fetchFn })
    await expect(client.resolveBatch(body)).resolves.toEqual({ ok: false, error: code, code, status, retryable: false })
  })
})

describe("in-memory nonce store", () => {
  test("scopes nonces per key and forgets them after the retention window", () => {
    const store = new InMemoryNonceStore(10 * MINUTE)
    expect(store.claim("k1", "n1", NOW)).toBe(true)
    expect(store.claim("k1", "n1", NOW + 1)).toBe(false)
    expect(store.claim("k2", "n1", NOW)).toBe(true)
    expect(store.claim("k1", "n1", NOW + 10 * MINUTE)).toBe(true)
  })

  test("default retention covers the full two-sided skew window", () => {
    const store = new InMemoryNonceStore()
    expect(store.claim("k1", "n1", NOW)).toBe(true)
    expect(store.claim("k1", "n1", NOW + 2 * SIGNED_REQUEST_MAX_CLOCK_SKEW_MS - 1)).toBe(false)
  })
})

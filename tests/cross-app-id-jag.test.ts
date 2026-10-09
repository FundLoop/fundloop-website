import { beforeAll, describe, expect, it, vi } from "vitest"
import { createJwksCache, verifyIdJag, type JsonWebKeySet } from "@/lib/cross-app/id-jag"

// Verified against a locally generated key and a test JWKS, because Cubid is not deployed yet
// (cubid-monorepo#179 is the staging rollout). The shapes come from the contract's "The assertion".

const ISSUER = "https://id.cubid.test"
const AUDIENCE = "fundloop-resource"
const CLIENT_ID = "cubid_wondrbot"
const KID = "test-key-1"

let privateKey: CryptoKey
let jwks: JsonWebKeySet

function toBase64Url(bytes: Uint8Array) {
  let binary = ""
  for (const byte of bytes) binary += String.fromCharCode(byte)
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "")
}

function encodeSegment(value: Record<string, unknown>) {
  return toBase64Url(new TextEncoder().encode(JSON.stringify(value)))
}

async function sign(header: Record<string, unknown>, payload: Record<string, unknown>, key: CryptoKey = privateKey) {
  const signingInput = `${encodeSegment(header)}.${encodeSegment(payload)}`
  const signature = await crypto.subtle.sign({ name: "RSASSA-PKCS1-v1_5" }, key, new TextEncoder().encode(signingInput))
  return `${signingInput}.${toBase64Url(new Uint8Array(signature))}`
}

function claims(overrides: Record<string, unknown> = {}) {
  const issuedAt = Math.floor(Date.now() / 1000)
  return {
    iss: ISSUER,
    sub: "pairwise-subject-for-fundloop",
    aud: AUDIENCE,
    client_id: CLIENT_ID,
    jti: "jag_12345",
    iat: issuedAt,
    exp: issuedAt + 300,
    scope: "profile:read awards:read",
    auth_time: issuedAt - 60,
    acr: "cubid:passkey",
    amr: ["passkey"],
    ...overrides,
  }
}

const header = { alg: "RS256", kid: KID, typ: "oauth-id-jag+jwt" }

async function verify(assertion: string, overrides: Partial<Parameters<typeof verifyIdJag>[1]> = {}) {
  return verifyIdJag(assertion, {
    jwks,
    issuer: ISSUER,
    audience: AUDIENCE,
    acceptedClientIds: [CLIENT_ID],
    ...overrides,
  })
}

beforeAll(async () => {
  const pair = await crypto.subtle.generateKey(
    { name: "RSASSA-PKCS1-v1_5", modulusLength: 2048, publicExponent: new Uint8Array([1, 0, 1]), hash: "SHA-256" },
    true,
    ["sign", "verify"],
  )
  privateKey = pair.privateKey
  const exported = (await crypto.subtle.exportKey("jwk", pair.publicKey)) as { kty: string; n: string; e: string }
  jwks = { keys: [{ kty: exported.kty, n: exported.n, e: exported.e, kid: KID, alg: "RS256", use: "sig" }] }
})

describe("verifyIdJag", () => {
  it("accepts a well-formed assertion and returns the claims a resource app needs", async () => {
    const result = await verify(await sign(header, claims()))

    expect(result.ok).toBe(true)
    if (!result.ok) return
    expect(result.keyId).toBe(KID)
    // The pairwise subject is the only identifier an assertion carries.
    expect(result.claims.sub).toBe("pairwise-subject-for-fundloop")
    expect(result.claims.client_id).toBe(CLIENT_ID)
    expect(result.claims.jti).toBe("jag_12345")
    // auth_time and acr are passed through so a resource app can judge freshness, as for an ID token.
    expect(result.claims.acr).toBe("cubid:passkey")
    expect(result.claims.amr).toEqual(["passkey"])
    expect(result.claims.scope).toBe("profile:read awards:read")
  })

  it("refuses an ID token offered as an assertion", async () => {
    // The typ header is what keeps the two from being interchangeable; without this check a plain
    // ID token, which a requesting client already holds, would be redeemable here.
    const asIdToken = await sign({ ...header, typ: "JWT" }, claims())
    expect(await verify(asIdToken)).toMatchObject({ ok: false, reason: "wrong_type" })

    const noTyp = await sign({ alg: "RS256", kid: KID }, claims())
    expect(await verify(noTyp)).toMatchObject({ ok: false, reason: "wrong_type" })
  })

  it("refuses an algorithm it was not asked to trust", async () => {
    const unsigned = `${encodeSegment({ alg: "none", kid: KID, typ: "oauth-id-jag+jwt" })}.${encodeSegment(claims())}.`
    expect(await verify(unsigned)).toMatchObject({ ok: false, reason: "unsupported_algorithm" })

    const hmacHeader = await sign({ ...header, alg: "HS256" }, claims())
    expect(await verify(hmacHeader)).toMatchObject({ ok: false, reason: "unsupported_algorithm" })
  })

  it("only trusts a key the issuer publishes", async () => {
    const unknownKid = await sign({ ...header, kid: "rotated-away" }, claims())
    expect(await verify(unknownKid)).toMatchObject({ ok: false, reason: "unknown_key" })

    // A key travelling inside the assertion would let it vouch for itself.
    const other = await crypto.subtle.generateKey(
      { name: "RSASSA-PKCS1-v1_5", modulusLength: 2048, publicExponent: new Uint8Array([1, 0, 1]), hash: "SHA-256" },
      true,
      ["sign", "verify"],
    )
    const foreign = await sign(header, claims(), other.privateKey)
    expect(await verify(foreign)).toMatchObject({ ok: false, reason: "bad_signature" })
  })

  it("rejects a tampered payload even though the signature is otherwise genuine", async () => {
    const genuine = await sign(header, claims())
    const [headerSegment, , signature] = genuine.split(".")
    const swapped = `${headerSegment}.${encodeSegment(claims({ sub: "someone-elses-subject" }))}.${signature}`
    expect(await verify(swapped)).toMatchObject({ ok: false, reason: "bad_signature" })
  })

  it("checks issuer, audience and requesting client exactly", async () => {
    expect(await verify(await sign(header, claims({ iss: "https://id.cubid.test.evil" })))).toMatchObject({ ok: false, reason: "wrong_issuer" })
    expect(await verify(await sign(header, claims({ aud: "someone-else" })))).toMatchObject({ ok: false, reason: "wrong_audience" })
    expect(await verify(await sign(header, claims({ client_id: "cubid_other_app" })))).toMatchObject({ ok: false, reason: "untrusted_client" })

    // RFC 7519 allows an array audience, so one containing ours is acceptable and one without is not.
    expect(await verify(await sign(header, claims({ aud: ["someone-else", AUDIENCE] })))).toMatchObject({ ok: true })
    expect(await verify(await sign(header, claims({ aud: ["someone-else"] })))).toMatchObject({ ok: false, reason: "wrong_audience" })
  })

  it("enforces the assertion's short life", async () => {
    const now = Math.floor(Date.now() / 1000)
    expect(await verify(await sign(header, claims({ iat: now - 600, exp: now - 60 })))).toMatchObject({ ok: false, reason: "expired" })
    expect(await verify(await sign(header, claims({ iat: now + 600, exp: now + 900 })))).toMatchObject({ ok: false, reason: "not_yet_valid" })
    // Correctly signed but claiming a longer life than the contract gives: accepting it would widen
    // the replay window.
    expect(await verify(await sign(header, claims({ iat: now, exp: now + 86_400 })))).toMatchObject({ ok: false, reason: "lifetime_too_long" })
    // A little clock drift is tolerated.
    expect(await verify(await sign(header, claims({ iat: now + 10, exp: now + 310 })))).toMatchObject({ ok: true })
  })

  it("requires every identifying claim", async () => {
    for (const missing of ["iss", "sub", "client_id", "jti", "iat", "exp"]) {
      const payload = claims()
      delete (payload as Record<string, unknown>)[missing]
      expect(await verify(await sign(header, payload))).toMatchObject({ ok: false, reason: "missing_claim" })
    }
    const noAudience = claims()
    delete (noAudience as Record<string, unknown>).aud
    expect(await verify(await sign(header, noAudience))).toMatchObject({ ok: false, reason: "wrong_audience" })
  })

  it("refuses anything that is not a JWS", async () => {
    for (const malformed of ["", "not-a-jwt", "a.b", "a.b.c.d", "!!!.###.$$$"]) {
      expect(await verify(malformed)).toMatchObject({ ok: false, reason: "malformed" })
    }
  })
})

describe("createJwksCache", () => {
  it("fetches once and serves the cached set", async () => {
    const fetchImpl = vi.fn(async () => new Response(JSON.stringify(jwks), { status: 200 }))
    const cache = createJwksCache({ jwksUri: `${ISSUER}/jwks`, fetchImpl: fetchImpl as unknown as typeof fetch })

    expect((await cache.get())?.keys[0].kid).toBe(KID)
    await cache.get()
    expect(fetchImpl).toHaveBeenCalledTimes(1)
  })

  it("will not let an unknown kid drive repeated requests at the issuer", async () => {
    let clock = 1_000_000
    const fetchImpl = vi.fn(async () => new Response(JSON.stringify(jwks), { status: 200 }))
    const cache = createJwksCache({
      jwksUri: `${ISSUER}/jwks`,
      fetchImpl: fetchImpl as unknown as typeof fetch,
      minRefreshSeconds: 60,
      now: () => clock,
    })

    await cache.get()
    await cache.get({ force: true })
    await cache.get({ force: true })
    expect(fetchImpl).toHaveBeenCalledTimes(1)

    // Once the floor has passed, a rotation is picked up without a deploy.
    clock += 61_000
    await cache.get({ force: true })
    expect(fetchImpl).toHaveBeenCalledTimes(2)
  })

  it("keeps serving the last good set when a refresh fails", async () => {
    let clock = 1_000_000
    let fail = false
    const fetchImpl = vi.fn(async () => (fail ? new Response("nope", { status: 503 }) : new Response(JSON.stringify(jwks), { status: 200 })))
    const cache = createJwksCache({ jwksUri: `${ISSUER}/jwks`, fetchImpl: fetchImpl as unknown as typeof fetch, ttlSeconds: 1, now: () => clock })

    await cache.get()
    fail = true
    clock += 5_000
    // An outage at the issuer must not invalidate assertions signed by a key we already hold.
    expect((await cache.get())?.keys[0].kid).toBe(KID)
  })

  it("treats an empty or malformed key set as no key set", async () => {
    const empty = createJwksCache({ jwksUri: `${ISSUER}/jwks`, fetchImpl: (async () => new Response(JSON.stringify({ keys: [] }), { status: 200 })) as unknown as typeof fetch })
    expect(await empty.get()).toBeNull()

    const garbage = createJwksCache({ jwksUri: `${ISSUER}/jwks`, fetchImpl: (async () => new Response("<html>", { status: 200 })) as unknown as typeof fetch })
    expect(await garbage.get()).toBeNull()
  })
})

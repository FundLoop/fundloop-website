import { beforeAll, describe, expect, it } from "vitest"
import { verifyIdToken } from "@/lib/cross-app/id-token"
import type { JsonWebKeySet } from "@/lib/cross-app/jws"

// Cubid ID token verification (#275, stage 2c), against a locally generated key because Cubid is
// not deployed yet. The claim shapes come from the login architecture document's token envelopes.

const ISSUER = "https://id.cubid.test"
const CLIENT_ID = "cubid_fundloop"
const NONCE = "nonce-from-the-cookie"
const KID = "test-key-1"

let privateKey: CryptoKey
let otherPrivateKey: CryptoKey
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
    aud: CLIENT_ID,
    iat: issuedAt,
    exp: issuedAt + 900,
    nonce: NONCE,
    email: "person@example.com",
    name: "A Person",
    ...overrides,
  }
}

const header = { alg: "RS256", kid: KID, typ: "JWT" }

async function verify(idToken: string, overrides: Partial<Parameters<typeof verifyIdToken>[1]> = {}) {
  return verifyIdToken(idToken, { jwks, issuer: ISSUER, audience: CLIENT_ID, nonce: NONCE, ...overrides })
}

beforeAll(async () => {
  const generate = () =>
    crypto.subtle.generateKey(
      { name: "RSASSA-PKCS1-v1_5", modulusLength: 2048, publicExponent: new Uint8Array([1, 0, 1]), hash: "SHA-256" },
      true,
      ["sign", "verify"],
    )
  const pair = await generate()
  privateKey = pair.privateKey
  otherPrivateKey = (await generate()).privateKey
  const exported = (await crypto.subtle.exportKey("jwk", pair.publicKey)) as { kty: string; n: string; e: string }
  jwks = { keys: [{ kty: exported.kty, n: exported.n, e: exported.e, kid: KID, alg: "RS256", use: "sig" }] }
}, 30_000)

describe("verifyIdToken", () => {
  it("accepts a token and reports the claims sign-in needs", async () => {
    const result = await verify(await sign(header, claims()))
    expect(result.ok).toBe(true)
    if (!result.ok) return
    expect(result.claims.sub).toBe("pairwise-subject-for-fundloop")
    expect(result.claims.email).toBe("person@example.com")
    expect(result.claims.name).toBe("A Person")
  })

  it.each(["JWT", "jwt"])("accepts the %s spelling of typ", async (typ) => {
    expect(await verify(await sign({ ...header, typ }, claims()))).toMatchObject({ ok: true })
  })

  it("accepts a token with no typ header, which the standard permits", async () => {
    expect(await verify(await sign({ alg: "RS256", kid: KID }, claims()))).toMatchObject({ ok: true })
  })

  it.each(["oauth-id-jag+jwt", "secevent+jwt"])("refuses a %s presented as an ID token", async (typ) => {
    // The artefacts that carry a distinguishing typ must not be interchangeable with this one.
    expect(await verify(await sign({ ...header, typ }, claims()))).toMatchObject({ ok: false, reason: "wrong_type" })
  })

  it("refuses an unsigned token", async () => {
    const unsigned = `${encodeSegment({ alg: "none", kid: KID, typ: "JWT" })}.${encodeSegment(claims())}.`
    expect(await verify(unsigned)).toMatchObject({ ok: false, reason: "unsupported_algorithm" })
  })

  it("refuses a token signed by another key under a published kid", async () => {
    expect(await verify(await sign(header, claims(), otherPrivateKey))).toMatchObject({ ok: false, reason: "bad_signature" })
  })

  it("refuses another issuer and another audience", async () => {
    expect(await verify(await sign(header, claims({ iss: "https://id.evil.test" })))).toMatchObject({ reason: "wrong_issuer" })
    expect(await verify(await sign(header, claims({ aud: "cubid_chaincrew" })))).toMatchObject({ reason: "wrong_audience" })
  })

  it("accepts an audience array that includes this client", async () => {
    expect(await verify(await sign(header, claims({ aud: ["cubid_chaincrew", CLIENT_ID] })))).toMatchObject({ ok: true })
  })

  it("refuses a token authorized for another party", async () => {
    // OpenID Connect Core §3.1.3.7: a token minted for another client and relayed here must not
    // sign anybody in.
    expect(await verify(await sign(header, claims({ azp: "cubid_chaincrew" })))).toMatchObject({
      ok: false,
      reason: "wrong_authorized_party",
    })
  })

  it("accepts an azp naming this client", async () => {
    expect(await verify(await sign(header, claims({ azp: CLIENT_ID })))).toMatchObject({ ok: true })
  })

  it("refuses a nonce that is not the one this browser sent", async () => {
    expect(await verify(await sign(header, claims({ nonce: "somebody-elses" })))).toMatchObject({ reason: "nonce_mismatch" })
    expect(await verify(await sign(header, claims({ nonce: undefined })))).toMatchObject({ reason: "nonce_mismatch" })
  })

  it("refuses an expired token and one dated in the future", async () => {
    const issuedAt = Math.floor(Date.now() / 1000)
    expect(await verify(await sign(header, claims({ iat: issuedAt - 1000, exp: issuedAt - 600 })))).toMatchObject({
      reason: "expired",
    })
    expect(await verify(await sign(header, claims({ iat: issuedAt + 600, exp: issuedAt + 1200 })))).toMatchObject({
      reason: "not_yet_valid",
    })
  })

  it("refuses a token claiming a longer life than the contract gives one", async () => {
    const issuedAt = Math.floor(Date.now() / 1000)
    expect(await verify(await sign(header, claims({ iat: issuedAt, exp: issuedAt + 7200 })))).toMatchObject({
      reason: "lifetime_too_long",
    })
  })

  it.each(["iss", "sub", "iat", "exp"])("refuses a token with no %s", async (claim) => {
    expect(await verify(await sign(header, claims({ [claim]: undefined })))).toMatchObject({ reason: "missing_claim" })
  })

  it("reports an absent email as absent, and refuses a malformed one", async () => {
    const withoutEmail = await verify(await sign(header, claims({ email: undefined })))
    expect(withoutEmail.ok).toBe(true)
    if (withoutEmail.ok) expect(withoutEmail.claims.email).toBeUndefined()
    // Absent means Cubid has none to release or the person did not consent, and that decides
    // whether sign-in can continue at all — so a malformed claim must not read as absent.
    expect(await verify(await sign(header, claims({ email: 42 })))).toMatchObject({ reason: "malformed_email" })
  })
})

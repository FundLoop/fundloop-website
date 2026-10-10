import { beforeAll, describe, expect, it } from "vitest"
import {
  ACCOUNT_PURGED_EVENT,
  CONSENT_REVOKED_EVENT,
  CROSS_APP_CONSENT_REVOKED_EVENT,
  readEventReason,
  readRequestingClientId,
  verifySecurityEventToken,
} from "@/lib/cross-app/secevent"
import type { JsonWebKeySet } from "@/lib/cross-app/jws"

// Verified against a locally generated key and a test JWKS, because Cubid is not deployed yet
// (cubid-monorepo#179 is the staging rollout). The shapes come from the contract's "Security Event
// Tokens": RFC 8417 tokens delivered by RFC 8935 push.

const ISSUER = "https://id.cubid.test"
// FundLoop's client id *at Cubid*, which is what a SET is addressed to — not the resource audience
// an assertion carries.
const CLIENT_ID = "cubid_fundloop"
const SUBJECT = "pairwise-subject-for-fundloop"
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

const header = { alg: "RS256", kid: KID, typ: "secevent+jwt" }

function subjectId(sub: string = SUBJECT, iss: string = ISSUER) {
  return { format: "iss_sub", iss, sub }
}

function crossAppRevoked(overrides: Record<string, unknown> = {}) {
  return {
    [CROSS_APP_CONSENT_REVOKED_EVENT]: {
      subject: subjectId(),
      requesting_client_id: "cubid_wondrbot",
      reason: "user_withdrew_consent",
      ...overrides,
    },
  }
}

function claims(overrides: Record<string, unknown> = {}) {
  return {
    iss: ISSUER,
    aud: CLIENT_ID,
    iat: Math.floor(Date.now() / 1000),
    jti: "evt_12345",
    sub_id: subjectId(),
    events: crossAppRevoked(),
    ...overrides,
  }
}

async function verify(token: string, overrides: Partial<Parameters<typeof verifySecurityEventToken>[1]> = {}) {
  return verifySecurityEventToken(token, { jwks, issuer: ISSUER, audience: CLIENT_ID, ...overrides })
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

describe("verifySecurityEventToken", () => {
  it("accepts a cross-app consent revocation and reports what it carries", async () => {
    const result = await verify(await sign(header, claims()))
    expect(result.ok).toBe(true)
    if (!result.ok) return
    expect(result.claims.jti).toBe("evt_12345")
    expect(result.claims.subject).toBe(SUBJECT)
    expect(result.claims.events).toHaveLength(1)
    expect(result.claims.events[0].type).toBe(CROSS_APP_CONSENT_REVOKED_EVENT)
    expect(readRequestingClientId(result.claims.events[0])).toBe("cubid_wondrbot")
    expect(readEventReason(result.claims.events[0])).toBe("user_withdrew_consent")
  })

  it("accepts an account purge, which carries no requesting client", async () => {
    const result = await verify(await sign(header, claims({ events: { [ACCOUNT_PURGED_EVENT]: {} } })))
    expect(result.ok).toBe(true)
    if (!result.ok) return
    expect(result.claims.events[0].type).toBe(ACCOUNT_PURGED_EVENT)
    expect(readRequestingClientId(result.claims.events[0])).toBeNull()
  })

  it("accepts a token carrying several events", async () => {
    const token = await sign(
      header,
      claims({ events: { ...crossAppRevoked(), [CONSENT_REVOKED_EVENT]: { subject: subjectId() } } }),
    )
    const result = await verify(token)
    expect(result.ok).toBe(true)
    if (!result.ok) return
    expect(result.claims.events.map((event) => event.type)).toEqual([
      CROSS_APP_CONSENT_REVOKED_EVENT,
      CONSENT_REVOKED_EVENT,
    ])
  })

  it("refuses an identity assertion presented as an event", async () => {
    const token = await sign({ ...header, typ: "oauth-id-jag+jwt" }, claims())
    expect(await verify(token)).toMatchObject({ ok: false, reason: "wrong_type" })
  })

  it("refuses an unsigned token", async () => {
    const unsigned = `${encodeSegment({ alg: "none", kid: KID, typ: "secevent+jwt" })}.${encodeSegment(claims())}.`
    expect(await verify(unsigned)).toMatchObject({ ok: false, reason: "unsupported_algorithm" })
  })

  it("refuses a critical header it does not understand", async () => {
    const token = await sign({ ...header, crit: ["https://schemas.cubid.me/unknown"] }, claims())
    expect(await verify(token)).toMatchObject({ ok: false, reason: "unsupported_critical_header" })
  })

  it("refuses a key the issuer does not publish", async () => {
    const token = await sign({ ...header, kid: "rotated-away" }, claims())
    expect(await verify(token)).toMatchObject({ ok: false, reason: "unknown_key" })
  })

  it("refuses a token signed by another key under a published kid", async () => {
    const token = await sign(header, claims(), otherPrivateKey)
    expect(await verify(token)).toMatchObject({ ok: false, reason: "bad_signature" })
  })

  it("refuses another issuer", async () => {
    const token = await sign(header, claims({ iss: "https://id.evil.test" }))
    expect(await verify(token)).toMatchObject({ ok: false, reason: "wrong_issuer" })
  })

  it("refuses a token addressed to another client", async () => {
    const token = await sign(header, claims({ aud: "cubid_chaincrew" }))
    expect(await verify(token)).toMatchObject({ ok: false, reason: "wrong_audience" })
  })

  it("accepts an audience array that includes this client", async () => {
    const token = await sign(header, claims({ aud: ["cubid_chaincrew", CLIENT_ID] }))
    expect(await verify(token)).toMatchObject({ ok: true })
  })

  it.each(["iss", "jti", "iat"])("refuses a token with no %s", async (claim) => {
    const token = await sign(header, claims({ [claim]: undefined }))
    expect(await verify(token)).toMatchObject({ ok: false, reason: "missing_claim" })
  })

  it("refuses a subject identifier in an unrecognised format", async () => {
    const token = await sign(header, claims({ sub_id: { format: "email", email: "someone@example.com" } }))
    expect(await verify(token)).toMatchObject({ ok: false, reason: "malformed_subject" })
  })

  it("refuses a subject minted by another issuer", async () => {
    const token = await sign(header, claims({ sub_id: subjectId(SUBJECT, "https://id.evil.test") }))
    expect(await verify(token)).toMatchObject({ ok: false, reason: "malformed_subject" })
  })

  it("refuses a token whose event names a different person than its sub_id", async () => {
    const token = await sign(header, claims({ events: crossAppRevoked({ subject: subjectId("somebody-else") }) }))
    expect(await verify(token)).toMatchObject({ ok: false, reason: "subject_mismatch" })
  })

  it("refuses a known event type whose payload is missing its required claim", async () => {
    // Acknowledging this would acknowledge a revocation we then could not apply, and lose it.
    const token = await sign(header, claims({ events: { [CROSS_APP_CONSENT_REVOKED_EVENT]: { subject: subjectId() } } }))
    expect(await verify(token)).toMatchObject({ ok: false, reason: "malformed_event" })
  })

  it("refuses a requesting client id that is present but not a string", async () => {
    const token = await sign(header, claims({ events: crossAppRevoked({ requesting_client_id: 42 }) }))
    expect(await verify(token)).toMatchObject({ ok: false, reason: "malformed_event" })
  })

  it("leaves an unimplemented event type's payload alone, because we do not know its shape", async () => {
    const token = await sign(header, claims({ events: { "https://schemas.cubid.me/secevent/something-new": {} } }))
    expect(await verify(token)).toMatchObject({ ok: true })
  })

  it("refuses a token with no events", async () => {
    expect(await verify(await sign(header, claims({ events: {} })))).toMatchObject({ ok: false, reason: "no_events" })
  })

  it("refuses an events claim that is not an object", async () => {
    const token = await sign(header, claims({ events: [CROSS_APP_CONSENT_REVOKED_EVENT] }))
    expect(await verify(token)).toMatchObject({ ok: false, reason: "missing_claim" })
  })

  it("refuses an event whose claims are not an object", async () => {
    const token = await sign(header, claims({ events: { [ACCOUNT_PURGED_EVENT]: "purged" } }))
    expect(await verify(token)).toMatchObject({ ok: false, reason: "missing_claim" })
  })

  it("refuses a token issued in the future beyond the skew it allows", async () => {
    const token = await sign(header, claims({ iat: Math.floor(Date.now() / 1000) + 600 }))
    expect(await verify(token)).toMatchObject({ ok: false, reason: "not_yet_valid" })
  })

  it("accepts a token that is a day old, because delivery retries for most of one", async () => {
    const token = await sign(header, claims({ iat: Math.floor(Date.now() / 1000) - 24 * 60 * 60 }))
    expect(await verify(token)).toMatchObject({ ok: true })
  })

  it("refuses a token older than the age bound, so a captured one is not replayable forever", async () => {
    const token = await sign(header, claims({ iat: Math.floor(Date.now() / 1000) - 8 * 24 * 60 * 60 }))
    expect(await verify(token)).toMatchObject({ ok: false, reason: "too_old" })
  })

  it("refuses a token whose own exp has passed", async () => {
    const issuedAt = Math.floor(Date.now() / 1000) - 600
    const token = await sign(header, claims({ iat: issuedAt, exp: issuedAt + 60 }))
    expect(await verify(token)).toMatchObject({ ok: false, reason: "expired" })
  })

  it("refuses a token that is not three segments", async () => {
    expect(await verify("not-a-token")).toMatchObject({ ok: false, reason: "malformed" })
  })
})

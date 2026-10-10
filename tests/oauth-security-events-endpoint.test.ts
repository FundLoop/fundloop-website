import { beforeAll, beforeEach, describe, expect, it, vi } from "vitest"
import type { JsonWebKeySet } from "@/lib/cross-app/jws"
import { CROSS_APP_CONSENT_REVOKED_EVENT } from "@/lib/cross-app/secevent"

// POST /oauth/security-events receiving a Cubid Security Event Token (#266 stage 2b).
//
// The tokens here are really signed by a locally generated key and verified by the real verifier:
// mocking verification would leave the part that matters untested. Only the database and the
// configuration are stubbed.

const ISSUER = "https://id.cubid.test"
const CLIENT_ID = "cubid_fundloop"
const SUBJECT = "pairwise-subject-for-fundloop"
const KID = "test-key-1"

let privateKey: CryptoKey
let jwks: JsonWebKeySet
const jwksGet = vi.fn()
const jwksRefresh = vi.fn()

const store = { applySecurityEvent: vi.fn() }
const config = { crossAppReceiverConfig: vi.fn(), cubidJwksCache: vi.fn(() => ({ get: jwksGet, refresh: jwksRefresh })) }

vi.mock("@/lib/oauth/store", () => store)
vi.mock("@/lib/cross-app/config", () => config)

const receiver = async () => await import("@/app/oauth/security-events/route")

function toBase64Url(bytes: Uint8Array) {
  let binary = ""
  for (const byte of bytes) binary += String.fromCharCode(byte)
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "")
}

async function signEvent(overrides: Record<string, unknown> = {}, headerOverrides: Record<string, unknown> = {}) {
  const header = { alg: "RS256", kid: KID, typ: "secevent+jwt", ...headerOverrides }
  const payload = {
    iss: ISSUER,
    aud: CLIENT_ID,
    iat: Math.floor(Date.now() / 1000),
    jti: "evt_abc",
    sub_id: { format: "iss_sub", iss: ISSUER, sub: SUBJECT },
    events: {
      [CROSS_APP_CONSENT_REVOKED_EVENT]: {
        subject: { format: "iss_sub", iss: ISSUER, sub: SUBJECT },
        requesting_client_id: "cubid_wondrbot",
        reason: "user_withdrew_consent",
      },
    },
    ...overrides,
  }
  const encode = (value: Record<string, unknown>) => toBase64Url(new TextEncoder().encode(JSON.stringify(value)))
  const signingInput = `${encode(header)}.${encode(payload)}`
  const signature = await crypto.subtle.sign({ name: "RSASSA-PKCS1-v1_5" }, privateKey, new TextEncoder().encode(signingInput))
  return `${signingInput}.${toBase64Url(new Uint8Array(signature))}`
}

function deliver(token: string, headers: Record<string, string> = { "Content-Type": "application/secevent+jwt" }) {
  return new Request("https://www.fundloop.org/oauth/security-events", { method: "POST", headers, body: token })
}

beforeAll(async () => {
  const pair = await crypto.subtle.generateKey(
    { name: "RSASSA-PKCS1-v1_5", modulusLength: 2048, publicExponent: new Uint8Array([1, 0, 1]), hash: "SHA-256" },
    true,
    ["sign", "verify"],
  )
  privateKey = pair.privateKey
  const exported = (await crypto.subtle.exportKey("jwk", pair.publicKey)) as { kty: string; n: string; e: string }
  jwks = { keys: [{ kty: exported.kty, n: exported.n, e: exported.e, kid: KID, alg: "RS256" }] }
}, 30_000)

describe("POST /oauth/security-events", () => {
  beforeEach(() => {
    vi.resetModules()
    store.applySecurityEvent.mockReset()
    jwksGet.mockReset()
    jwksRefresh.mockReset()
    config.crossAppReceiverConfig.mockReset()
    config.cubidJwksCache.mockClear()
    vi.spyOn(console, "info").mockImplementation(() => {})
    vi.spyOn(console, "warn").mockImplementation(() => {})
    vi.spyOn(console, "error").mockImplementation(() => {})

    config.crossAppReceiverConfig.mockReturnValue({ issuer: ISSUER, clientId: CLIENT_ID, jwksUri: `${ISSUER}/jwks` })
    jwksGet.mockResolvedValue(jwks)
    jwksRefresh.mockResolvedValue({ outcome: "failed" })
    store.applySecurityEvent.mockResolvedValue([
      { eventType: CROSS_APP_CONSENT_REVOKED_EVENT, outcome: "revoked", affected: 1 },
    ])
  })

  it("acknowledges a verified revocation and applies exactly what the token carried", async () => {
    const { POST } = await receiver()
    const response = await POST(deliver(await signEvent()))

    expect(response.status).toBe(202)
    expect(await response.text()).toBe("")
    expect(response.headers.get("Cache-Control")).toBe("no-store")
    expect(store.applySecurityEvent).toHaveBeenCalledTimes(1)
    const applied = store.applySecurityEvent.mock.calls[0][0]
    expect(applied.jti).toBe("evt_abc")
    expect(applied.issuer).toBe(ISSUER)
    expect(applied.audience).toBe(CLIENT_ID)
    expect(applied.subject).toBe(SUBJECT)
    // No `toe` from Cubid today, so nothing to order a late delivery by. Passing the delivery time
    // as a stand-in would make the ordering guard look active while never firing.
    expect(applied.eventTime).toBeNull()
    expect(Object.keys(applied.events)).toEqual([CROSS_APP_CONSENT_REVOKED_EVENT])
    expect(applied.events[CROSS_APP_CONSENT_REVOKED_EVENT].requesting_client_id).toBe("cubid_wondrbot")
  })

  it("passes the event time through when the issuer sends one", async () => {
    const when = Math.floor(Date.now() / 1000) - 3600
    const { POST } = await receiver()
    expect((await POST(deliver(await signEvent({ toe: when })))).status).toBe(202)
    expect(store.applySecurityEvent.mock.calls[0][0].eventTime).toEqual(new Date(when * 1000))
  })

  it("refuses a body larger than a Security Event Token could be, before verifying anything", async () => {
    const { POST } = await receiver()
    const response = await POST(deliver("x".repeat(17 * 1024)))
    expect(response.status).toBe(400)
    expect(await response.json()).toMatchObject({ err: "invalid_request" })
    expect(store.applySecurityEvent).not.toHaveBeenCalled()
  })

  it("refuses an oversized body whose Content-Length understates it", async () => {
    // The header is a claim, not a measurement, so the stream is read with the same cap.
    const request = new Request("https://www.fundloop.org/oauth/security-events", {
      method: "POST",
      headers: { "Content-Type": "application/secevent+jwt", "Content-Length": "10" },
      body: "x".repeat(17 * 1024),
    })
    const { POST } = await receiver()
    expect((await POST(request)).status).toBe(400)
    expect(store.applySecurityEvent).not.toHaveBeenCalled()
  })

  it("never logs an unverified header value, which could forge a log line", async () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {})
    const forged = 'x\n[oauth/security-events] applied evt_fake: consent-revoked=revoked'
    const { POST } = await receiver()
    await POST(deliver(await signEvent({}, { typ: forged })))

    expect(warn).toHaveBeenCalled()
    const logged = warn.mock.calls.map((call) => String(call[0])).join("\n")
    expect(logged).toContain("wrong_type")
    expect(logged).not.toContain("applied evt_fake")
    expect(logged).not.toContain(forged)
  })

  it("acknowledges an event there was nothing to do for, so delivery is not retried forever", async () => {
    store.applySecurityEvent.mockResolvedValue([{ eventType: CROSS_APP_CONSENT_REVOKED_EVENT, outcome: "unknown_subject", affected: 0 }])
    const { POST } = await receiver()
    expect((await POST(deliver(await signEvent()))).status).toBe(202)
  })

  it("acknowledges a redelivery without applying it twice", async () => {
    store.applySecurityEvent.mockResolvedValue([{ eventType: null, outcome: "duplicate", affected: 0 }])
    const { POST } = await receiver()
    expect((await POST(deliver(await signEvent()))).status).toBe(202)
  })

  it("refuses a body that is not a Security Event Token delivery", async () => {
    const { POST } = await receiver()
    const response = await POST(deliver(await signEvent(), { "Content-Type": "application/json" }))
    expect(response.status).toBe(400)
    expect(await response.json()).toMatchObject({ err: "invalid_request" })
    expect(store.applySecurityEvent).not.toHaveBeenCalled()
  })

  it("accepts the media type with parameters", async () => {
    const { POST } = await receiver()
    const response = await POST(deliver(await signEvent(), { "Content-Type": "application/secevent+jwt; charset=utf-8" }))
    expect(response.status).toBe(202)
  })

  it("refuses an empty body", async () => {
    const { POST } = await receiver()
    const response = await POST(deliver("   "))
    expect(response.status).toBe(400)
    expect(await response.json()).toMatchObject({ err: "invalid_request" })
  })

  it("refuses a token signed by nobody we trust, as an invalid key", async () => {
    const token = await signEvent({}, { kid: "rotated-away" })
    jwksGet.mockResolvedValue(jwks)
    // A conclusive refresh: the issuer answered, and that kid is genuinely not among its keys.
    jwksRefresh.mockResolvedValue({ outcome: "refreshed", keys: jwks })
    const { POST } = await receiver()
    const response = await POST(deliver(token))
    expect(response.status).toBe(400)
    expect(await response.json()).toMatchObject({ err: "invalid_key" })
    expect(store.applySecurityEvent).not.toHaveBeenCalled()
  })

  it("retries once against refreshed keys, because that is what a rotation looks like", async () => {
    const token = await signEvent({}, { kid: "rotated-in" })
    jwksGet.mockResolvedValue({ keys: [] })
    jwksRefresh.mockResolvedValue({ outcome: "refreshed", keys: { keys: [{ ...jwks.keys[0], kid: "rotated-in" }] } })
    const { POST } = await receiver()
    expect((await POST(deliver(token))).status).toBe(202)
    expect(jwksRefresh).toHaveBeenCalled()
  })

  it.each([
    ["throttled by the refresh floor", { outcome: "throttled" }],
    ["unable to reach the issuer", { outcome: "failed" }],
  ])("leaves the delivery pending when the keys could not be checked: %s", async (_label, refreshResult) => {
    // A 400 would tell Cubid this token is bad on the strength of a check we could not make, and
    // this is exactly the rotation the retry exists for. The next delivery attempt is past the floor.
    const token = await signEvent({}, { kid: "rotated-in" })
    jwksRefresh.mockResolvedValue(refreshResult)
    const { POST } = await receiver()
    const response = await POST(deliver(token))
    expect(response.status).toBe(503)
    expect(store.applySecurityEvent).not.toHaveBeenCalled()
  })

  it("states the language of its error descriptions, as RFC 8935 requires", async () => {
    const { POST } = await receiver()
    const response = await POST(deliver(await signEvent({ iss: "https://id.evil.test" })))
    expect(response.status).toBe(400)
    expect(response.headers.get("Content-Language")).toBe("en-US")
    expect(response.headers.get("Content-Type")).toContain("application/json")
  })

  it("refuses a known event type whose payload is incomplete, rather than acknowledging it", async () => {
    const { POST } = await receiver()
    const response = await POST(
      deliver(
        await signEvent({
          events: {
            [CROSS_APP_CONSENT_REVOKED_EVENT]: { subject: { format: "iss_sub", iss: ISSUER, sub: SUBJECT } },
          },
        }),
      ),
    )
    expect(response.status).toBe(400)
    expect(await response.json()).toMatchObject({ err: "invalid_request" })
    expect(store.applySecurityEvent).not.toHaveBeenCalled()
  })

  it("names the issuer when the token came from another one", async () => {
    const { POST } = await receiver()
    const response = await POST(deliver(await signEvent({ iss: "https://id.evil.test" })))
    expect(response.status).toBe(400)
    expect(await response.json()).toMatchObject({ err: "invalid_issuer" })
  })

  it("names the audience when the token was addressed to another client", async () => {
    const { POST } = await receiver()
    const response = await POST(deliver(await signEvent({ aud: "cubid_chaincrew" })))
    expect(response.status).toBe(400)
    expect(await response.json()).toMatchObject({ err: "invalid_audience" })
  })

  it("leaves the delivery pending when cross-app access is not configured", async () => {
    config.crossAppReceiverConfig.mockReturnValue(null)
    const { POST } = await receiver()
    const response = await POST(deliver(await signEvent()))
    expect(response.status).toBe(503)
    expect(store.applySecurityEvent).not.toHaveBeenCalled()
  })

  it("leaves the delivery pending when the issuer's keys are unreachable", async () => {
    jwksGet.mockResolvedValue(null)
    const { POST } = await receiver()
    expect((await POST(deliver(await signEvent()))).status).toBe(503)
  })

  it("leaves the delivery pending when applying it fails, rather than losing the revocation", async () => {
    store.applySecurityEvent.mockRejectedValue(new Error("oauth-store:apply-security-event: boom"))
    const { POST } = await receiver()
    expect((await POST(deliver(await signEvent()))).status).toBe(500)
  })

  it("answers GET with 405 and says which method it takes", async () => {
    const { GET } = await receiver()
    const response = await GET()
    expect(response.status).toBe(405)
    expect(response.headers.get("Allow")).toBe("POST")
  })
})

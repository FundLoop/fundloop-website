import { beforeAll, beforeEach, describe, expect, it, vi } from "vitest"
import type { JsonWebKeySet } from "@/lib/cross-app/id-jag"

// POST /oauth/token redeeming a Cubid identity assertion (#266 stage 2).
//
// The assertions here are really signed by a locally generated key and verified by the real
// verifier: mocking verification would leave the part that matters untested. Only the database and
// the configuration are stubbed.

const ISSUER = "https://id.cubid.test"
const AUDIENCE = "fundloop-resource"
const CUBID_CLIENT_ID = "cubid_wondrbot"
const KID = "test-key-1"

let privateKey: CryptoKey
let jwks: JsonWebKeySet
const jwksGet = vi.fn()

const store = {
  findRequestingClient: vi.fn(),
  authenticateClient: vi.fn(),
  findUserForCubidSubject: vi.fn(),
  noteSubjectSeen: vi.fn(),
  recordAssertionJti: vi.fn(),
  issueAccessToken: vi.fn(),
  revokeTokensForGrant: vi.fn(),
  revokeByToken: vi.fn(),
}

const config = { crossAppConfig: vi.fn(), cubidJwksCache: vi.fn(() => ({ get: jwksGet })) }

vi.mock("@/lib/oauth/store", () => store)
vi.mock("@/lib/cross-app/config", () => config)

const tokenRoute = async () => (await import("@/app/oauth/token/route")).POST

function toBase64Url(bytes: Uint8Array) {
  let binary = ""
  for (const byte of bytes) binary += String.fromCharCode(byte)
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "")
}

async function signAssertion(overrides: Record<string, unknown> = {}, headerOverrides: Record<string, unknown> = {}) {
  const issuedAt = Math.floor(Date.now() / 1000)
  const header = { alg: "RS256", kid: KID, typ: "oauth-id-jag+jwt", ...headerOverrides }
  const payload = {
    iss: ISSUER,
    sub: "pairwise-subject",
    aud: AUDIENCE,
    client_id: CUBID_CLIENT_ID,
    jti: "jag_abc",
    iat: issuedAt,
    exp: issuedAt + 300,
    scope: "profile:read awards:read",
    ...overrides,
  }
  const encode = (value: Record<string, unknown>) => toBase64Url(new TextEncoder().encode(JSON.stringify(value)))
  const signingInput = `${encode(header)}.${encode(payload)}`
  const signature = await crypto.subtle.sign({ name: "RSASSA-PKCS1-v1_5" }, privateKey, new TextEncoder().encode(signingInput))
  return `${signingInput}.${toBase64Url(new Uint8Array(signature))}`
}

function redeem(body: Record<string, string>, headers: Record<string, string> = {}) {
  return new Request("https://www.fundloop.org/oauth/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded", ...headers },
    body: new URLSearchParams(body).toString(),
  })
}

const GRANT = "urn:ietf:params:oauth:grant-type:jwt-bearer"

beforeAll(async () => {
  const pair = await crypto.subtle.generateKey(
    { name: "RSASSA-PKCS1-v1_5", modulusLength: 2048, publicExponent: new Uint8Array([1, 0, 1]), hash: "SHA-256" },
    true,
    ["sign", "verify"],
  )
  privateKey = pair.privateKey
  const exported = (await crypto.subtle.exportKey("jwk", pair.publicKey)) as { kty: string; n: string; e: string }
  jwks = { keys: [{ kty: exported.kty, n: exported.n, e: exported.e, kid: KID, alg: "RS256" }] }
})

describe("POST /oauth/token (ID-JAG redemption)", () => {
  beforeEach(() => {
    vi.resetModules()
    for (const fn of Object.values(store)) fn.mockReset()
    jwksGet.mockReset()
    config.crossAppConfig.mockReset()
    config.cubidJwksCache.mockClear()

    config.crossAppConfig.mockReturnValue({ issuer: ISSUER, audience: AUDIENCE, jwksUri: `${ISSUER}/jwks` })
    jwksGet.mockResolvedValue(jwks)
    store.findRequestingClient.mockResolvedValue({
      client_id: "wondrbot",
      cubid_client_id: CUBID_CLIENT_ID,
      client_secret_sha256: "f".repeat(64),
      name: "WondrBot",
      allowed_scopes: ["profile:read", "awards:read"],
      is_sandbox: false,
      disabled_at: null,
    })
    store.authenticateClient.mockReturnValue(true)
    store.recordAssertionJti.mockResolvedValue({ ok: true })
    store.findUserForCubidSubject.mockResolvedValue("user-1")
    store.issueAccessToken.mockResolvedValue({ ok: true, accessToken: "fundloop-access", expiresIn: 900 })
  })

  it("issues a FundLoop access token for a valid assertion", async () => {
    const response = await (await tokenRoute())(redeem({ grant_type: GRANT, client_id: "wondrbot", client_secret: "s3cret", assertion: await signAssertion() }))

    expect(response.status).toBe(200)
    expect(response.headers.get("Cache-Control")).toBe("no-store")
    const body = await response.json()
    expect(body).toEqual({ access_token: "fundloop-access", token_type: "Bearer", expires_in: 900, scope: "profile:read awards:read" })
    // No refresh token: the client renews by redeeming a fresh assertion, so Cubid re-checks consent.
    expect(body.refresh_token).toBeUndefined()
    expect(store.issueAccessToken).toHaveBeenCalledWith(expect.objectContaining({
      clientId: "wondrbot",
      userId: "user-1",
      // What the person consented to, and what this token carries, are recorded separately.
      consentedScopes: ["profile:read", "awards:read"],
      scopes: ["profile:read", "awards:read"],
      assertionJti: "jag_abc",
      assertionIssuedAt: expect.any(Date),
    }))
  })

  it("supports Basic client authentication", async () => {
    const response = await (await tokenRoute())(
      redeem({ grant_type: GRANT, assertion: await signAssertion() }, { authorization: `Basic ${Buffer.from("wondrbot:s3cret").toString("base64")}` }),
    )
    expect(response.status).toBe(200)
    expect(store.authenticateClient).toHaveBeenCalledWith(expect.anything(), "s3cret")
  })

  it("refuses any other grant type", async () => {
    const response = await (await tokenRoute())(redeem({ grant_type: "authorization_code", client_id: "wondrbot", code: "x" }))
    expect((await response.json()).error).toBe("unsupported_grant_type")
  })

  it("answers an unknown client and a wrong secret identically", async () => {
    const route = await tokenRoute()
    const assertion = await signAssertion()

    store.findRequestingClient.mockResolvedValue(null)
    const unknown = await route(redeem({ grant_type: GRANT, client_id: "nope", client_secret: "x", assertion }))

    store.findRequestingClient.mockResolvedValue({ client_id: "wondrbot", cubid_client_id: CUBID_CLIENT_ID, client_secret_sha256: "f".repeat(64), allowed_scopes: ["profile:read"], name: "WondrBot", is_sandbox: false, disabled_at: null })
    store.authenticateClient.mockReturnValue(false)
    const wrongSecret = await route(redeem({ grant_type: GRANT, client_id: "wondrbot", client_secret: "bad", assertion }))

    for (const response of [unknown, wrongSecret]) {
      expect(response.status).toBe(401)
      expect(response.headers.get("WWW-Authenticate")).toContain("Basic")
    }
    await expect(unknown.json()).resolves.toEqual(await wrongSecret.json())
  })

  it("refuses to verify anything when the deployment is not configured", async () => {
    // Cubid is not on prod yet, so an unconfigured deployment must not fall back to a default
    // issuer: there would be nothing trustworthy to check a signature against.
    config.crossAppConfig.mockReturnValue(null)
    const response = await (await tokenRoute())(redeem({ grant_type: GRANT, client_id: "wondrbot", client_secret: "s3cret", assertion: await signAssertion() }))
    expect(response.status).toBe(503)
    expect((await response.json()).error).toBe("temporarily_unavailable")
    expect(store.issueAccessToken).not.toHaveBeenCalled()
  })

  it("will not issue a token while the issuer's keys are unavailable", async () => {
    jwksGet.mockResolvedValue(null)
    const response = await (await tokenRoute())(redeem({ grant_type: GRANT, client_id: "wondrbot", client_secret: "s3cret", assertion: await signAssertion() }))
    expect(response.status).toBe(503)
    expect(store.issueAccessToken).not.toHaveBeenCalled()
  })

  it("rejects a bad assertion without saying which check failed", async () => {
    const route = await tokenRoute()
    for (const assertion of [
      await signAssertion({ aud: "another-app" }),
      await signAssertion({ iss: "https://id.cubid.test.evil" }),
      await signAssertion({}, { typ: "JWT" }),
      await signAssertion({ exp: Math.floor(Date.now() / 1000) - 60, iat: Math.floor(Date.now() / 1000) - 600 }),
      await signAssertion({ client_id: "cubid_someone_else" }),
    ]) {
      const response = await route(redeem({ grant_type: GRANT, client_id: "wondrbot", client_secret: "s3cret", assertion }))
      expect(response.status).toBe(400)
      const body = await response.json()
      expect(body.error).toBe("invalid_grant")
      // One message for every denial: which check failed would help shape the next attempt.
      expect(body.error_description).toBe("The assertion is not valid for this deployment.")
    }
    expect(store.recordAssertionJti).not.toHaveBeenCalled()
    expect(store.issueAccessToken).not.toHaveBeenCalled()
  })

  it("retries once against refreshed keys, which is what a rotation looks like", async () => {
    const rotated = await signAssertion({}, { kid: "rotated-key" })
    // First the cache serves a set without that kid, then the forced refresh has it.
    const rotatedJwks = { keys: [{ ...jwks.keys[0], kid: "rotated-key" }] }
    jwksGet.mockResolvedValueOnce(jwks).mockResolvedValueOnce(rotatedJwks)

    const response = await (await tokenRoute())(redeem({ grant_type: GRANT, client_id: "wondrbot", client_secret: "s3cret", assertion: rotated }))

    expect(jwksGet).toHaveBeenCalledWith({ force: true })
    expect(response.status).toBe(200)
  })

  it("records the assertion before issuing, and refuses a replay", async () => {
    store.recordAssertionJti.mockResolvedValue({ ok: false, reason: "replayed" })
    const response = await (await tokenRoute())(redeem({ grant_type: GRANT, client_id: "wondrbot", client_secret: "s3cret", assertion: await signAssertion() }))

    expect(response.status).toBe(400)
    expect((await response.json()).error_description).toContain("already been redeemed")
    // Recorded first, so a replay cannot win a race against its own first use.
    expect(store.recordAssertionJti).toHaveBeenCalled()
    expect(store.issueAccessToken).not.toHaveBeenCalled()
  })

  it("will not invent an account for an unlinked Cubid identity", async () => {
    store.findUserForCubidSubject.mockResolvedValue(null)
    const response = await (await tokenRoute())(redeem({ grant_type: GRANT, client_id: "wondrbot", client_secret: "s3cret", assertion: await signAssertion() }))

    expect(response.status).toBe(400)
    const body = await response.json()
    expect(body.error).toBe("invalid_grant")
    // This denial is explicit, because it is actionable: the person has to link their account.
    expect(body.error_description).toMatch(/sign in with Cubid or link/i)
    expect(store.issueAccessToken).not.toHaveBeenCalled()
  })

  it("refuses an assertion with no scope rather than granting the registered set", async () => {
    // An absent scope claim means none was requested, or the pairing allows none. Reading it as
    // this client's registered list would grant past the pairing's own limit.
    const noScope = await signAssertion({ scope: undefined })
    const response = await (await tokenRoute())(redeem({ grant_type: GRANT, client_id: "wondrbot", client_secret: "s3cret", assertion: noScope }))

    expect(response.status).toBe(400)
    const body = await response.json()
    expect(body.error).toBe("invalid_scope")
    expect(body.error_description).toMatch(/carries no scope/)
    expect(store.issueAccessToken).not.toHaveBeenCalled()
  })

  it("refuses a scope claim that is not a string", async () => {
    // Treating a malformed claim as absent would hand it the caller's default.
    for (const scope of [["profile:read"], 42, { scope: "profile:read" }]) {
      const response = await (await tokenRoute())(
        redeem({ grant_type: GRANT, client_id: "wondrbot", client_secret: "s3cret", assertion: await signAssertion({ scope }) }),
      )
      expect(response.status).toBe(400)
      expect((await response.json()).error).toBe("invalid_grant")
    }
    expect(store.issueAccessToken).not.toHaveBeenCalled()
  })

  it("refuses an assertion that predates a withdrawal", async () => {
    store.issueAccessToken.mockResolvedValue({ ok: false, reason: "withdrawn" })
    const response = await (await tokenRoute())(redeem({ grant_type: GRANT, client_id: "wondrbot", client_secret: "s3cret", assertion: await signAssertion() }))

    expect(response.status).toBe(400)
    expect((await response.json()).error_description).toMatch(/withdrawn/)
  })

  it("does not lose the token when bookkeeping fails afterwards", async () => {
    // The assertion is spent and the token row is live, so a failure here must not cost the client
    // the credential it earned.
    store.noteSubjectSeen.mockRejectedValue(new Error("subject table unavailable"))
    const response = await (await tokenRoute())(redeem({ grant_type: GRANT, client_id: "wondrbot", client_secret: "s3cret", assertion: await signAssertion() }))

    expect(response.status).toBe(200)
    expect((await response.json()).access_token).toBe("fundloop-access")
  })

  it("answers an unexpected failure in the OAuth shape, not Next's 500", async () => {
    store.recordAssertionJti.mockRejectedValue(new Error("connection string postgres://secret@host"))
    const response = await (await tokenRoute())(redeem({ grant_type: GRANT, client_id: "wondrbot", client_secret: "s3cret", assertion: await signAssertion() }))

    expect(response.status).toBe(500)
    const body = await response.json()
    expect(body.error).toBe("server_error")
    expect(JSON.stringify(body)).not.toContain("postgres://")
  })

  it("narrows scope to the assertion, then to the request, and never widens", async () => {
    const route = await tokenRoute()

    // The assertion may carry fewer scopes than the client is registered for.
    const narrowed = await route(redeem({ grant_type: GRANT, client_id: "wondrbot", client_secret: "s3cret", assertion: await signAssertion({ scope: "profile:read" }) }))
    expect((await narrowed.json()).scope).toBe("profile:read")
    expect(store.issueAccessToken).toHaveBeenLastCalledWith(expect.objectContaining({ scopes: ["profile:read"] }))

    // A request may narrow further.
    const requested = await route(redeem({ grant_type: GRANT, client_id: "wondrbot", client_secret: "s3cret", scope: "profile:read", assertion: await signAssertion() }))
    expect((await requested.json()).scope).toBe("profile:read")

    // It may not ask for more than the assertion allows.
    const widened = await route(redeem({ grant_type: GRANT, client_id: "wondrbot", client_secret: "s3cret", scope: "profile:read awards:read", assertion: await signAssertion({ scope: "profile:read" }) }))
    expect((await widened.json()).error).toBe("invalid_scope")

    // The grant records the consent, while the token carries the client's own narrowing.
    const narrowedToken = await route(redeem({ grant_type: GRANT, client_id: "wondrbot", client_secret: "s3cret", scope: "profile:read", assertion: await signAssertion() }))
    expect(narrowedToken.status).toBe(200)
    expect(store.issueAccessToken).toHaveBeenLastCalledWith(expect.objectContaining({
      consentedScopes: ["profile:read", "awards:read"],
      scopes: ["profile:read"],
    }))

    // Nor may an assertion name a scope the client is not registered for.
    const unregistered = await route(redeem({ grant_type: GRANT, client_id: "wondrbot", client_secret: "s3cret", assertion: await signAssertion({ scope: "payout-routes:read" }) }))
    expect((await unregistered.json()).error).toBe("invalid_scope")
  })

  it("requires an assertion, and accepts POST only", async () => {
    const response = await (await tokenRoute())(redeem({ grant_type: GRANT, client_id: "wondrbot", client_secret: "s3cret" }))
    expect((await response.json()).error).toBe("invalid_request")

    const getResponse = await (await import("@/app/oauth/token/route")).GET()
    expect(getResponse.status).toBe(405)
    expect(getResponse.headers.get("Allow")).toBe("POST")
  })
})

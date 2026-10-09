import { beforeEach, describe, expect, it, vi } from "vitest"
import { codeChallengeFromVerifier } from "@/lib/oauth/crypto"

// POST /oauth/token (#266 stage 2). What matters most here is what it refuses, so most of these
// cases are failures.

const store = {
  findEnabledClient: vi.fn(),
  authenticateConfidentialClient: vi.fn(),
  consumeAuthorizationCode: vi.fn(),
  findRefreshToken: vi.fn(),
  issueTokenPair: vi.fn(),
  linkRotation: vi.fn(),
  readGrant: vi.fn(),
  revokeGrantFamily: vi.fn(),
  rotateRefreshToken: vi.fn(),
}

vi.mock("@/lib/oauth/store", () => store)

const tokenRoute = async () => (await import("@/app/oauth/token/route")).POST

const VERIFIER = "a".repeat(64)
const CHALLENGE = codeChallengeFromVerifier(VERIFIER)

function post(body: Record<string, string>, headers: Record<string, string> = {}) {
  return new Request("https://www.fundloop.org/oauth/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded", ...headers },
    body: new URLSearchParams(body).toString(),
  })
}

const publicClient = { client_id: "wondrbot", client_type: "public", client_secret_sha256: null, allowed_scopes: ["profile:read"], name: "WondrBot" }

function codeRecord(overrides: Record<string, unknown> = {}) {
  return {
    id: 11,
    client_id: "wondrbot",
    user_id: "user-1",
    grant_id: 7,
    redirect_uri: "https://wondrbot.example/callback",
    scopes: ["profile:read", "awards:read"],
    code_challenge: CHALLENGE,
    code_challenge_method: "S256",
    expires_at: new Date(Date.now() + 60_000).toISOString(),
    ...overrides,
  }
}

describe("POST /oauth/token", () => {
  beforeEach(() => {
    vi.resetModules()
    for (const fn of Object.values(store)) fn.mockReset()
    store.findEnabledClient.mockResolvedValue(publicClient)
    store.authenticateConfidentialClient.mockResolvedValue(true)
    store.readGrant.mockResolvedValue({ id: 7, client_id: "wondrbot", user_id: "user-1", scopes: ["profile:read", "awards:read"], revoked_at: null })
    store.issueTokenPair.mockResolvedValue({ accessToken: "access-value", refreshToken: "refresh-value", expiresIn: 3600 })
    store.rotateRefreshToken.mockResolvedValue({ ok: true })
  })

  it("answers an unknown client and a wrong secret identically", async () => {
    const route = await tokenRoute()

    store.findEnabledClient.mockResolvedValue(null)
    const unknown = await route(post({ grant_type: "authorization_code", client_id: "nope" }))

    store.findEnabledClient.mockResolvedValue({ ...publicClient, client_type: "confidential", client_secret_sha256: "f".repeat(64) })
    store.authenticateConfidentialClient.mockResolvedValue(false)
    const wrongSecret = await route(post({ grant_type: "authorization_code", client_id: "wondrbot", client_secret: "bad" }))

    for (const response of [unknown, wrongSecret]) {
      expect(response.status).toBe(401)
      expect(response.headers.get("WWW-Authenticate")).toContain("Basic")
      expect(response.headers.get("Cache-Control")).toBe("no-store")
    }
    // Identical bodies, so the endpoint cannot be used to discover which client ids exist.
    await expect(unknown.json()).resolves.toEqual(await wrongSecret.json())
  })

  it("accepts client credentials from a Basic header", async () => {
    store.findEnabledClient.mockResolvedValue({ ...publicClient, client_type: "confidential", client_secret_sha256: "f".repeat(64) })
    store.consumeAuthorizationCode.mockResolvedValue(codeRecord())

    const response = await (await tokenRoute())(
      post({ grant_type: "authorization_code", code: "code-value", redirect_uri: "https://wondrbot.example/callback", code_verifier: VERIFIER },
        { authorization: `Basic ${Buffer.from("wondrbot:s3cret").toString("base64")}` }),
    )

    expect(response.status).toBe(200)
    expect(store.findEnabledClient).toHaveBeenCalledWith("wondrbot")
    expect(store.authenticateConfidentialClient).toHaveBeenCalledWith(expect.anything(), "s3cret")
  })

  it("refuses an unsupported grant type", async () => {
    const response = await (await tokenRoute())(post({ grant_type: "password", client_id: "wondrbot", username: "a", password: "b" }))
    expect(response.status).toBe(400)
    expect((await response.json()).error).toBe("unsupported_grant_type")
  })

  it("exchanges a code once and returns a bearer pair", async () => {
    store.consumeAuthorizationCode.mockResolvedValue(codeRecord())

    const response = await (await tokenRoute())(
      post({ grant_type: "authorization_code", client_id: "wondrbot", code: "code-value", redirect_uri: "https://wondrbot.example/callback", code_verifier: VERIFIER }),
    )

    expect(response.status).toBe(200)
    expect(response.headers.get("Cache-Control")).toBe("no-store")
    await expect(response.json()).resolves.toEqual({
      access_token: "access-value",
      token_type: "Bearer",
      expires_in: 3600,
      refresh_token: "refresh-value",
      scope: "profile:read awards:read",
    })
    expect(store.issueTokenPair).toHaveBeenCalledWith(expect.objectContaining({ grantId: 7, userId: "user-1", fromCodeId: 11 }))
  })

  it("treats an already used, unknown or expired code as invalid_grant", async () => {
    // The store consumes with a guarded UPDATE, so a second redemption arrives here as null.
    store.consumeAuthorizationCode.mockResolvedValue(null)
    const response = await (await tokenRoute())(
      post({ grant_type: "authorization_code", client_id: "wondrbot", code: "code-value", redirect_uri: "https://wondrbot.example/callback", code_verifier: VERIFIER }),
    )
    expect(response.status).toBe(400)
    expect((await response.json()).error).toBe("invalid_grant")
  })

  it("revokes the grant when a code is presented by the wrong client or for the wrong redirect", async () => {
    const route = await tokenRoute()

    store.consumeAuthorizationCode.mockResolvedValue(codeRecord({ client_id: "someone-else" }))
    const wrongClient = await route(post({ grant_type: "authorization_code", client_id: "wondrbot", code: "c", redirect_uri: "https://wondrbot.example/callback", code_verifier: VERIFIER }))

    store.consumeAuthorizationCode.mockResolvedValue(codeRecord())
    const wrongRedirect = await route(post({ grant_type: "authorization_code", client_id: "wondrbot", code: "c", redirect_uri: "https://attacker.example/callback", code_verifier: VERIFIER }))

    for (const response of [wrongClient, wrongRedirect]) {
      expect(response.status).toBe(400)
      expect((await response.json()).error).toBe("invalid_grant")
    }
    // Either case means the code reached someone it was not issued to, so the grant is not salvaged.
    expect(store.revokeGrantFamily).toHaveBeenCalledTimes(2)
    expect(store.revokeGrantFamily).toHaveBeenCalledWith(7, "reuse")
  })

  it("requires the PKCE verifier to match the stored challenge", async () => {
    store.consumeAuthorizationCode.mockResolvedValue(codeRecord())
    const response = await (await tokenRoute())(
      post({ grant_type: "authorization_code", client_id: "wondrbot", code: "c", redirect_uri: "https://wondrbot.example/callback", code_verifier: "b".repeat(64) }),
    )
    expect(response.status).toBe(400)
    expect((await response.json()).error_description).toMatch(/verifier/)
    expect(store.issueTokenPair).not.toHaveBeenCalled()
  })

  it("will not exchange a code whose grant was revoked meanwhile", async () => {
    store.consumeAuthorizationCode.mockResolvedValue(codeRecord())
    store.readGrant.mockResolvedValue({ id: 7, scopes: ["profile:read"], revoked_at: new Date().toISOString() })
    const response = await (await tokenRoute())(
      post({ grant_type: "authorization_code", client_id: "wondrbot", code: "c", redirect_uri: "https://wondrbot.example/callback", code_verifier: VERIFIER }),
    )
    expect((await response.json()).error).toBe("invalid_grant")
    expect(store.issueTokenPair).not.toHaveBeenCalled()
  })

  it("rotates a refresh token and takes the scopes from the grant, not the request", async () => {
    store.findRefreshToken.mockResolvedValue({ id: 21, token_type: "refresh", client_id: "wondrbot", user_id: "user-1", grant_id: 7, scopes: ["profile:read"], rotated_to_id: null, expires_at: new Date(Date.now() + 60_000).toISOString(), revoked_at: null })

    const response = await (await tokenRoute())(
      // An attempt to widen scope on refresh must be ignored.
      post({ grant_type: "refresh_token", client_id: "wondrbot", refresh_token: "refresh-value", scope: "profile:read awards:read payout-routes:read" }),
    )

    expect(response.status).toBe(200)
    const body = await response.json()
    expect(body.scope).toBe("profile:read awards:read")
    expect(store.issueTokenPair).toHaveBeenCalledWith(expect.objectContaining({ scopes: ["profile:read", "awards:read"] }))
    // The old token is claimed before the new pair is issued, then linked for reuse detection.
    expect(store.rotateRefreshToken).toHaveBeenCalled()
    expect(store.linkRotation).toHaveBeenCalledWith(21, "refresh-value")
  })

  it("revokes the whole grant when a rotated refresh token is presented again", async () => {
    store.findRefreshToken.mockResolvedValue({ id: 21, token_type: "refresh", client_id: "wondrbot", grant_id: 7, user_id: "user-1", scopes: ["profile:read"], rotated_to_id: 22, expires_at: new Date(Date.now() + 60_000).toISOString(), revoked_at: new Date().toISOString() })

    const response = await (await tokenRoute())(post({ grant_type: "refresh_token", client_id: "wondrbot", refresh_token: "old-value" }))

    expect(response.status).toBe(400)
    const body = await response.json()
    expect(body.error).toBe("invalid_grant")
    expect(body.error_description).toMatch(/revoked/)
    // A legitimate client never presents a rotated token, so two parties hold it (RFC 9700).
    expect(store.revokeGrantFamily).toHaveBeenCalledWith(7, "reuse")
    expect(store.issueTokenPair).not.toHaveBeenCalled()
  })

  it("refuses a refresh token belonging to another client, and a lost rotation race", async () => {
    const route = await tokenRoute()
    const base = { id: 21, token_type: "refresh" as const, user_id: "user-1", grant_id: 7, scopes: ["profile:read"], rotated_to_id: null, expires_at: new Date(Date.now() + 60_000).toISOString(), revoked_at: null }

    store.findRefreshToken.mockResolvedValue({ ...base, client_id: "another-client" })
    expect((await (await route(post({ grant_type: "refresh_token", client_id: "wondrbot", refresh_token: "r" }))).json()).error).toBe("invalid_grant")

    store.findRefreshToken.mockResolvedValue({ ...base, client_id: "wondrbot" })
    store.rotateRefreshToken.mockResolvedValue({ ok: false, reason: "race" })
    const raced = await route(post({ grant_type: "refresh_token", client_id: "wondrbot", refresh_token: "r" }))
    expect((await raced.json()).error).toBe("invalid_grant")
    expect(store.issueTokenPair).not.toHaveBeenCalled()
  })

  it("accepts POST only", async () => {
    const response = await (await import("@/app/oauth/token/route")).GET()
    expect(response.status).toBe(405)
    expect(response.headers.get("Allow")).toBe("POST")
  })
})

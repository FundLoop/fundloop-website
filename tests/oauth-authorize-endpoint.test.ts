import { readFileSync } from "node:fs"
import { beforeEach, describe, expect, it, vi } from "vitest"
import { codeChallengeFromVerifier } from "@/lib/oauth/crypto"

// GET /oauth/authorize and the metadata document (#266 stage 2).

const store = {
  findEnabledClient: vi.fn(),
  clientRedirectUris: vi.fn(),
  isRegisteredRedirectUri: vi.fn(),
  createAuthorizationRequest: vi.fn(),
  authenticateConfidentialClient: vi.fn(),
  revokeByToken: vi.fn(),
}

vi.mock("@/lib/oauth/store", () => store)
vi.mock("next/headers", () => ({ cookies: async () => ({ get: () => undefined }) }))

const CHALLENGE = codeChallengeFromVerifier("a".repeat(64))
const REDIRECT = "https://wondrbot.example/callback"

const authorizeRoute = async () => (await import("@/app/oauth/authorize/route")).GET

function authorize(params: Record<string, string>) {
  const url = new URL("https://www.fundloop.org/oauth/authorize")
  for (const [key, value] of Object.entries(params)) url.searchParams.set(key, value)
  return new Request(url)
}

const validParams = {
  response_type: "code",
  client_id: "wondrbot",
  redirect_uri: REDIRECT,
  scope: "profile:read awards:read",
  state: "client-state",
  code_challenge: CHALLENGE,
  code_challenge_method: "S256",
}

describe("GET /oauth/authorize", () => {
  beforeEach(() => {
    vi.resetModules()
    for (const fn of Object.values(store)) fn.mockReset()
    store.findEnabledClient.mockResolvedValue({ client_id: "wondrbot", name: "WondrBot", allowed_scopes: ["profile:read", "awards:read"] })
    store.clientRedirectUris.mockResolvedValue([REDIRECT])
    store.isRegisteredRedirectUri.mockReturnValue(true)
    store.createAuthorizationRequest.mockResolvedValue("request-token")
  })

  it("shows the person an error instead of redirecting when the client is unknown", async () => {
    // RFC 6749 §4.1.2.1: with no trusted redirect URI there is nowhere safe to send an error.
    store.findEnabledClient.mockResolvedValue(null)
    const response = await (await authorizeRoute())(authorize(validParams))
    expect(response.status).toBe(400)
    expect(response.headers.get("Content-Type")).toContain("text/html")
    expect(response.headers.get("Location")).toBeNull()
    const body = await response.text()
    expect(body).toContain("Nothing has been shared")
    expect(store.createAuthorizationRequest).not.toHaveBeenCalled()
  })

  it("refuses a redirect URI the client never registered", async () => {
    store.isRegisteredRedirectUri.mockReturnValue(false)
    const response = await (await authorizeRoute())(authorize({ ...validParams, redirect_uri: "https://attacker.example/callback" }))
    expect(response.status).toBe(400)
    expect(response.headers.get("Location")).toBeNull()
  })

  it("requires PKCE with S256", async () => {
    const route = await authorizeRoute()

    for (const params of [
      { ...validParams, code_challenge_method: "plain" },
      { ...validParams, code_challenge: "too-short" },
      { response_type: "code", client_id: "wondrbot", redirect_uri: REDIRECT, scope: "profile:read" },
    ]) {
      const response = await route(authorize(params as Record<string, string>))
      expect(response.status).toBe(302)
      const location = new URL(response.headers.get("Location")!)
      expect(location.origin + location.pathname).toBe(REDIRECT)
      expect(location.searchParams.get("error")).toBe("invalid_request")
      expect(location.searchParams.get("error_description")).toContain("S256")
    }
    expect(store.createAuthorizationRequest).not.toHaveBeenCalled()
  })

  it("refuses an unknown scope and one the client is not registered for", async () => {
    const route = await authorizeRoute()

    const unknown = await route(authorize({ ...validParams, scope: "profile:read fundloop:everything" }))
    expect(new URL(unknown.headers.get("Location")!).searchParams.get("error")).toBe("invalid_scope")

    const notAllowed = await route(authorize({ ...validParams, scope: "payout-routes:read" }))
    const location = new URL(notAllowed.headers.get("Location")!)
    expect(location.searchParams.get("error")).toBe("invalid_scope")
    expect(location.searchParams.get("state")).toBe("client-state")
    expect(store.createAuthorizationRequest).not.toHaveBeenCalled()
  })

  it("refuses anything but response_type=code", async () => {
    const response = await (await authorizeRoute())(authorize({ ...validParams, response_type: "token" }))
    expect(new URL(response.headers.get("Location")!).searchParams.get("error")).toBe("unsupported_response_type")
  })

  it("stores the validated request and hands over to the consent page", async () => {
    const response = await (await authorizeRoute())(authorize(validParams))

    expect(response.status).toBe(302)
    const location = new URL(response.headers.get("Location")!)
    // The consent UI lives inside the localized layout; the endpoint itself is not locale-prefixed.
    expect(location.pathname).toBe("/en/oauth/consent")
    // Only an opaque token travels through the UI: nothing the client sent can be tampered with
    // between the consent screen and the issued code.
    expect(location.searchParams.get("request")).toBe("request-token")
    expect([...location.searchParams.keys()]).toEqual(["request"])
    expect(store.createAuthorizationRequest).toHaveBeenCalledWith({
      clientId: "wondrbot",
      redirectUri: REDIRECT,
      scopes: ["profile:read", "awards:read"],
      state: "client-state",
      codeChallenge: CHALLENGE,
    })
  })
})

describe("authorization server metadata", () => {
  it("advertises only the OAuth 2.1 flows this server implements", async () => {
    const { GET } = await import("@/app/api/oauth/metadata/route")
    const response = GET(new Request("https://dev.fundloop.org/.well-known/oauth-authorization-server"))
    const document = await response.json()

    // RFC 8414: the issuer must match where the document was fetched from, and this app serves more
    // than one host.
    expect(document.issuer).toBe("https://dev.fundloop.org")
    expect(document.authorization_endpoint).toBe("https://dev.fundloop.org/oauth/authorize")
    expect(document.code_challenge_methods_supported).toEqual(["S256"])
    expect(document.grant_types_supported).toEqual(["authorization_code", "refresh_token"])
    expect(document.response_types_supported).toEqual(["code"])
    // No implicit grant, no password grant, and no dynamic client registration.
    expect(JSON.stringify(document)).not.toContain("implicit")
    expect(JSON.stringify(document)).not.toContain("password")
    expect(document.registration_endpoint).toBeUndefined()
  })

  it("is served at the path RFC 8414 fixes", () => {
    // Next ignores a directory whose name starts with a dot, so the well-known path is a rewrite.
    const config = readFileSync("next.config.mjs", "utf8")
    expect(config).toContain("/.well-known/oauth-authorization-server")
    expect(config).toContain("/api/oauth/metadata")
  })
})

describe("POST /oauth/revoke", () => {
  beforeEach(() => {
    vi.resetModules()
    for (const fn of Object.values(store)) fn.mockReset()
    store.findEnabledClient.mockResolvedValue({ client_id: "wondrbot", client_type: "public", client_secret_sha256: null })
    store.authenticateConfidentialClient.mockResolvedValue(true)
  })

  function revoke(body: Record<string, string>) {
    return new Request("https://www.fundloop.org/oauth/revoke", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams(body).toString(),
    })
  }

  it("succeeds for an unknown token, so it cannot be used to test whether one exists", async () => {
    const { POST } = await import("@/app/oauth/revoke/route")
    const response = await POST(revoke({ client_id: "wondrbot", token: "never-issued" }))
    // RFC 7009 §2.2.
    expect(response.status).toBe(200)
    expect(store.revokeByToken).toHaveBeenCalledWith("never-issued")
  })

  it("requires a token and an authenticated client", async () => {
    const { POST } = await import("@/app/oauth/revoke/route")
    expect((await POST(revoke({ client_id: "wondrbot" }))).status).toBe(400)

    store.findEnabledClient.mockResolvedValue(null)
    expect((await POST(revoke({ client_id: "nope", token: "t" }))).status).toBe(401)
    expect(store.revokeByToken).not.toHaveBeenCalled()
  })
})

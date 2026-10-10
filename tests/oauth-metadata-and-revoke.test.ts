import { readFileSync } from "node:fs"
import { beforeEach, describe, expect, it, vi } from "vitest"

// The discovery document and the revocation endpoint for a resource app (#266 stage 2).

const store = {
  findRequestingClient: vi.fn(),
  authenticateClient: vi.fn(),
  revokeByToken: vi.fn(),
  revokeTokensForGrant: vi.fn(),
}
vi.mock("@/lib/oauth/store", () => store)

describe("authorization server metadata", () => {
  it("describes a redemption endpoint, not an authorization server", async () => {
    const { GET } = await import("@/app/api/oauth/metadata/route")
    const metadata = await GET(new Request("https://dev.fundloop.org/.well-known/oauth-authorization-server")).json()

    // RFC 8414 requires the issuer to match where the document was fetched from, and this app serves
    // more than one host.
    expect(metadata.issuer).toBe("https://dev.fundloop.org")
    expect(metadata.token_endpoint).toBe("https://dev.fundloop.org/oauth/token")
    expect(metadata.grant_types_supported).toEqual(["urn:ietf:params:oauth:grant-type:jwt-bearer"])

    // Consent lives at Cubid, so FundLoop advertises no authorization endpoint, no response type and
    // no PKCE method, and never dynamic registration.
    expect(metadata.authorization_endpoint).toBeUndefined()
    expect(metadata.response_types_supported).toBeUndefined()
    expect(metadata.code_challenge_methods_supported).toBeUndefined()
    expect(metadata.registration_endpoint).toBeUndefined()
    const serialized = JSON.stringify(metadata)
    expect(serialized).not.toContain("implicit")
    expect(serialized).not.toContain("authorization_code")
  })

  it("is served at the path RFC 8414 fixes", () => {
    const config = readFileSync("next.config.mjs", "utf8")
    expect(config).toContain("/.well-known/oauth-authorization-server")
    expect(config).toContain("/api/oauth/metadata")
  })
})

describe("POST /oauth/revoke", () => {
  beforeEach(() => {
    vi.resetModules()
    for (const fn of Object.values(store)) fn.mockReset()
    store.findRequestingClient.mockResolvedValue({ client_id: "wondrbot", cubid_client_id: "cubid_wondrbot", client_secret_sha256: "f".repeat(64), allowed_scopes: ["profile:read"], name: "WondrBot", is_sandbox: false, disabled_at: null })
    store.authenticateClient.mockReturnValue(true)
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
    const response = await POST(revoke({ client_id: "wondrbot", client_secret: "s3cret", token: "never-issued" }))
    // RFC 7009 §2.2.
    expect(response.status).toBe(200)
    // §2.1: revocation is bound to the authenticated client, so a token belonging to another client
    // is looked up as that client's and found to be nobody's.
    expect(store.revokeByToken).toHaveBeenCalledWith("never-issued", "wondrbot")
  })

  it("accepts Basic credentials, which the discovery document advertises for this endpoint", async () => {
    const { POST } = await import("@/app/oauth/revoke/route")
    const request = new Request("https://www.fundloop.org/oauth/revoke", {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
        authorization: `Basic ${Buffer.from("wondrbot:s3cret").toString("base64")}`,
      },
      body: new URLSearchParams({ token: "issued-token" }).toString(),
    })

    const response = await POST(request)
    expect(response.status).toBe(200)
    expect(store.authenticateClient).toHaveBeenCalledWith(expect.anything(), "s3cret")
    expect(store.revokeByToken).toHaveBeenCalledWith("issued-token", "wondrbot")
  })

  it("requires a token and an authenticated client", async () => {
    const { POST } = await import("@/app/oauth/revoke/route")
    expect((await POST(revoke({ client_id: "wondrbot", client_secret: "s3cret" }))).status).toBe(400)

    store.authenticateClient.mockReturnValue(false)
    expect((await POST(revoke({ client_id: "wondrbot", client_secret: "wrong", token: "t" }))).status).toBe(401)
    expect(store.revokeByToken).not.toHaveBeenCalled()
  })
})

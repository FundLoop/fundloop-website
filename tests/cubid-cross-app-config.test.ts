import { describe, expect, it } from "vitest"
import { crossAppSignInConfig } from "@/lib/cross-app/config"

// Sign in with Cubid configuration (#275). Every URL this app will send a credential to, fetch keys
// from, or receive an authorization code at has to be HTTPS — or loopback, where there is no network
// to listen on.

const COOKIE_SECRET = "c".repeat(48)

const base = {
  CUBID_OIDC_ISSUER: "https://id.cubid.me",
  FUNDLOOP_CUBID_CLIENT_ID: "cubid_fundloop",
  CUBID_OIDC_CLIENT_SECRET: "s3cret",
  FUNDLOOP_CUBID_REDIRECT_URI: "https://www.fundloop.org/auth/cubid/callback",
  FUNDLOOP_CUBID_COOKIE_SECRET: COOKIE_SECRET,
}

describe("crossAppSignInConfig", () => {
  it("derives the endpoints from the issuer", () => {
    expect(crossAppSignInConfig(base)).toEqual({
      issuer: "https://id.cubid.me",
      jwksUri: "https://id.cubid.me/jwks",
      clientId: "cubid_fundloop",
      clientSecret: "s3cret",
      redirectUri: "https://www.fundloop.org/auth/cubid/callback",
      cookieSecret: COOKIE_SECRET,
      authorizationEndpoint: "https://id.cubid.me/authorize",
      tokenEndpoint: "https://id.cubid.me/token",
    })
  })

  it.each([
    "FUNDLOOP_CUBID_CLIENT_ID",
    "CUBID_OIDC_CLIENT_SECRET",
    "FUNDLOOP_CUBID_REDIRECT_URI",
    "CUBID_OIDC_ISSUER",
    "FUNDLOOP_CUBID_COOKIE_SECRET",
  ])(
    "is unconfigured without %s",
    (name) => {
      expect(crossAppSignInConfig({ ...base, [name]: undefined })).toBeNull()
    },
  )

  it("refuses a plain-http token endpoint, which would put the client secret on the wire", () => {
    // The code exchange sends the secret in an Authorization header and the code in the body.
    expect(crossAppSignInConfig({ ...base, CUBID_OIDC_TOKEN_ENDPOINT: "http://id.evil.test/token" })).toBeNull()
  })

  it("refuses a plain-http authorization endpoint, redirect URI or key set", () => {
    expect(crossAppSignInConfig({ ...base, CUBID_OIDC_AUTHORIZATION_ENDPOINT: "http://id.evil.test/authorize" })).toBeNull()
    expect(crossAppSignInConfig({ ...base, FUNDLOOP_CUBID_REDIRECT_URI: "http://www.fundloop.org/auth/cubid/callback" })).toBeNull()
    expect(crossAppSignInConfig({ ...base, CUBID_OIDC_JWKS_URI: "http://id.evil.test/jwks" })).toBeNull()
  })

  it("allows loopback overrides, for developing against a local Cubid", () => {
    const local = crossAppSignInConfig({
      ...base,
      CUBID_OIDC_ISSUER: "http://localhost:3100",
      FUNDLOOP_CUBID_REDIRECT_URI: "http://localhost:3000/auth/cubid/callback",
      CUBID_OIDC_TOKEN_ENDPOINT: "http://127.0.0.1:3100/token",
    })
    expect(local?.tokenEndpoint).toBe("http://127.0.0.1:3100/token")
  })

  it("is not fooled by a host that merely starts with a loopback name", () => {
    expect(crossAppSignInConfig({ ...base, CUBID_OIDC_TOKEN_ENDPOINT: "http://localhost.evil.test/token" })).toBeNull()
    expect(crossAppSignInConfig({ ...base, CUBID_OIDC_TOKEN_ENDPOINT: "http://127.0.0.1.evil.test/token" })).toBeNull()
  })

  it("refuses a cookie secret short enough to guess", () => {
    // The signature over the pending request is what stops a sibling host planting a sign-in, so a
    // weak secret is the same as no signature. Unavailable beats unsigned.
    expect(crossAppSignInConfig({ ...base, FUNDLOOP_CUBID_COOKIE_SECRET: "short" })).toBeNull()
    expect(crossAppSignInConfig({ ...base, FUNDLOOP_CUBID_COOKIE_SECRET: "x".repeat(31) })).toBeNull()
    expect(crossAppSignInConfig({ ...base, FUNDLOOP_CUBID_COOKIE_SECRET: "x".repeat(32) })).not.toBeNull()
  })
})

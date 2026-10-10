import { describe, expect, it } from "vitest"
import { crossAppConfig, crossAppReceiverConfig, cubidJwksCache } from "@/lib/cross-app/config"

// Cross-app configuration fails closed (#266 stage 2). Nothing here reads process.env: each case
// passes the environment it is about, so a developer's own shell cannot change the outcome.

const ISSUER = "https://id.cubid.me"

describe("crossAppConfig", () => {
  it("is configured only when both the issuer and the resource audience are present", () => {
    expect(crossAppConfig({ CUBID_OIDC_ISSUER: ISSUER, FUNDLOOP_CROSS_APP_AUDIENCE: "fundloop" })).toEqual({
      issuer: ISSUER,
      audience: "fundloop",
      jwksUri: `${ISSUER}/jwks`,
    })
    expect(crossAppConfig({ CUBID_OIDC_ISSUER: ISSUER })).toBeNull()
    expect(crossAppConfig({ FUNDLOOP_CROSS_APP_AUDIENCE: "fundloop" })).toBeNull()
    expect(crossAppConfig({})).toBeNull()
  })

  it("treats a blank value as absent rather than as an issuer", () => {
    expect(crossAppConfig({ CUBID_OIDC_ISSUER: "   ", FUNDLOOP_CROSS_APP_AUDIENCE: "fundloop" })).toBeNull()
    expect(crossAppConfig({ CUBID_OIDC_ISSUER: ISSUER, FUNDLOOP_CROSS_APP_AUDIENCE: " " })).toBeNull()
  })

  it("refuses an issuer that is not HTTPS, because it cannot be trusted to sign anything", () => {
    expect(crossAppConfig({ CUBID_OIDC_ISSUER: "http://id.cubid.me", FUNDLOOP_CROSS_APP_AUDIENCE: "fundloop" })).toBeNull()
  })

  it("allows a loopback issuer, for developing against a local Cubid", () => {
    for (const issuer of ["http://localhost:3100", "http://127.0.0.1:3100", "http://[::1]:3100"]) {
      expect(crossAppConfig({ CUBID_OIDC_ISSUER: issuer, FUNDLOOP_CROSS_APP_AUDIENCE: "fundloop" })).toMatchObject({ issuer })
    }
  })

  it("takes an explicit JWKS URI when the issuer does not serve it at the default path", () => {
    const config = crossAppConfig({
      CUBID_OIDC_ISSUER: ISSUER,
      FUNDLOOP_CROSS_APP_AUDIENCE: "fundloop",
      CUBID_OIDC_JWKS_URI: "https://keys.cubid.me/set",
    })
    expect(config?.jwksUri).toBe("https://keys.cubid.me/set")
  })
})

describe("crossAppReceiverConfig", () => {
  it("needs FundLoop's own client id at Cubid, which a Security Event Token is addressed to", () => {
    expect(crossAppReceiverConfig({ CUBID_OIDC_ISSUER: ISSUER, FUNDLOOP_CUBID_CLIENT_ID: "cubid_fundloop" })).toEqual({
      issuer: ISSUER,
      clientId: "cubid_fundloop",
      jwksUri: `${ISSUER}/jwks`,
    })
    expect(crossAppReceiverConfig({ CUBID_OIDC_ISSUER: ISSUER })).toBeNull()
  })

  it("does not depend on the resource audience, which comes from a pairing that may not exist yet", () => {
    const config = crossAppReceiverConfig({ CUBID_OIDC_ISSUER: ISSUER, FUNDLOOP_CUBID_CLIENT_ID: "cubid_fundloop" })
    expect(config).not.toBeNull()
    // The two values are different things, and reading one for the other would accept a token
    // addressed to somebody else.
    expect(config?.clientId).not.toBe("fundloop")
  })

  it("applies the same issuer rules as redemption", () => {
    expect(crossAppReceiverConfig({ CUBID_OIDC_ISSUER: "http://id.cubid.me", FUNDLOOP_CUBID_CLIENT_ID: "x" })).toBeNull()
    expect(crossAppReceiverConfig({ CUBID_OIDC_ISSUER: "  ", FUNDLOOP_CUBID_CLIENT_ID: "x" })).toBeNull()
  })
})

describe("cubidJwksCache", () => {
  it("reuses one cache per JWKS URI, so the refresh floor is shared by both verifiers", () => {
    const forRedemption = cubidJwksCache({ issuer: ISSUER, jwksUri: `${ISSUER}/jwks` })
    const forEvents = cubidJwksCache({ issuer: ISSUER, jwksUri: `${ISSUER}/jwks` })
    expect(forEvents).toBe(forRedemption)
    expect(cubidJwksCache({ issuer: ISSUER, jwksUri: "https://keys.cubid.me/set" })).not.toBe(forRedemption)
  })
})

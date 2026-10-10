import { describe, expect, it } from "vitest"
import {
  authorizationUrl,
  codeChallengeFor,
  newSignInRequestState,
  parseSignInRequestState,
  safeRedirectTarget,
} from "@/lib/auth/cubid-oidc-request"

// One Cubid authorization request (#275, stage 2c). Authorization Code with PKCE is the only grant
// Cubid offers for human login.

describe("safeRedirectTarget", () => {
  it("keeps a path on this site", () => {
    expect(safeRedirectTarget("/settings/account")).toBe("/settings/account")
    expect(safeRedirectTarget("/projects?tab=mine")).toBe("/projects?tab=mine")
  })

  it("refuses anything that could leave this site", () => {
    // `//evil.test` is a protocol-relative URL, not a path, which a bare startsWith("/") misses.
    for (const candidate of ["//evil.test", "https://evil.test", "http://evil.test", "evil.test", "/\\evil.test", null, ""]) {
      expect(safeRedirectTarget(candidate)).toBe("/")
    }
  })

  it("refuses a path carrying control characters, which could split a header", () => {
    expect(safeRedirectTarget("/projects\nLocation: https://evil.test")).toBe("/")
  })

  it("takes the caller's fallback", () => {
    expect(safeRedirectTarget(null, "/settings/account")).toBe("/settings/account")
  })
})

describe("newSignInRequestState", () => {
  it("gives every request its own state, nonce and verifier", () => {
    const first = newSignInRequestState({ intent: "sign_in", redirectTo: "/" })
    const second = newSignInRequestState({ intent: "sign_in", redirectTo: "/" })

    expect(first.state).not.toBe(second.state)
    expect(first.nonce).not.toBe(second.nonce)
    expect(first.codeVerifier).not.toBe(second.codeVerifier)
    // RFC 7636 §4.1: 43 to 128 characters of the unreserved alphabet.
    expect(first.codeVerifier).toMatch(/^[A-Za-z0-9_-]{43,128}$/)
  })

  it("will not carry an off-site destination through the round trip", () => {
    expect(newSignInRequestState({ intent: "link", redirectTo: "https://evil.test" }).redirectTo).toBe("/")
  })
})

describe("authorizationUrl", () => {
  const config = {
    authorizationEndpoint: "https://id.cubid.test/authorize",
    clientId: "cubid_fundloop",
    redirectUri: "https://www.fundloop.org/auth/cubid/callback",
  }

  it("asks for a code with PKCE, and never for an implicit token", async () => {
    const state = newSignInRequestState({ intent: "sign_in", redirectTo: "/" })
    const url = new URL(await authorizationUrl(config, state))

    expect(url.origin + url.pathname).toBe(config.authorizationEndpoint)
    expect(url.searchParams.get("response_type")).toBe("code")
    expect(url.searchParams.get("client_id")).toBe(config.clientId)
    expect(url.searchParams.get("redirect_uri")).toBe(config.redirectUri)
    expect(url.searchParams.get("scope")).toBe("openid email profile")
    expect(url.searchParams.get("code_challenge_method")).toBe("S256")
    expect(url.searchParams.get("state")).toBe(state.state)
    expect(url.searchParams.get("nonce")).toBe(state.nonce)
  })

  it("sends the challenge and never the verifier", async () => {
    const state = newSignInRequestState({ intent: "sign_in", redirectTo: "/" })
    const url = new URL(await authorizationUrl(config, state))

    expect(url.searchParams.get("code_challenge")).toBe(await codeChallengeFor(state.codeVerifier))
    expect(url.toString()).not.toContain(state.codeVerifier)
  })

  it("derives the challenge as the standard's S256, not as the verifier itself", async () => {
    // RFC 7636 appendix B's worked example.
    expect(await codeChallengeFor("dBjftJeZ4CVP-mB92K27uhbUJU1p1r_wW1gFWFOEjXk")).toBe(
      "E9Melhoa2OwvFrEMTJguCHaoeK1t8URWbuGJSstw-cM",
    )
  })
})

describe("parseSignInRequestState", () => {
  it("round-trips what the start route stored", () => {
    const state = newSignInRequestState({ intent: "link", redirectTo: "/settings/account" })
    expect(parseSignInRequestState(JSON.stringify(state))).toEqual(state)
  })

  it("treats a missing, malformed or incomplete cookie as no request at all", () => {
    for (const raw of [undefined, "", "not json", "[]", '{"state":"a"}', '{"state":"a","nonce":"b"}']) {
      expect(parseSignInRequestState(raw)).toBeNull()
    }
  })

  it("re-checks the destination on the way out, not only on the way in", () => {
    const tampered = '{"state":"a","nonce":"b","codeVerifier":"c","intent":"sign_in","redirectTo":"https://evil.test"}'
    expect(parseSignInRequestState(tampered)?.redirectTo).toBe("/")
  })

  it("defaults an unrecognised intent to signing in, which needs no session", () => {
    const raw = '{"state":"a","nonce":"b","codeVerifier":"c","intent":"something-else","redirectTo":"/"}'
    expect(parseSignInRequestState(raw)?.intent).toBe("sign_in")
  })
})

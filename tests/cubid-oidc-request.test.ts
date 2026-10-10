import { describe, expect, it } from "vitest"
import {
  authorizationUrl,
  codeChallengeFor,
  newSignInRequestState,
  openSignInRequestState,
  parseSignInRequestState,
  safeRedirectTarget,
  sealSignInRequestState,
  signInCookieName,
  CUBID_SIGN_IN_COOKIE,
  CUBID_SIGN_IN_COOKIE_INSECURE,
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

  it("records whose link it is, so the callback can require the same account", () => {
    const state = newSignInRequestState({ intent: "link", redirectTo: "/settings/account", linkingUserId: "user-1" })
    expect(state.linkingUserId).toBe("user-1")
  })

  it("does not record an account for a sign-in, which has none yet", () => {
    const state = newSignInRequestState({ intent: "sign_in", redirectTo: "/", linkingUserId: "user-1" })
    expect(state.linkingUserId).toBeUndefined()
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

  it("keeps the linking account through the round trip", () => {
    const raw = '{"state":"a","nonce":"b","codeVerifier":"c","intent":"link","linkingUserId":"user-1","redirectTo":"/settings/account"}'
    expect(parseSignInRequestState(raw)?.linkingUserId).toBe("user-1")
  })

  it("ignores a linking account on a sign-in, which cannot be bound to one", () => {
    const raw = '{"state":"a","nonce":"b","codeVerifier":"c","intent":"sign_in","linkingUserId":"user-1","redirectTo":"/"}'
    expect(parseSignInRequestState(raw)?.linkingUserId).toBeUndefined()
  })

  it("defaults an unrecognised intent to signing in, which needs no session", () => {
    const raw = '{"state":"a","nonce":"b","codeVerifier":"c","intent":"something-else","redirectTo":"/"}'
    expect(parseSignInRequestState(raw)?.intent).toBe("sign_in")
  })
})

describe("sealing the pending request into a cookie", () => {
  const secret = "a".repeat(32)

  it("round-trips a sealed request", async () => {
    const state = newSignInRequestState({ intent: "link", redirectTo: "/settings/account", linkingUserId: "user-1" })
    expect(await openSignInRequestState(await sealSignInRequestState(state, secret), secret)).toEqual(state)
  })

  it("refuses a request planted by anyone without the secret", async () => {
    // A sibling host under the registrable domain can write this browser's cookie jar. A state,
    // nonce and verifier it chose would be login CSRF: lure the person to a crafted callback and
    // they are signed in as somebody else's Cubid identity.
    const planted = newSignInRequestState({ intent: "sign_in", redirectTo: "/" })
    expect(await openSignInRequestState(await sealSignInRequestState(planted, "b".repeat(32)), secret)).toBeNull()
  })

  it("refuses a sealed request whose contents were edited", async () => {
    const state = newSignInRequestState({ intent: "link", redirectTo: "/", linkingUserId: "user-1" })
    const sealed = await sealSignInRequestState(state, secret)
    const [, signature] = sealed.split(".")
    const forged = btoa(JSON.stringify({ ...state, linkingUserId: "somebody-else" }))
      .replace(/\+/g, "-")
      .replace(/\//g, "_")
      .replace(/=+$/, "")
    expect(await openSignInRequestState(`${forged}.${signature}`, secret)).toBeNull()
  })

  it("refuses anything that is not a sealed request at all", async () => {
    for (const raw of [undefined, "", "no-dot", "payload.", ".signature", "not base64!.also not"]) {
      expect(await openSignInRequestState(raw, secret)).toBeNull()
    }
  })

  it("uses the __Host- prefix on https, where a browser enforces it", () => {
    // The prefix is only accepted for a Secure, Path=/, Domain-less cookie, which is what stops a
    // sibling host setting this name.
    expect(signInCookieName(true)).toBe(CUBID_SIGN_IN_COOKIE)
    expect(CUBID_SIGN_IN_COOKIE.startsWith("__Host-")).toBe(true)
    // Local development over http cannot set one, so it falls back and reads accept both.
    expect(signInCookieName(false)).toBe(CUBID_SIGN_IN_COOKIE_INSECURE)
  })
})

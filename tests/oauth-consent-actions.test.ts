import { beforeEach, describe, expect, it, vi } from "vitest"

// The consent decision (#266 stage 2). A tampered form must only ever narrow what is granted.

const store = {
  readAuthorizationRequest: vi.fn(),
  approveAuthorizationRequest: vi.fn(),
  denyAuthorizationRequest: vi.fn(),
}
const getUser = vi.fn()

vi.mock("@/lib/oauth/store", () => store)
vi.mock("@/lib/supabase-server", () => ({
  createServerSupabaseClient: async () => ({ auth: { getUser } }),
}))

// next/navigation's redirect throws to unwind the request; this records the target instead.
class RedirectError extends Error {
  constructor(public url: string) {
    super(`redirect:${url}`)
  }
}
vi.mock("next/navigation", () => ({
  redirect: (url: string) => {
    throw new RedirectError(url)
  },
}))

const actions = async () => import("@/app/actions/oauth-consent-actions")

async function redirectTarget(run: () => Promise<unknown>) {
  try {
    await run()
  } catch (error) {
    if (error instanceof RedirectError) return new URL(error.url, "https://www.fundloop.org")
    throw error
  }
  throw new Error("expected a redirect")
}

function form(entries: Array<[string, string]>) {
  const data = new FormData()
  for (const [key, value] of entries) data.append(key, value)
  return data
}

const request = {
  id: 3,
  client_id: "wondrbot",
  redirect_uri: "https://wondrbot.example/callback",
  scopes: ["profile:read", "awards:read"],
  state: "client-state",
  code_challenge: "c".repeat(43),
  code_challenge_method: "S256",
  expires_at: new Date(Date.now() + 60_000).toISOString(),
  consumed_at: null,
}

describe("approveOAuthConsent", () => {
  beforeEach(() => {
    vi.resetModules()
    for (const fn of Object.values(store)) fn.mockReset()
    getUser.mockReset()
    getUser.mockResolvedValue({ data: { user: { id: "user-1", email: "person@example.org" } }, error: null })
    store.readAuthorizationRequest.mockResolvedValue(request)
    store.approveAuthorizationRequest.mockResolvedValue({ ok: true, code: "issued-code", redirectUri: request.redirect_uri, state: request.state })
  })

  it("sends the code and the client's state back to the registered redirect", async () => {
    const { approveOAuthConsent } = await actions()
    const target = await redirectTarget(() => approveOAuthConsent(form([["request", "token"], ["locale", "en"], ["scope", "profile:read"], ["scope", "awards:read"]])))

    expect(`${target.origin}${target.pathname}`).toBe(request.redirect_uri)
    expect(target.searchParams.get("code")).toBe("issued-code")
    expect(target.searchParams.get("state")).toBe("client-state")
  })

  it("grants only the scopes the person left ticked", async () => {
    const { approveOAuthConsent } = await actions()
    await redirectTarget(() => approveOAuthConsent(form([["request", "token"], ["locale", "en"], ["scope", "profile:read"]])))

    expect(store.approveAuthorizationRequest).toHaveBeenCalledWith({ requestToken: "token", userId: "user-1", scopes: ["profile:read"] })
  })

  it("ignores a submitted scope the client never requested", async () => {
    const { approveOAuthConsent } = await actions()
    // The decisive values are re-read from the stored request, so a tampered field cannot widen it.
    const target = await redirectTarget(() =>
      approveOAuthConsent(form([["request", "token"], ["locale", "fr"], ["scope", "profile:read"], ["scope", "payout-routes:read"]])),
    )

    expect(store.approveAuthorizationRequest).not.toHaveBeenCalled()
    expect(target.pathname).toBe("/fr/oauth/consent")
    expect(target.searchParams.get("error")).toBe("scope")
  })

  it("will not record a decision for a signed-out visitor", async () => {
    getUser.mockResolvedValue({ data: { user: null }, error: null })
    const { approveOAuthConsent } = await actions()
    const target = await redirectTarget(() => approveOAuthConsent(form([["request", "token"], ["locale", "en"]])))

    expect(target.searchParams.get("error")).toBe("session")
    expect(store.approveAuthorizationRequest).not.toHaveBeenCalled()
  })

  it("reports an expired request on the consent page rather than at the client", async () => {
    store.readAuthorizationRequest.mockResolvedValue(null)
    const { approveOAuthConsent } = await actions()
    const target = await redirectTarget(() => approveOAuthConsent(form([["request", "token"], ["locale", "en"]])))
    expect(target.pathname).toBe("/en/oauth/consent")
    expect(target.searchParams.get("error")).toBe("expired")
  })

  it("passes a lost race back to the client as server_error", async () => {
    store.approveAuthorizationRequest.mockResolvedValue({ ok: false, reason: "race" })
    const { approveOAuthConsent } = await actions()
    const target = await redirectTarget(() => approveOAuthConsent(form([["request", "token"], ["locale", "en"], ["scope", "profile:read"]])))
    expect(`${target.origin}${target.pathname}`).toBe(request.redirect_uri)
    expect(target.searchParams.get("error")).toBe("server_error")
    expect(target.searchParams.get("state")).toBe("client-state")
  })
})

describe("denyOAuthConsent", () => {
  beforeEach(() => {
    vi.resetModules()
    for (const fn of Object.values(store)) fn.mockReset()
    getUser.mockReset()
  })

  it("tells the client the person declined, with their state", async () => {
    store.denyAuthorizationRequest.mockResolvedValue({ redirectUri: request.redirect_uri, state: "client-state" })
    const { denyOAuthConsent } = await actions()
    const target = await redirectTarget(() => denyOAuthConsent(form([["request", "token"], ["locale", "en"]])))

    // RFC 6749 §4.1.2.1.
    expect(target.searchParams.get("error")).toBe("access_denied")
    expect(target.searchParams.get("state")).toBe("client-state")
  })

  it("needs no signed-in user to refuse", async () => {
    store.denyAuthorizationRequest.mockResolvedValue({ redirectUri: request.redirect_uri, state: null })
    const { denyOAuthConsent } = await actions()
    await redirectTarget(() => denyOAuthConsent(form([["request", "token"], ["locale", "en"]])))
    expect(getUser).not.toHaveBeenCalled()
  })
})

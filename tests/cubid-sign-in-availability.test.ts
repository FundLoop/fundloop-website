import { afterEach, describe, expect, it, vi } from "vitest"
import { readContractFile } from "./support/sql-text"

// Whether the Sign in with Cubid action is reachable at all (#275, stage 2c UI).
//
// Two wiring mistakes made the whole flow dead, and neither showed up in a test of the pieces:
// the routes were being locale-redirected away from their handlers, and the only people who would
// use the action — signed-out visitors — were told it was unavailable.

describe("the anonymous navigation context", () => {
  it("derives Cubid availability rather than hardcoding it false", () => {
    // A signed-out visitor gets emptyNavigationContext(), and that is exactly who the sign-in
    // action is for. A literal `false` there hides the action from everybody who needs it.
    const source = readContractFile("lib/navigation-context.ts")
    expect(source).not.toContain("cubidSignInAvailable: false")
    expect(source.match(/cubidSignInAvailable: crossAppSignInConfig\(\) !== null/g)).toHaveLength(2)
  })
})

describe("the account page's link status", () => {
  afterEach(() => {
    vi.resetModules()
    vi.unstubAllEnvs()
  })

  it("does not reach for an admin client on a deployment without Cubid", async () => {
    // Constructing one throws where no service-role key is configured, which local and preview
    // deployments support by design — and the panel renders nothing there anyway, so asking would
    // fail the whole account page for no benefit.
    vi.stubEnv("CUBID_OIDC_ISSUER", "")
    vi.stubEnv("FUNDLOOP_CUBID_CLIENT_ID", "")
    vi.stubEnv("SUPABASE_SERVICE_ROLE_KEY", "")
    const { getCubidSignInLinkStatus } = await import("@/lib/auth/cubid-link-status")

    await expect(getCubidSignInLinkStatus("11111111-1111-4111-8111-111111111111")).resolves.toEqual({
      available: false,
      linked: false,
      linkedAt: null,
      lastSeenAt: null,
    })
  })

  it("has nothing to look up without a user", async () => {
    const { getCubidSignInLinkStatus } = await import("@/lib/auth/cubid-link-status")
    await expect(getCubidSignInLinkStatus(null)).resolves.toMatchObject({ linked: false })
  })
})

describe("the sign-in action", () => {
  it("navigates rather than fetching, because the flow is a redirect", () => {
    const source = readContractFile("components/auth-modal.tsx")
    expect(source).toContain("window.location.assign(`/auth/cubid/start")
    expect(source).toContain("cubidSignInAvailable")
  })

  it("is only offered where the deployment is configured", () => {
    const source = readContractFile("components/auth-modal.tsx")
    expect(source).toContain("{!otpSent && cubidSignInAvailable && (")
  })
})

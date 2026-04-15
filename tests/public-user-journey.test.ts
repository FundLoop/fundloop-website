import { describe, expect, it } from "vitest"
import { getPublicUserCtaState, getPublicUserPrimaryHref } from "@/lib/public-user-journey"
import type { NavigationContext } from "@/lib/navigation-context"

function buildContext(overrides: Partial<NavigationContext> = {}): NavigationContext {
  return {
    user: null,
    isAuthenticated: false,
    hasWorkspaceAccess: false,
    hasFounderAccess: false,
    hasAdminAccess: false,
    managedProjects: [],
    ...overrides,
  }
}

describe("public user journey helpers", () => {
  it("sends signed-out users to user onboarding", () => {
    const context = buildContext()

    expect(getPublicUserCtaState(context)).toBe("signed_out")
    expect(getPublicUserPrimaryHref(context)).toBe("/?onboarding=user")
  })

  it("sends signed-in inactive users back into onboarding", () => {
    const context = buildContext({
      isAuthenticated: true,
      hasWorkspaceAccess: true,
      user: {
        id: "user-1",
        email: "person@example.com",
        fullName: "Person Example",
        avatarUrl: null,
        status: "inactive",
        cubidIdentityStatus: "unlinked",
        cubidId: null,
        primaryEmailIdentity: null,
        cubidScore: null,
      },
    })

    expect(getPublicUserCtaState(context)).toBe("continue_onboarding")
    expect(getPublicUserPrimaryHref(context)).toBe("/?onboarding=user")
  })

  it("sends active users into the workspace", () => {
    const context = buildContext({
      isAuthenticated: true,
      hasWorkspaceAccess: true,
      user: {
        id: "user-1",
        email: "person@example.com",
        fullName: "Person Example",
        avatarUrl: null,
        status: "active",
        cubidIdentityStatus: "linked",
        cubidId: "cubid-user-1",
        primaryEmailIdentity: null,
        cubidScore: 88,
      },
    })

    expect(getPublicUserCtaState(context)).toBe("workspace")
    expect(getPublicUserPrimaryHref(context)).toBe("/workspace")
  })
})

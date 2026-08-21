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
    cubidPassportOrigin: null,
    cubidStampPageId: null,
    ...overrides,
  }
}

function buildUser(overrides: Partial<NonNullable<NavigationContext["user"]>> = {}): NonNullable<NavigationContext["user"]> {
  return {
    id: "user-1",
    email: "person@example.com",
    fullName: "Person Example",
    avatarUrl: null,
    status: "active",
    cubidIdentityStatus: "unlinked",
    cubidId: null,
    primaryEmailIdentity: null,
    cubidScore: null,
    cubidSnapshot: null,
    managedIdentity: {
      fullName: { value: null, state: "pending" },
      primaryEmail: { value: null, state: "pending" },
      primaryPhone: { value: null, state: "pending" },
    },
    identityOwnership: {
      cubidManaged: ["full_name", "email", "phone"],
      fundloopManaged: ["display_name", "bio"],
    },
    localProfile: {
      displayName: null,
      profileHeadline: null,
      bio: null,
      occupationName: null,
      locationName: null,
      interestCount: 0,
      interestNames: [],
      visibility: {
        isPublic: false,
        isNamePublic: false,
        isPfpPublic: false,
        isGenderPublic: false,
        isOccupationPublic: false,
        isLocationPublic: false,
      },
    },
    profileCompletionPercent: 0,
    profileCompletionMissingItems: [],
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
      user: buildUser({ status: "inactive" }),
    })

    expect(getPublicUserCtaState(context)).toBe("continue_onboarding")
    expect(getPublicUserPrimaryHref(context)).toBe("/?onboarding=user")
  })

  it("sends active users into the workspace", () => {
    const context = buildContext({
      isAuthenticated: true,
      hasWorkspaceAccess: true,
      user: buildUser({
        cubidIdentityStatus: "linked",
        cubidId: "cubid-user-1",
        cubidScore: 88,
        profileCompletionPercent: 20,
        profileCompletionMissingItems: ["cubid_phone", "cubid_provider"],
      }),
    })

    expect(getPublicUserCtaState(context)).toBe("workspace")
    expect(getPublicUserPrimaryHref(context)).toBe("/workspace")
  })
})

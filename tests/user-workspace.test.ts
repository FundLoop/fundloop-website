import { describe, expect, it } from "vitest"
import type { NavigationContext } from "@/lib/navigation-context"
import { buildUserWorkspaceHome } from "@/lib/workspace/user-workspace"

function navigationContext(overrides: Partial<NavigationContext["user"]> = {}): NavigationContext {
  return {
    user: {
      id: "user-1",
      email: "maya@example.com",
      fullName: "Maya Torres",
      avatarUrl: null,
      status: "active",
      cubidIdentityStatus: "linked",
      cubidId: "cubid-user-1",
      primaryEmailIdentity: "maya@example.com",
      cubidScore: 82,
      cubidSnapshot: null,
      managedIdentity: {
        fullName: { value: "Maya Torres", state: "synced" },
        primaryEmail: { value: "maya@example.com", state: "synced" },
        primaryPhone: { value: null, state: "pending" },
      },
      identityOwnership: {
        cubidManaged: ["full_name", "email"],
        fundloopManaged: ["display_name", "bio"],
      },
      localProfile: {
        displayName: "Maya",
        profileHeadline: "Builder",
        bio: "Bio",
        occupationName: "Designer",
        locationName: "Toronto",
        interestCount: 2,
        interestNames: ["Climate", "Open source"],
        visibility: {
          isPublic: true,
          isNamePublic: true,
          isPfpPublic: true,
          isGenderPublic: false,
          isOccupationPublic: true,
          isLocationPublic: true,
        },
      },
      profileCompletionPercent: 70,
      profileCompletionMissingItems: ["cubid_phone"],
      ...overrides,
    },
    isAuthenticated: true,
    hasWorkspaceAccess: true,
    hasFounderAccess: false,
    hasAdminAccess: false,
    managedProjects: [],
    cubidPassportOrigin: "https://passport.cubid.me",
    cubidStampPageId: "123",
  }
}

describe("buildUserWorkspaceHome", () => {
  it("builds calm empty states for an active user with no project participation", () => {
    const home = buildUserWorkspaceHome({
      navigationContext: navigationContext(),
      participantRows: [],
      joinedProjects: [],
      recommendedProjects: [
        {
          id: 10,
          slug: "solar-commons",
          name: "Solar Commons",
          description: "Community solar project",
          logo_url: null,
        },
      ],
      publishedResults: [],
      runs: [],
      warnings: [],
    })

    expect(home.profileStatus).toMatchObject({
      signedInEmail: "maya@example.com",
      cubidStatus: "linked",
      completionPercent: 70,
      missingItems: ["cubid_phone"],
    })
    expect(home.participation.joinedProjectCount).toBe(0)
    expect(home.participation.hasUnavailableProjectDetails).toBe(false)
    expect(home.participation.recentProjects).toEqual([])
    expect(home.discovery.recommendedProjects).toHaveLength(1)
    expect(home.results.latest).toBeNull()
  })

  it("summarizes joined projects, favorites, founder-admin participation, and published results", () => {
    const home = buildUserWorkspaceHome({
      navigationContext: navigationContext({ cubidIdentityStatus: "verified", profileCompletionPercent: 100, profileCompletionMissingItems: [] }),
      participantRows: [
        {
          project_id: 2,
          is_admin: true,
          is_favorite: false,
          joined_at: "2026-04-02T00:00:00Z",
        },
        {
          project_id: 1,
          is_admin: false,
          is_favorite: true,
          joined_at: "2026-04-01T00:00:00Z",
        },
      ],
      joinedProjects: [
        {
          id: 1,
          slug: "open-gardens",
          name: "Open Gardens",
          description: "Garden coordination",
          logo_url: null,
        },
        {
          id: 2,
          slug: "solar-commons",
          name: "Solar Commons",
          description: "Solar coordination",
          logo_url: null,
        },
      ],
      recommendedProjects: [],
      publishedResults: [
        {
          allocation_usd: 125,
          aggregate_score: 220,
          published_at: "2026-04-10T00:00:00Z",
          run_id: 7,
        },
        {
          allocation_usd: 75,
          aggregate_score: 180,
          published_at: "2026-03-10T00:00:00Z",
          run_id: 6,
        },
      ],
      runs: [
        { id: 7, month: "2026-04" },
        { id: 6, month: "2026-03" },
      ],
      warnings: [],
    })

    expect(home.profileStatus.cubidStatus).toBe("verified")
    expect(home.participation.joinedProjectCount).toBe(2)
    expect(home.participation.favoriteProjectCount).toBe(1)
    expect(home.participation.founderProjectCount).toBe(1)
    expect(home.participation.hasUnavailableProjectDetails).toBe(false)
    expect(home.participation.recentProjects[0]?.name).toBe("Solar Commons")
    expect(home.results.latest).toMatchObject({
      allocationUsd: 125,
      aggregateScore: 220,
      monthLabel: "2026-04",
    })
    expect(home.results.totalAllocationUsd).toBe(200)
    expect(home.results.resultCount).toBe(2)
  })

  it("preserves non-fatal read warnings for the page to render softly", () => {
    const home = buildUserWorkspaceHome({
      navigationContext: navigationContext(),
      participantRows: [],
      joinedProjects: [],
      recommendedProjects: [],
      publishedResults: [],
      runs: [],
      warnings: [{ scope: "results", message: "network unavailable" }],
    })

    expect(home.warnings).toEqual([{ scope: "results", message: "network unavailable" }])
    expect(home.results.detailHref).toBe("/settings/zkas")
  })

  it("excludes participant rows without hydrated non-deleted projects from counters", () => {
    const home = buildUserWorkspaceHome({
      navigationContext: navigationContext(),
      participantRows: [
        {
          project_id: 1,
          is_admin: true,
          is_favorite: true,
          joined_at: "2026-04-01T00:00:00Z",
        },
        {
          project_id: 99,
          is_admin: true,
          is_favorite: true,
          joined_at: "2026-04-02T00:00:00Z",
        },
      ],
      joinedProjects: [
        {
          id: 1,
          slug: "open-gardens",
          name: "Open Gardens",
          description: "Garden coordination",
          logo_url: null,
        },
      ],
      recommendedProjects: [],
      publishedResults: [],
      runs: [],
      warnings: [],
    })

    expect(home.participation.joinedProjectCount).toBe(1)
    expect(home.participation.favoriteProjectCount).toBe(1)
    expect(home.participation.founderProjectCount).toBe(1)
    expect(home.participation.recentProjects).toHaveLength(1)
  })

  it("flags temporarily unavailable project details without inflating counters", () => {
    const home = buildUserWorkspaceHome({
      navigationContext: navigationContext(),
      participantRows: [
        {
          project_id: 1,
          is_admin: true,
          is_favorite: true,
          joined_at: "2026-04-01T00:00:00Z",
        },
      ],
      joinedProjects: [],
      recommendedProjects: [],
      publishedResults: [],
      runs: [],
      warnings: [{ scope: "joined-projects", message: "network unavailable" }],
    })

    expect(home.participation.joinedProjectCount).toBe(0)
    expect(home.participation.hasUnavailableProjectDetails).toBe(true)
    expect(home.participation.recentProjects).toEqual([])
  })
})

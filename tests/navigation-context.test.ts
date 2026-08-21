import { beforeEach, describe, expect, it, vi } from "vitest"

const authGetUser = vi.fn()
const usersMaybeSingle = vi.fn()
const cubidSnapshotMaybeSingle = vi.fn()
const interestCountEq = vi.fn()
const participantsSelect = vi.fn()
const rolesSelect = vi.fn()
const membershipsSelect = vi.fn()
const projectsSelect = vi.fn()
const locationMaybeSingle = vi.fn()
const occupationMaybeSingle = vi.fn()
const interestRefsIn = vi.fn()
const internalAdminCheck = vi.fn()
const getAdminSupabaseClient = vi.fn()
const createServerSupabaseClient = vi.fn()

vi.mock("@/lib/supabase-server", () => ({
  createServerSupabaseClient,
}))

vi.mock("@/lib/supabase-admin", () => ({
  getAdminSupabaseClient: getAdminSupabaseClient.mockImplementation(() => ({
    from(table: string) {
      if (table === "users") {
        return {
          select: () => ({
            eq: () => ({
              maybeSingle: usersMaybeSingle,
            }),
          }),
        }
      }

      if (table === "cubid_identity_snapshots") {
        return {
          select: () => ({
            eq: () => ({
              maybeSingle: cubidSnapshotMaybeSingle,
            }),
          }),
        }
      }

      if (table === "user_interests") {
        return {
          select: (...args: unknown[]) => ({
            eq: (...eqArgs: unknown[]) => {
              const [fields] = args
              if (fields === "interest_id") {
                return Promise.resolve({
                  data: [{ interest_id: 11 }, { interest_id: 12 }],
                })
              }

              return interestCountEq(...eqArgs)
            },
          }),
        }
      }

      if (table === "participants") {
        return {
          select: participantsSelect,
        }
      }

      if (table === "ref_roles") {
        return {
          select: rolesSelect,
        }
      }

      if (table === "organization_members") {
        return {
          select: membershipsSelect,
        }
      }

      if (table === "projects") {
        return {
          select: projectsSelect,
        }
      }

      if (table === "ref_locations") {
        return {
          select: () => ({
            eq: () => ({
              maybeSingle: locationMaybeSingle,
            }),
          }),
        }
      }

      if (table === "ref_occupations") {
        return {
          select: () => ({
            eq: () => ({
              maybeSingle: occupationMaybeSingle,
            }),
          }),
        }
      }

      if (table === "ref_interests") {
        return {
          select: () => ({
            in: interestRefsIn,
          }),
        }
      }

      throw new Error(`Unexpected table ${table}`)
    },
  })),
}))

vi.mock("@/lib/zkas/auth", () => ({
  isInternalAdminEmail: internalAdminCheck,
}))

describe("getNavigationContext", () => {
  beforeEach(() => {
    vi.resetModules()
    getAdminSupabaseClient.mockReset()
    createServerSupabaseClient.mockReset()
    authGetUser.mockReset()
    usersMaybeSingle.mockReset()
    cubidSnapshotMaybeSingle.mockReset()
    interestCountEq.mockReset()
    participantsSelect.mockReset()
    rolesSelect.mockReset()
    membershipsSelect.mockReset()
    projectsSelect.mockReset()
    locationMaybeSingle.mockReset()
    occupationMaybeSingle.mockReset()
    interestRefsIn.mockReset()
    internalAdminCheck.mockReset()

    getAdminSupabaseClient.mockImplementation(() => ({
      from(table: string) {
        if (table === "users") {
          return {
            select: () => ({
              eq: () => ({
                maybeSingle: usersMaybeSingle,
              }),
            }),
          }
        }

        if (table === "cubid_identity_snapshots") {
          return {
            select: () => ({
              eq: () => ({
                maybeSingle: cubidSnapshotMaybeSingle,
              }),
            }),
          }
        }

        if (table === "user_interests") {
          return {
            select: (...args: unknown[]) => ({
              eq: (...eqArgs: unknown[]) => {
                const [fields] = args
                if (fields === "interest_id") {
                  return Promise.resolve({
                    data: [{ interest_id: 11 }, { interest_id: 12 }],
                  })
                }

                return interestCountEq(...eqArgs)
              },
            }),
          }
        }

        if (table === "participants") {
          return {
            select: participantsSelect,
          }
        }

        if (table === "ref_roles") {
          return {
            select: rolesSelect,
          }
        }

        if (table === "organization_members") {
          return {
            select: membershipsSelect,
          }
        }

        if (table === "projects") {
          return {
            select: projectsSelect,
          }
        }

        if (table === "ref_locations") {
          return {
            select: () => ({
              eq: () => ({
                maybeSingle: locationMaybeSingle,
              }),
            }),
          }
        }

        if (table === "ref_occupations") {
          return {
            select: () => ({
              eq: () => ({
                maybeSingle: occupationMaybeSingle,
              }),
            }),
          }
        }

        if (table === "ref_interests") {
          return {
            select: () => ({
              in: interestRefsIn,
            }),
          }
        }

        throw new Error(`Unexpected table ${table}`)
      },
    }))

    createServerSupabaseClient.mockResolvedValue({
      auth: {
        getUser: authGetUser,
      },
    })
    cubidSnapshotMaybeSingle.mockResolvedValue({ data: null })
    interestCountEq.mockResolvedValue({ count: 0 })
    locationMaybeSingle.mockResolvedValue({ data: null })
    occupationMaybeSingle.mockResolvedValue({ data: null })
    interestRefsIn.mockResolvedValue({ data: [] })
  })

  it("builds workspace, founder, and admin access from existing repo signals", async () => {
    authGetUser.mockResolvedValue({
      data: {
        user: {
          id: "user-1",
          email: "admin@example.com",
        },
      },
    })
    usersMaybeSingle.mockResolvedValue({
      data: {
        full_name: "Case Founder",
        display_name: "Case",
        avatar_url: null,
        status: "active",
        bio: "Bio",
        profile_headline: "Trustworthy builder",
        occupation_id: 1,
        location_id: 2,
        is_public: true,
        is_name_public: true,
        is_pfp_public: true,
        is_gender_public: false,
        is_occupation_public: true,
        is_location_public: true,
        cubid_identity_status: "verified",
        cubid_id: "cubid-user-1",
        primary_email_identity: "auth-identity-1",
        cubid_score: 92,
      },
    })
    cubidSnapshotMaybeSingle.mockResolvedValue({
      data: {
        user_id: "user-1",
        cubid_user_id: "cubid-user-1",
        primary_name: "Case Founder",
        primary_email: "maya@example.com",
        primary_phone: "+15555550123",
        cubid_score: 92,
        available_stamp_types: ["email", "phone", "github"],
        verified_stamp_types: ["email", "phone"],
        raw_identity: {},
        raw_stamps: [],
        last_synced_at: "2026-04-15T12:00:00.000Z",
        last_sync_error_code: null,
        last_sync_error_message: null,
      },
    })
    interestCountEq.mockResolvedValue({ count: 2 })
    locationMaybeSingle.mockResolvedValue({ data: { name: "Toronto" } })
    occupationMaybeSingle.mockResolvedValue({ data: { name: "Engineer" } })
    interestRefsIn.mockResolvedValue({
      data: [
        { id: 11, name: "Open source" },
        { id: 12, name: "Transit" },
      ],
    })
    participantsSelect.mockReturnValue({
      eq: (_field: string, _value: string | boolean) => ({
        eq: (_nextField: string, _nextValue: boolean) =>
          Promise.resolve({
            data: [{ project_id: 2 }, { project_id: 5 }],
          }),
      }),
    })
    rolesSelect.mockReturnValue({
      in: () =>
        Promise.resolve({
          data: [{ id: 41 }, { id: 42 }],
        }),
    })
    membershipsSelect.mockReturnValue({
      eq: (_field: string, _value: string | number) => ({
        eq: (_nextField: string, _nextValue: string) => ({
          in: () =>
            Promise.resolve({
              data: [{ organization_id: 9 }],
            }),
        }),
      }),
    })
    projectsSelect.mockImplementation(() => ({
      in: (field: string, values: number[]) =>
        Promise.resolve({
          data:
            field === "id"
              ? [
                  { id: 2, slug: "alpha", name: "Alpha", organization_id: 7 },
                  { id: 5, slug: "beta", name: "Beta", organization_id: 9 },
                ]
              : [{ id: 7, slug: "gamma", name: "Gamma", organization_id: 9 }],
        }),
    }))
    internalAdminCheck.mockReturnValue(true)

    const { getNavigationContext } = await import("@/lib/navigation-context")
    const context = await getNavigationContext()

    expect(context.isAuthenticated).toBe(true)
    expect(context.hasWorkspaceAccess).toBe(true)
    expect(context.hasFounderAccess).toBe(true)
    expect(context.hasAdminAccess).toBe(true)
    expect(context.user).toEqual(
      expect.objectContaining({
        cubidIdentityStatus: "verified",
        cubidId: "cubid-user-1",
        primaryEmailIdentity: "auth-identity-1",
        cubidScore: 92,
        profileCompletionPercent: 90,
        profileCompletionMissingItems: ["cubid_provider"],
      }),
    )
    expect(context.managedProjects).toEqual([
      { id: 2, slug: "alpha", name: "Alpha" },
      { id: 5, slug: "beta", name: "Beta" },
      { id: 7, slug: "gamma", name: "Gamma" },
    ])
  })

  it("falls back to the authenticated server client when admin env is unavailable", async () => {
    getAdminSupabaseClient.mockImplementation(() => {
      throw new Error("Supabase admin environment variables are not configured.")
    })

    const usersMaybeSingleFallback = vi.fn().mockResolvedValue({
      data: {
        full_name: "Fallback Founder",
        display_name: "Fallback",
        avatar_url: null,
        status: "inactive",
        bio: null,
        profile_headline: null,
        occupation_id: null,
        location_id: null,
        is_public: false,
        is_name_public: false,
        is_pfp_public: false,
        is_gender_public: false,
        is_occupation_public: false,
        is_location_public: false,
        cubid_identity_status: "unlinked",
        cubid_id: null,
        primary_email_identity: null,
        cubid_score: null,
      },
    })
    const cubidSnapshotMaybeSingleFallback = vi.fn().mockResolvedValue({ data: null })
    const interestCountEqFallback = vi.fn().mockResolvedValue({ count: 0 })
    const participantsSelectFallback = vi.fn().mockReturnValue({
      eq: (_field: string, _value: string | boolean) => ({
        eq: (_nextField: string, _nextValue: boolean) =>
          Promise.resolve({
            data: [{ project_id: 3 }],
          }),
      }),
    })
    const rolesSelectFallback = vi.fn().mockReturnValue({
      in: () =>
        Promise.resolve({
          data: [{ id: 41 }],
        }),
    })
    const membershipsSelectFallback = vi.fn().mockReturnValue({
      eq: (_field: string, _value: string | number) => ({
        eq: (_nextField: string, _nextValue: string) => ({
          in: () =>
            Promise.resolve({
              data: [{ organization_id: 8 }],
            }),
        }),
      }),
    })
    const projectsSelectFallback = vi.fn().mockImplementation(() => ({
      in: (field: string, _values: number[]) =>
        Promise.resolve({
          data:
            field === "id"
              ? [{ id: 3, slug: "fallback", name: "Fallback", organization_id: 8 }]
              : [{ id: 9, slug: "orbit", name: "Orbit", organization_id: 8 }],
        }),
    }))

    authGetUser.mockResolvedValue({
      data: {
        user: {
          id: "user-2",
          email: "founder@example.com",
        },
      },
    })

    const fallbackSupabase = {
      auth: {
        getUser: authGetUser,
      },
      from(table: string) {
        if (table === "users") {
          return {
            select: () => ({
              eq: () => ({
                maybeSingle: usersMaybeSingleFallback,
              }),
            }),
          }
        }

        if (table === "participants") {
          return {
            select: participantsSelectFallback,
          }
        }

        if (table === "cubid_identity_snapshots") {
          return {
            select: () => ({
              eq: () => ({
                maybeSingle: cubidSnapshotMaybeSingleFallback,
              }),
            }),
          }
        }

        if (table === "user_interests") {
          return {
            select: (...args: unknown[]) => ({
              eq: (...eqArgs: unknown[]) => {
                const [fields] = args
                if (fields === "interest_id") {
                  return Promise.resolve({ data: [] })
                }

                return interestCountEqFallback(...eqArgs)
              },
            }),
          }
        }

        if (table === "ref_roles") {
          return {
            select: rolesSelectFallback,
          }
        }

        if (table === "organization_members") {
          return {
            select: membershipsSelectFallback,
          }
        }

        if (table === "projects") {
          return {
            select: projectsSelectFallback,
          }
        }

        if (table === "ref_locations") {
          return {
            select: () => ({
              eq: () => ({
                maybeSingle: vi.fn().mockResolvedValue({ data: null }),
              }),
            }),
          }
        }

        if (table === "ref_occupations") {
          return {
            select: () => ({
              eq: () => ({
                maybeSingle: vi.fn().mockResolvedValue({ data: null }),
              }),
            }),
          }
        }

        if (table === "ref_interests") {
          return {
            select: () => ({
              in: vi.fn().mockResolvedValue({ data: [] }),
            }),
          }
        }

        throw new Error(`Unexpected fallback table ${table}`)
      },
    }

    createServerSupabaseClient.mockResolvedValue(fallbackSupabase)
    internalAdminCheck.mockReturnValue(false)

    const { getNavigationContext } = await import("@/lib/navigation-context")
    const context = await getNavigationContext()

    expect(context.isAuthenticated).toBe(true)
    expect(context.user?.fullName).toBe("Fallback Founder")
    expect(context.hasFounderAccess).toBe(true)
    expect(context.hasAdminAccess).toBe(false)
    expect(context.managedProjects).toEqual([
      { id: 3, slug: "fallback", name: "Fallback" },
      { id: 9, slug: "orbit", name: "Orbit" },
    ])
  })
})

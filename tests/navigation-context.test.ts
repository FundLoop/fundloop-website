import { beforeEach, describe, expect, it, vi } from "vitest"

const authGetUser = vi.fn()
const usersMaybeSingle = vi.fn()
const participantsSelect = vi.fn()
const rolesSelect = vi.fn()
const membershipsSelect = vi.fn()
const projectsSelect = vi.fn()
const internalAdminCheck = vi.fn()

vi.mock("@/lib/supabase-server", () => ({
  createServerSupabaseClient: vi.fn(async () => ({
    auth: {
      getUser: authGetUser,
    },
  })),
}))

vi.mock("@/lib/supabase-admin", () => ({
  getAdminSupabaseClient: vi.fn(() => ({
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
    authGetUser.mockReset()
    usersMaybeSingle.mockReset()
    participantsSelect.mockReset()
    rolesSelect.mockReset()
    membershipsSelect.mockReset()
    projectsSelect.mockReset()
    internalAdminCheck.mockReset()
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
        avatar_url: null,
        status: "active",
      },
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
    expect(context.managedProjects).toEqual([
      { id: 2, slug: "alpha", name: "Alpha" },
      { id: 5, slug: "beta", name: "Beta" },
      { id: 7, slug: "gamma", name: "Gamma" },
    ])
  })
})

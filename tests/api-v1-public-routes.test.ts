import { beforeEach, describe, expect, it, vi } from "vitest"
import { NextRequest } from "next/server"
import { shouldSkipLocaleRouting } from "@/i18n/proxy-helpers"

const getPublicProjectsDirectoryData = vi.fn()
const maybeSingle = vi.fn()

vi.mock("@/lib/public-discovery", () => ({ getPublicProjectsDirectoryData }))

vi.mock("@/lib/supabase-server", () => ({
  createServerSupabaseClient: async () => ({
    from: (table: string) => ({
      select: () => ({
        eq: () => ({
          order: () => ({ limit: () => ({ maybeSingle: () => maybeSingle(table) }) }),
          maybeSingle: () => maybeSingle(table),
        }),
      }),
    }),
  }),
}))

function project(slug: string, createdAt: string, overrides: Record<string, unknown> = {}) {
  return {
    id: Number(slug.replace(/\D/g, "")) || 1,
    slug,
    name: `Project ${slug}`,
    description: "desc",
    detailedDescription: "detail",
    isPublic: true,
    logoUrl: null,
    website: null,
    categoryId: null,
    categoryName: "Technology",
    createdAt,
    participantCount: 3,
    ...overrides,
  }
}

const projectsRoute = async () => (await import("@/app/api/v1/projects/route")).GET
const cycleRoute = async () => (await import("@/app/api/v1/projects/[projectId]/cycle/route")).GET

describe("GET /api/v1/projects", () => {
  beforeEach(() => {
    vi.resetModules()
    getPublicProjectsDirectoryData.mockReset()
    maybeSingle.mockReset()
  })

  it("returns stable string ids, no token required, newest first", async () => {
    getPublicProjectsDirectoryData.mockResolvedValue({
      categories: [],
      projects: [project("alpha", "2026-01-01T00:00:00Z"), project("beta", "2026-05-01T00:00:00Z")],
    })
    const response = await (await projectsRoute())(new NextRequest("https://fundloop.org/api/v1/projects"))
    expect(response.status).toBe(200)
    const body = (await response.json()) as { data: Array<{ id: string; member_count: number; created_at: string }>; meta: { next_cursor: string | null } }
    expect(body.data.map((entry) => entry.id)).toEqual(["beta", "alpha"])
    expect(body.data[0].member_count).toBe(3)
    expect(body.data[0].created_at).toBe("2026-05-01T00:00:00.000Z")
    expect(body.meta.next_cursor).toBeNull()
  })

  it("paginates by opaque cursor without repeating or skipping", async () => {
    const projects = ["a", "b", "c"].map((slug, index) => project(slug, `2026-0${index + 1}-01T00:00:00Z`))
    getPublicProjectsDirectoryData.mockResolvedValue({ categories: [], projects })

    const first = await (await projectsRoute())(new NextRequest("https://fundloop.org/api/v1/projects?limit=2"))
    const firstBody = (await first.json()) as { data: Array<{ id: string }>; meta: { next_cursor: string } }
    expect(firstBody.data.map((entry) => entry.id)).toEqual(["c", "b"])
    expect(firstBody.meta.next_cursor).toBeTruthy()
    expect(firstBody.meta.next_cursor).not.toContain("{")

    const second = await (await projectsRoute())(
      new NextRequest(`https://fundloop.org/api/v1/projects?limit=2&cursor=${encodeURIComponent(firstBody.meta.next_cursor)}`),
    )
    const secondBody = (await second.json()) as { data: Array<{ id: string }>; meta: { next_cursor: string | null } }
    expect(secondBody.data.map((entry) => entry.id)).toEqual(["a"])
    expect(secondBody.meta.next_cursor).toBeNull()
  })

  it("rejects an unknown cursor and a bad limit with validation_failed", async () => {
    getPublicProjectsDirectoryData.mockResolvedValue({ categories: [], projects: [project("alpha", "2026-01-01T00:00:00Z")] })
    const badCursor = await (await projectsRoute())(
      new NextRequest(`https://fundloop.org/api/v1/projects?cursor=${Buffer.from('{"after_id":"gone"}', "utf8").toString("base64url")}`),
    )
    expect(badCursor.status).toBe(422)
    expect(((await badCursor.json()) as { error: { code: string } }).error.code).toBe("validation_failed")

    const badLimit = await (await projectsRoute())(new NextRequest("https://fundloop.org/api/v1/projects?limit=abc"))
    expect(badLimit.status).toBe(422)
  })

  it("answers internal_error without leaking the cause", async () => {
    getPublicProjectsDirectoryData.mockRejectedValue(new Error("connection string postgres://secret@host"))
    const response = await (await projectsRoute())(new NextRequest("https://fundloop.org/api/v1/projects"))
    expect(response.status).toBe(500)
    const body = (await response.json()) as { error: { code: string; message: string } }
    expect(body.error.code).toBe("internal_error")
    expect(body.error.message).not.toContain("postgres://")
  })
})

describe("GET /api/v1/projects/{projectId}/cycle", () => {
  beforeEach(() => {
    vi.resetModules()
    getPublicProjectsDirectoryData.mockReset()
    maybeSingle.mockReset()
    getPublicProjectsDirectoryData.mockResolvedValue({ categories: [], projects: [project("alpha", "2026-01-01T00:00:00Z")] })
  })

  it("returns the latest cycle with network totals as minor-unit strings", async () => {
    maybeSingle.mockImplementation((table: string) =>
      table === "epoch_close_public_project_view"
        ? {
          data: {
            cycle_key: "2026-08",
            status: "closed",
            root_hash: "a".repeat(64),
            funded_minor: 123456,
            published_cohort_count: 7,
            source_count: 2,
            cap_multiple: 3,
            harvested_unclaimed_minor: "900",
            created_at: "2026-09-01T00:00:00Z",
          },
          error: null,
        }
        : {
          data: { status: "closed", published_user_count: 42, funded_minor: "999", final_allocation_minor: 998, returned_residue_minor: null },
          error: null,
        },
    )

    const response = await (await cycleRoute())(new Request("https://fundloop.org/api/v1/projects/alpha/cycle"), {
      params: Promise.resolve({ projectId: "alpha" }),
    })
    expect(response.status).toBe(200)
    const body = (await response.json()) as { data: Record<string, unknown> & { network: Record<string, unknown> } }
    expect(body.data).toMatchObject({
      project_id: "alpha",
      cycle_key: "2026-08",
      status: "closed",
      funded_usd_minor: "123456",
      harvested_unclaimed_usd_minor: "900",
      cap_multiple: "3",
      created_at: "2026-09-01T00:00:00.000Z",
    })
    expect(body.data.network).toMatchObject({ published_user_count: 42, funded_usd_minor: "999", returned_residue_usd_minor: "0" })
  })

  it("returns data: null when the project has no closed cycle", async () => {
    maybeSingle.mockResolvedValue({ data: null, error: null })
    const response = await (await cycleRoute())(new Request("https://fundloop.org/api/v1/projects/alpha/cycle"), {
      params: Promise.resolve({ projectId: "alpha" }),
    })
    expect(response.status).toBe(200)
    await expect(response.json()).resolves.toEqual({ data: null })
  })

  it("404s for a project that is not publicly listed", async () => {
    const response = await (await cycleRoute())(new Request("https://fundloop.org/api/v1/projects/private/cycle"), {
      params: Promise.resolve({ projectId: "private" }),
    })
    expect(response.status).toBe(404)
    expect(((await response.json()) as { error: { code: string } }).error.code).toBe("not_found")
  })
})

describe("locale routing leaves machine endpoints alone", () => {
  it.each([
    "/api/v1/projects",
    "/api/v1/projects/alpha/cycle",
    "/api/v1/openapi.json",
    "/api/internal/health",
    "/oauth/authorize",
    "/oauth/token",
    "/.well-known/oauth-authorization-server",
  ])("skips %s", (pathname) => {
    expect(shouldSkipLocaleRouting(pathname)).toBe(true)
  })

  it.each(["/", "/projects", "/workspace/account", "/apidocs"])("still localises %s", (pathname) => {
    expect(shouldSkipLocaleRouting(pathname)).toBe(false)
  })
})

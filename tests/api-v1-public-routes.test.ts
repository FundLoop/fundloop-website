import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { NextRequest } from "next/server"
import { shouldSkipLocaleRouting } from "@/i18n/proxy-helpers"

const loadPublicProjectsPage = vi.fn()
const loadPublicProjectRef = vi.fn()
const maybeSingle = vi.fn()

vi.mock("@/lib/public-discovery", () => ({ loadPublicProjectsPage, loadPublicProjectRef }))

// The public reads use a stateless anon client, never the caller's cookie-bound session.
vi.mock("@/lib/supabase-public-read", () => ({
  getPublicReadSupabaseClient: () => ({
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

function project(slug: string, id: number, createdAt: string) {
  return {
    id,
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
  }
}

const projectsRoute = async () => (await import("@/app/api/v1/projects/route")).GET
const cycleRoute = async () => (await import("@/app/api/v1/projects/[projectId]/cycle/route")).GET

const originalDeploymentEnv = process.env.FUNDLOOP_DEPLOYMENT_ENV

describe("GET /api/v1/projects", () => {
  beforeEach(() => {
    vi.resetModules()
    loadPublicProjectsPage.mockReset()
    maybeSingle.mockReset()
  })

  it("returns stable string ids, no token required", async () => {
    loadPublicProjectsPage.mockResolvedValue({
      projects: [project("beta", 2, "2026-05-01T00:00:00Z"), project("alpha", 1, "2026-01-01T00:00:00Z")],
      hasMore: false,
    })
    const response = await (await projectsRoute())(new NextRequest("https://fundloop.org/api/v1/projects"))
    expect(response.status).toBe(200)
    const body = (await response.json()) as { data: Array<{ id: string; member_count: number; created_at: string }>; meta: { next_cursor: string | null } }
    expect(body.data.map((entry) => entry.id)).toEqual(["beta", "alpha"])
    expect(body.data[0].member_count).toBe(3)
    expect(body.data[0].created_at).toBe("2026-05-01T00:00:00.000Z")
    expect(body.meta.next_cursor).toBeNull()
    // Tokenless and identical for every caller, so the edge may absorb repeat traffic.
    expect(response.headers.get("Cache-Control")).toBe("public, s-maxage=60, stale-while-revalidate=300")
  })

  it("asks the database for one page at a time and resumes from the cursor", async () => {
    loadPublicProjectsPage.mockResolvedValueOnce({ projects: [project("c", 3, "2026-03-01T00:00:00Z"), project("b", 2, "2026-02-01T00:00:00Z")], hasMore: true })
    const first = await (await projectsRoute())(new NextRequest("https://fundloop.org/api/v1/projects?limit=2"))
    const firstBody = (await first.json()) as { data: Array<{ id: string }>; meta: { next_cursor: string } }
    expect(firstBody.data.map((entry) => entry.id)).toEqual(["c", "b"])
    expect(loadPublicProjectsPage).toHaveBeenCalledWith({ limit: 2, afterId: null, search: null })
    expect(firstBody.meta.next_cursor).toBeTruthy()
    expect(firstBody.meta.next_cursor).not.toContain("{")

    loadPublicProjectsPage.mockResolvedValueOnce({ projects: [project("a", 1, "2026-01-01T00:00:00Z")], hasMore: false })
    const second = await (await projectsRoute())(
      new NextRequest(`https://fundloop.org/api/v1/projects?limit=2&cursor=${encodeURIComponent(firstBody.meta.next_cursor)}`),
    )
    const secondBody = (await second.json()) as { data: Array<{ id: string }>; meta: { next_cursor: string | null } }
    expect(secondBody.data.map((entry) => entry.id)).toEqual(["a"])
    // The cursor carries the last row's key, so the second page starts after it instead of
    // re-reading the directory from the top.
    expect(loadPublicProjectsPage).toHaveBeenLastCalledWith({ limit: 2, afterId: 2, search: null })
    expect(secondBody.meta.next_cursor).toBeNull()
  })

  it.each([
    ["a payload this version cannot read", Buffer.from('{"after_id":"gone"}', "utf8").toString("base64url")],
    ["an out-of-range key", Buffer.from('{"after_id":0}', "utf8").toString("base64url")],
    ["text that is not a cursor at all", "not-a-cursor"],
    // 1e21 is an integer to JavaScript but not a value PostgREST accepts for a bigint, so without
    // this the request failed as a 500 instead of being refused as a bad cursor.
    ["a key beyond the safe integer range", Buffer.from('{"after_id":1e21}', "utf8").toString("base64url")],
  ])("rejects %s instead of restarting the list", async (_label, cursor) => {
    loadPublicProjectsPage.mockResolvedValue({ projects: [project("alpha", 1, "2026-01-01T00:00:00Z")], hasMore: false })
    const response = await (await projectsRoute())(new NextRequest(`https://fundloop.org/api/v1/projects?cursor=${encodeURIComponent(cursor)}`))
    expect(response.status).toBe(422)
    expect(((await response.json()) as { error: { code: string } }).error.code).toBe("validation_failed")
    expect(loadPublicProjectsPage).not.toHaveBeenCalled()
  })

  it("rejects a non-numeric limit and clamps any digit string", async () => {
    const badLimit = await (await projectsRoute())(new NextRequest("https://fundloop.org/api/v1/projects?limit=abc"))
    expect(badLimit.status).toBe(422)

    // limit=101 and limit=10000 both mean "more than the maximum", so both clamp rather than one
    // clamping and the other failing on digit count.
    loadPublicProjectsPage.mockResolvedValue({ projects: [], hasMore: false })
    for (const limit of ["101", "10000"]) {
      const response = await (await projectsRoute())(new NextRequest(`https://fundloop.org/api/v1/projects?limit=${limit}`))
      expect(response.status).toBe(200)
      expect(loadPublicProjectsPage).toHaveBeenLastCalledWith({ limit: 100, afterId: null, search: null })
    }
  })

  it("keeps an unsupported method and an unknown path inside the error envelope", async () => {
    const posted = await (await import("@/app/api/v1/projects/route")).POST()
    expect(posted.status).toBe(405)
    expect(posted.headers.get("Allow")).toBe("GET")
    expect(((await posted.json()) as { error: { code: string; request_id: string } }).error.request_id).toMatch(/^fl_req_[0-9a-f]{32}$/)

    const unknown = await (await import("@/app/api/v1/[...unmatched]/route")).GET()
    expect(unknown.status).toBe(404)
    const body = (await unknown.json()) as { error: { code: string; message: string } }
    expect(body.error.code).toBe("not_found")
    expect(body.error.message).toContain("openapi.json")
  })

  it("answers internal_error without leaking the cause when the read fails", async () => {
    // A failed database read must not look like an empty directory.
    loadPublicProjectsPage.mockRejectedValue(new Error("connection string postgres://secret@host"))
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
    loadPublicProjectRef.mockReset()
    maybeSingle.mockReset()
    loadPublicProjectRef.mockResolvedValue({ id: 1, slug: "alpha" })
    process.env.FUNDLOOP_DEPLOYMENT_ENV = "test"
  })

  afterEach(() => {
    process.env.FUNDLOOP_DEPLOYMENT_ENV = originalDeploymentEnv
  })

  const cycleFor = async (projectId: string) =>
    (await cycleRoute())(new Request(`https://fundloop.org/api/v1/projects/${projectId}/cycle`), {
      params: Promise.resolve({ projectId }),
    })

  it("keeps amounts exact beyond the range of a double", async () => {
    // numeric(78,0) read as text: a value this size would be rounded by any float on the way here.
    const huge = "123456789012345678901234567890"
    maybeSingle.mockImplementation((table: string) =>
      table === "epoch_close_public_project_view"
        ? {
          data: {
            cycle_key: "2026-08",
            status: "payout_readying",
            root_hash: "a".repeat(64),
            funded_minor: huge,
            published_cohort_count: 7,
            source_count: 2,
            cap_multiple: "3.00",
            harvested_unclaimed_minor: "900",
            created_at: "2026-09-01T00:00:00Z",
          },
          error: null,
        }
        : { data: null, error: null },
    )

    const response = await cycleFor("alpha")
    expect(response.status).toBe(200)
    const body = (await response.json()) as { data: Record<string, unknown> & { network: Record<string, unknown> } }
    expect(body.data).toMatchObject({
      project_id: "alpha",
      cycle_key: "2026-08",
      status: "payout_readying",
      provisional: true,
      funded_usd_minor: huge,
      harvested_unclaimed_usd_minor: "900",
      cap_multiple: "3.00",
      published_cohort_count: 7,
      currency: "USD",
      created_at: "2026-09-01T00:00:00.000Z",
    })
    // Network-wide totals are not part of this surface: no FundLoop page renders them.
    expect(body.data).not.toHaveProperty("network")
  })

  it("passes withheld aggregates through as null rather than zero", async () => {
    maybeSingle.mockImplementation((table: string) =>
      table === "epoch_close_public_project_view"
        ? {
          data: {
            cycle_key: "2026-08",
            status: "payout_readying",
            root_hash: null,
            funded_minor: null,
            published_cohort_count: null,
            source_count: null,
            cap_multiple: null,
            harvested_unclaimed_minor: null,
            created_at: "2026-09-01T00:00:00Z",
          },
          error: null,
        }
        : { data: null, error: null },
    )

    const body = (await (await cycleFor("alpha")).json()) as { data: Record<string, unknown> & { network: Record<string, unknown> } }
    expect(body.data).toMatchObject({
      root_hash: null,
      funded_usd_minor: null,
      harvested_unclaimed_usd_minor: null,
      published_cohort_count: null,
      source_count: null,
      cap_multiple: null,
    })
    expect(body.data).not.toHaveProperty("network")
  })

  it("returns data: null when the project has no published cycle", async () => {
    maybeSingle.mockResolvedValue({ data: null, error: null })
    const response = await cycleFor("alpha")
    expect(response.status).toBe(200)
    await expect(response.json()).resolves.toEqual({ data: null })
  })

  it("publishes provisional figures only where the website publishes them", async () => {
    process.env.FUNDLOOP_DEPLOYMENT_ENV = "production"
    maybeSingle.mockResolvedValue({ data: { cycle_key: "2026-08" }, error: null })
    const response = await cycleFor("alpha")
    expect(response.status).toBe(200)
    await expect(response.json()).resolves.toEqual({ data: null })
    expect(maybeSingle).not.toHaveBeenCalled()
  })

  it("fails loudly when a cycle read fails", async () => {
    maybeSingle.mockImplementation(() => ({ data: null, error: { message: "cycle view unavailable" } }))
    const response = await cycleFor("alpha")
    expect(response.status).toBe(500)
    const body = (await response.json()) as { error: { code: string; message: string } }
    expect(body.error.code).toBe("internal_error")
    expect(body.error.message).not.toContain("cycle view unavailable")
  })

  it("caches a published cycle at the edge", async () => {
    maybeSingle.mockImplementation((table: string) =>
      table === "epoch_close_public_project_view"
        ? { data: { cycle_key: "2026-08", status: "payout_readying" }, error: null }
        : { data: null, error: null },
    )
    const response = await cycleFor("alpha")
    expect(response.headers.get("Cache-Control")).toBe("public, s-maxage=60, stale-while-revalidate=300")
  })

  it("404s for a project that is not publicly listed", async () => {
    loadPublicProjectRef.mockResolvedValue(null)
    const response = await cycleFor("private")
    expect(response.status).toBe(404)
    expect(((await response.json()) as { error: { code: string } }).error.code).toBe("not_found")
    expect(loadPublicProjectRef).toHaveBeenCalledWith("private")
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

  // Bare /api and /oauth have no handler, so they keep the locale handling every other unrouted
  // path gets instead of becoming a new kind of 404.
  it.each(["/", "/projects", "/workspace/account", "/apidocs", "/api", "/oauth"])("still localises %s", (pathname) => {
    expect(shouldSkipLocaleRouting(pathname)).toBe(false)
  })
})

import { beforeEach, describe, expect, it, vi } from "vitest"
import { loadPublicProjectRef, loadPublicProjectsPage } from "@/lib/public-discovery"

// The public API (#266) reads projects through these helpers, so the query itself is what matters:
// one page at a time, the public filters on every read, and database errors propagating.

type QueryState = {
  table: string
  columns?: string
  filters: Record<string, unknown>
  order?: { column: string; ascending?: boolean }
  limit?: number
  single?: boolean
}

const respond = vi.fn<(state: QueryState) => { data: unknown; error: unknown }>()
const queries: QueryState[] = []

function builder(table: string) {
  const state: QueryState = { table, filters: {} }
  const settle = () => {
    queries.push(state)
    return Promise.resolve(respond(state))
  }
  const api = {
    select: (columns: string) => {
      state.columns = columns
      return api
    },
    eq: (column: string, value: unknown) => {
      state.filters[`eq:${column}`] = value
      return api
    },
    is: (column: string, value: unknown) => {
      state.filters[`is:${column}`] = value
      return api
    },
    lt: (column: string, value: unknown) => {
      state.filters[`lt:${column}`] = value
      return api
    },
    in: (column: string, value: unknown) => {
      state.filters[`in:${column}`] = value
      return api
    },
    order: (column: string, options?: { ascending?: boolean }) => {
      state.order = { column, ...options }
      return api
    },
    limit: (count: number) => {
      state.limit = count
      return api
    },
    maybeSingle: () => {
      state.single = true
      return settle()
    },
    then: (resolve: (value: unknown) => unknown, reject?: (reason: unknown) => unknown) => settle().then(resolve, reject),
  }
  return api
}

vi.mock("@/lib/supabase-server", () => ({
  createServerSupabaseClient: async () => ({ from: (table: string) => builder(table) }),
}))


function row(id: number, slug: string | null, categoryId: number | null = null) {
  return {
    id,
    slug,
    name: `Project ${id}`,
    description: "desc",
    detailed_description: "detail",
    logo_url: null,
    website: null,
    category_id: categoryId,
    created_at: "2026-02-01T00:00:00Z",
  }
}

function queriesFor(table: string) {
  return queries.filter((query) => query.table === table)
}

describe("loadPublicProjectsPage", () => {
  beforeEach(() => {
    queries.length = 0
    respond.mockReset()
  })

  it("reads one page with the public filters and keeps the public/private boundary", async () => {
    respond.mockImplementation((state) => {
      if (state.table === "projects") return { data: [row(5, "e"), row(4, "d", 2), row(3, "c")], error: null }
      if (state.table === "ref_categories") return { data: [{ id: 2, name: "Technology" }], error: null }
      return { data: [{ project_id: 4, user_id: "u1" }, { project_id: 4, user_id: "u1" }, { project_id: 3, user_id: "u2" }], error: null }
    })

    const page = await loadPublicProjectsPage({ limit: 2 })

    expect(page.projects.map((project) => project.slug)).toEqual(["e", "d"])
    expect(page.hasMore).toBe(true)
    const projectsQuery = queriesFor("projects")[0]
    expect(projectsQuery.filters).toEqual({ "eq:status": "active", "eq:is_public": true, "is:deleted_at": null })
    expect(projectsQuery.order).toEqual({ column: "id", ascending: false })
    // One row beyond the page, which is how "is there a next page" is answered without counting.
    expect(projectsQuery.limit).toBe(3)
    // Members and categories are read for this page's rows only, never for the whole directory.
    expect(queriesFor("project_active_members")[0].filters["in:project_id"]).toEqual([5, 4])
    expect(queriesFor("ref_categories")[0].filters["in:id"]).toEqual([2])
    expect(page.projects[1].categoryName).toBe("Technology")
    // Duplicate member rows count once, as on the public directory.
    expect(page.projects[1].participantCount).toBe(1)
  })

  it("resumes after a cursor key instead of re-reading from the top", async () => {
    respond.mockImplementation((state) => (state.table === "projects" ? { data: [row(2, "b")], error: null } : { data: [], error: null }))

    const page = await loadPublicProjectsPage({ limit: 25, afterId: 3 })

    expect(queriesFor("projects")[0].filters["lt:id"]).toBe(3)
    expect(page.projects.map((project) => project.slug)).toEqual(["b"])
    expect(page.hasMore).toBe(false)
  })

  it("propagates a failed read instead of answering with an empty page", async () => {
    respond.mockImplementation(() => ({ data: null, error: { message: "projects unavailable" } }))
    await expect(loadPublicProjectsPage({ limit: 25 })).rejects.toThrow("projects unavailable")
  })

  it("keeps search matching the same fields the website matches", async () => {
    respond.mockImplementation((state) => {
      if (state.table === "projects") return { data: [row(9, "match"), row(8, "other")], error: null }
      if (state.table === "ref_categories") return { data: [], error: null }
      return { data: [], error: null }
    })

    const page = await loadPublicProjectsPage({ limit: 25, search: "detail" })

    // Category names and detailed descriptions are matched in application code, so a searched
    // listing ranges over the filtered directory rather than a narrower database filter.
    expect(page.projects.map((project) => project.slug)).toEqual(["match", "other"])
    expect(queriesFor("projects")[0].filters["lt:id"]).toBeUndefined()

    queries.length = 0
    const second = await loadPublicProjectsPage({ limit: 25, search: "detail", afterId: 9 })
    expect(second.projects.map((project) => project.slug)).toEqual(["other"])
  })
})

describe("loadPublicProjectRef", () => {
  beforeEach(() => {
    queries.length = 0
    respond.mockReset()
  })

  it("prefers an exact slug over a numeric id that spells the same string", async () => {
    respond.mockImplementation((state) => (state.filters["eq:slug"] === "123" ? { data: { id: 77, slug: "123" }, error: null } : { data: { id: 123, slug: "other" }, error: null }))

    await expect(loadPublicProjectRef("123")).resolves.toEqual({ id: 77, slug: "123" })
    expect(queriesFor("projects")).toHaveLength(1)
  })

  it("falls back to the numeric id a project without a slug is listed under", async () => {
    respond.mockImplementation((state) => ("eq:slug" in state.filters ? { data: null, error: null } : { data: { id: 42, slug: null }, error: null }))

    await expect(loadPublicProjectRef("42")).resolves.toEqual({ id: 42, slug: "42" })
    expect(queriesFor("projects")).toHaveLength(2)
  })

  it("does not look for a numeric id when the public id is not numeric", async () => {
    respond.mockImplementation(() => ({ data: null, error: null }))

    await expect(loadPublicProjectRef("missing-project")).resolves.toBeNull()
    expect(queriesFor("projects")).toHaveLength(1)
  })

  it("propagates a failed lookup", async () => {
    respond.mockImplementation(() => ({ data: null, error: { message: "projects unavailable" } }))
    await expect(loadPublicProjectRef("alpha")).rejects.toThrow("projects unavailable")
  })
})

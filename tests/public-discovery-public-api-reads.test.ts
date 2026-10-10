import { readFileSync } from "node:fs"
import { beforeEach, describe, expect, it, vi } from "vitest"
import { loadPublicProjectRef, loadPublicProjectsPage } from "@/lib/public-discovery"

// The public API (#266) reads projects through these helpers. Paging, searching and member counts
// run inside api_v1_public_projects_page, because PostgREST caps every read at 1,000 rows and a
// page assembled in application code would silently truncate.

const rpc = vi.fn()
const maybeSingle = vi.fn()
const projectsQuery: { filters: Record<string, unknown>; columns?: string } = { filters: {} }

vi.mock("@/lib/supabase-public-read", () => ({
  getPublicReadSupabaseClient: () => ({
    rpc: (name: string, args: Record<string, unknown>) => rpc(name, args),
    from: (table: string) => {
      projectsQuery.filters = { table }
      const builder = {
        select: (columns: string) => {
          projectsQuery.columns = columns
          return builder
        },
        eq: (column: string, value: unknown) => {
          projectsQuery.filters[`eq:${column}`] = value
          return builder
        },
        is: (column: string, value: unknown) => {
          projectsQuery.filters[`is:${column}`] = value
          return builder
        },
        limit: () => builder,
        maybeSingle: () => maybeSingle(),
      }
      return builder
    },
  }),
}))

function row(id: number, slug: string, overrides: Record<string, unknown> = {}) {
  return {
    id,
    slug,
    name: `Project ${id}`,
    description: "desc",
    logo_url: null,
    website: null,
    category_name: "Technology",
    created_at: "2026-02-01T00:00:00Z",
    member_count: 3,
    ...overrides,
  }
}

describe("loadPublicProjectsPage", () => {
  beforeEach(() => {
    rpc.mockReset()
    maybeSingle.mockReset()
  })

  it("asks the database for one page and one row beyond it", async () => {
    rpc.mockResolvedValue({ data: [row(5, "e"), row(4, "d"), row(3, "c")], error: null })

    const page = await loadPublicProjectsPage({ limit: 2 })

    // Absent arguments are omitted rather than passed as null, so the function's own defaults
    // apply and the call matches the generated signature.
    expect(rpc).toHaveBeenCalledWith("api_v1_public_projects_page", { p_limit: 3 })
    expect(page.projects.map((project) => project.slug)).toEqual(["e", "d"])
    expect(page.hasMore).toBe(true)
    expect(page.projects[0].participantCount).toBe(3)
    expect(page.projects[0].categoryName).toBe("Technology")
  })

  it("passes the cursor key and the search term to the read model", async () => {
    rpc.mockResolvedValue({ data: [row(2, "b")], error: null })

    const page = await loadPublicProjectsPage({ limit: 25, afterId: 3, search: " regen " })

    // The search runs in SQL against the same fields the website matches, so a match beyond the
    // first 1,000 rows is still reachable and member counts are never assembled from a capped read.
    expect(rpc).toHaveBeenCalledWith("api_v1_public_projects_page", { p_search: "regen", p_after_id: 3, p_limit: 26 })
    expect(page.hasMore).toBe(false)
    expect(page.projects.map((project) => project.slug)).toEqual(["b"])
  })

  it("counts members from the database value, including a bigint returned as text", async () => {
    rpc.mockResolvedValue({ data: [row(9, "i", { member_count: "1200" })], error: null })
    const page = await loadPublicProjectsPage({ limit: 25 })
    expect(page.projects[0].participantCount).toBe(1200)
  })

  it("propagates a failed read instead of answering with an empty page", async () => {
    rpc.mockResolvedValue({ data: null, error: { message: "projects unavailable" } })
    await expect(loadPublicProjectsPage({ limit: 25 })).rejects.toThrow("projects unavailable")
  })
})

describe("the search read model", () => {
  const migration = readFileSync("supabase/migrations/20261009130000_api_v1_public_projects_page.sql", "utf8")

  it("matches the joined fields, in the order the website joins them", () => {
    // projectMatchesSearch concatenates name, description, category name and detailed description
    // with spaces and then calls includes, so a term spanning two fields matches on the website. Per
    // field ILIKE clauses would miss it: "Alpha" described as "Beta" matches a search for
    // "alpha beta" on the site, and has to match here too.
    expect(migration).toContain("concat_ws(")
    const concatenation = migration.slice(migration.indexOf("concat_ws("), migration.indexOf("ilike v_pattern", migration.indexOf("concat_ws(")))
    const order = ["project.name", "project.description", "category.name", "project.detailed_description"]
    let cursor = -1
    for (const field of order) {
      const at = concatenation.indexOf(field)
      expect(at).toBeGreaterThan(cursor)
      cursor = at
    }
    // And one predicate, not four.
    expect(migration.match(/ilike v_pattern/g)).toHaveLength(1)
  })

  it("escapes the caller's wildcards so they match literally", () => {
    expect(migration).toContain("replace(replace(replace(v_search, '\\', '\\\\'), '%', '\\%'), '_', '\\_')")
  })

  it("excludes projects without a slug, which no public id can address", () => {
    expect(migration).toContain("project.slug is not null")
  })
})

describe("loadPublicProjectRef", () => {
  beforeEach(() => {
    rpc.mockReset()
    maybeSingle.mockReset()
    projectsQuery.filters = {}
  })

  it("resolves a public project by its slug, with the public filters applied", async () => {
    maybeSingle.mockResolvedValue({ data: { id: 7, slug: "alpha" }, error: null })

    await expect(loadPublicProjectRef("alpha")).resolves.toEqual({ id: 7, slug: "alpha" })
    expect(projectsQuery.filters).toMatchObject({
      table: "projects",
      "eq:status": "active",
      "eq:is_public": true,
      "is:deleted_at": null,
      "eq:slug": "alpha",
    })
  })

  it("does not resolve a numeric id, which could never match a cycle row", async () => {
    // epoch_close_public_project_view keys on the slug, so a numeric fallback id would be listed and
    // then never resolve to its cycle. The public id is the slug.
    maybeSingle.mockResolvedValue({ data: null, error: null })
    await expect(loadPublicProjectRef("42")).resolves.toBeNull()
    expect(projectsQuery.filters["eq:slug"]).toBe("42")
  })

  it("treats a row without a slug as unaddressable", async () => {
    maybeSingle.mockResolvedValue({ data: { id: 42, slug: null }, error: null })
    await expect(loadPublicProjectRef("42")).resolves.toBeNull()
  })

  it("propagates a failed lookup", async () => {
    maybeSingle.mockResolvedValue({ data: null, error: { message: "projects unavailable" } })
    await expect(loadPublicProjectRef("alpha")).rejects.toThrow("projects unavailable")
  })
})

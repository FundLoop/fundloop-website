import { readFileSync } from "node:fs"
import { describe, expect, it } from "vitest"

const read = (path: string) => readFileSync(path, "utf8")

describe("client surfaces after legacy table RLS", () => {
  it("gates the superadmin dashboard server-side and keeps its data off the browser client", () => {
    const page = read("app/[locale]/(app)/admin/superadmin/page.tsx")
    expect(page).not.toContain('"use client"')
    expect(page).toContain("await requireInternalAdminActor()")
    expect(page).toContain("notFound()")

    for (const component of ["users-table", "organizations-table", "audit-log-table", "invitation-attribution"]) {
      const source = read(`components/admin/${component}.tsx`)
      expect(source, component).not.toContain("getSupabaseBrowserClient")
      expect(source, component).not.toContain(".rpc(")
      expect(source, component).toContain('from "@/app/actions/superadmin-actions"')
    }

    const actions = read("app/actions/superadmin-actions.ts")
    expect(actions).toContain('"use server"')
    expect(actions).toContain("await requireInternalAdminActor()")
    const exported = actions.match(/export async function \w+/g) ?? []
    expect(exported.length).toBeGreaterThan(0)
    expect((actions.match(/return withAdmin\(/g) ?? []).length).toBe(exported.length)
  })

  it("never returns personal contact data from the onboarding project search", () => {
    const actions = read("app/actions/onboarding-actions.ts")
    const search = actions.slice(actions.indexOf("export async function searchProjectsForTeamMember"))
    const body = search.slice(0, search.indexOf("\nexport "))
    expect(body).toContain('rpc("search_projects_for_team_member"')
    expect(body).not.toContain('.from("users")')
    expect(body).toContain("contacts: []")
  })

  it("resolves invitation codes through the exact-match preview RPC", () => {
    const join = read("app/[locale]/(public)/join/page.tsx")
    expect(join).toContain('rpc("get_invitation_preview"')
    expect(join).not.toContain('.from("invitation_codes")')
    expect(join).not.toContain('.from("users")')
  })
})

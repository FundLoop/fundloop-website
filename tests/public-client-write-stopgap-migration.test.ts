import { readFileSync } from "node:fs"
import { describe, expect, it } from "vitest"

const sql = readFileSync("supabase/migrations/20260918120000_revoke_public_client_writes_stopgap.sql", "utf8")

describe("public client write stopgap migration", () => {
  it("revokes writes without touching client reads", () => {
    const revokes = sql.match(/REVOKE[^;]+;/g) ?? []
    expect(revokes.length).toBeGreaterThan(0)
    for (const statement of revokes) {
      if (/ON TABLE public\.supabase_deploy_context/.test(statement)) continue
      expect(statement, statement.slice(0, 80)).not.toMatch(/\bSELECT\b|\bREVOKE ALL\b/)
    }
    expect(sql).not.toMatch(/GRANT[^;]*\bSELECT\b/)
  })

  it("keeps the unguarded soft-delete functions away from clients", () => {
    expect(sql).toContain("REVOKE EXECUTE ON FUNCTION public.soft_delete_users(uuid) FROM PUBLIC, anon, authenticated")
    expect(sql).toContain("REVOKE EXECUTE ON FUNCTION public.soft_delete_organizations(bigint) FROM PUBLIC, anon, authenticated")
  })
})

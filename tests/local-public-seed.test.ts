import { readFileSync } from "node:fs"
import { resolve } from "node:path"
import { describe, expect, it } from "vitest"

const seedSql = readFileSync(resolve(process.cwd(), "supabase/seed.sql"), "utf8")

describe("local public discovery seed fixtures", () => {
  it("includes stable public project slugs for smoke coverage", () => {
    expect(seedSql).toContain("'civic-mesh'")
    expect(seedSql).toContain("'mutual-aid-atlas'")
    expect(seedSql).toContain("'open-transit-ledger'")
  })

  it("includes stable public user ids for profile smoke coverage", () => {
    expect(seedSql).toContain("'00000000-0000-4000-8000-000000000101'")
    expect(seedSql).toContain("'00000000-0000-4000-8000-000000000102'")
    expect(seedSql).toContain("'00000000-0000-4000-8000-000000000103'")
    expect(seedSql).toContain("'00000000-0000-4000-8000-000000000104'")
  })

  it("bumps the local project and user sequences past the curated fixtures", () => {
    expect(seedSql).toContain(`SELECT pg_catalog.setval('"public"."projects_id_seq1"', 103, true);`)
    expect(seedSql).toContain(`SELECT pg_catalog.setval('"public"."users_sequential_id_seq"', 104, true);`)
  })
})

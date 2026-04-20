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

  it("includes an authenticated founder fixture for workspace smoke coverage", () => {
    expect(seedSql).toContain(`INSERT INTO "auth"."users"`)
    expect(seedSql).toContain("'maya@fundloop.example.com'")
    expect(seedSql).toContain("crypt('FundLoopFounder123!', gen_salt('bf'))")
    expect(seedSql).toContain(`INSERT INTO "auth"."identities"`)
  })

  it("includes stable public blog slugs for listing and detail smoke coverage", () => {
    expect(seedSql).toContain("'why-monthly-cadence-matters'")
    expect(seedSql).toContain("'what-contributors-actually-need-from-a-project-directory'")
    expect(seedSql).toContain("'from-kyc-friction-to-trust-signals'")
  })

  it("bumps the local project and user sequences past the curated fixtures", () => {
    expect(seedSql).toContain(`SELECT pg_catalog.setval('"public"."projects_id_seq1"', 103, true);`)
    expect(seedSql).toContain(`SELECT pg_catalog.setval('"public"."users_sequential_id_seq"', 104, true);`)
    expect(seedSql).toContain(`SELECT pg_catalog.setval('"public"."blog_posts_id_seq"', 26, true);`)
  })
})

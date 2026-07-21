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

  it("includes explicit project commitment data for founder readiness smoke coverage", () => {
    expect(seedSql).toContain(`"payment_percentage", "default_reporting_currency_code"`)
    expect(seedSql).toContain(`'Civic Mesh'`)
    expect(seedSql).toContain(`'1.00', 'USD', '2', NULL, '1', '11'`)
    expect(seedSql).toContain(`'civic-mesh'`)
  })

  it("includes a deterministic monthly contribution submission fixture for MVP cycle readiness", () => {
    expect(seedSql).toContain(`INSERT INTO "public"."monthly_cycles"`)
    expect(seedSql).toContain(`'2026-05'`)
    expect(seedSql).toContain(`INSERT INTO "public"."project_monthly_contribution_submissions"`)
    expect(seedSql).toContain(`'seed-civic-mesh-2026-05-ledger'`)
  })

  it("includes deterministic CUBID linkage and snapshot fixtures for MVP identity readiness", () => {
    expect(seedSql).toContain(`'cubid-local-maya'`)
    expect(seedSql).toContain(`'cubid-local-eli'`)
    expect(seedSql).toContain(`"cubid_identity_status" = 'verified'`)
    expect(seedSql).toContain(`INSERT INTO "public"."cubid_identity_snapshots"`)
    expect(seedSql).toContain(`'scoped-cubid-local-eli'`)
    expect(seedSql).toContain(`'scoped-cubid-local-safiya'`)
    expect(seedSql).toContain(`'scoped-cubid-local-jonah'`)
  })

  it("includes an approved attribution dataset fixture for MVP calculation readiness", () => {
    expect(seedSql).toContain(`INSERT INTO "public"."project_attribution_datasets"`)
    expect(seedSql).toContain(`'Deterministic local MVP smoke attribution dataset for Civic Mesh May 2026.'`)
    expect(seedSql).toContain(`'raw_rows'`)
    expect(seedSql).toContain(`'not_required'`)
    expect(seedSql).toContain(`INSERT INTO "public"."project_attribution_rows"`)
    expect(seedSql).toContain(`'seed-civic-mesh-2026-05-attribution'`)
    expect(seedSql).toContain(`'50.000000'::numeric`)
    expect(seedSql).toContain(`'30.000000'::numeric`)
    expect(seedSql).toContain(`'20.000000'::numeric`)
  })

  it("includes deterministic user asset preference scenarios for MVP smoke coverage", () => {
    expect(seedSql).toContain(`INSERT INTO "public"."user_asset_preferences"`)
    expect(seedSql).toContain(`'stablecoin', 'USDC', NULL, 't'`)
    expect(seedSql).toContain(`'fiat', 'USD', NULL, 't'`)
    expect(seedSql).toContain(`'project_token', 'CIVIC', '101', 't'`)
    expect(seedSql).toContain(`'project_token', 'CIVIC', '101', 'f'`)
    expect(seedSql).toContain(`'project_token', 'ATLAS', '102', 'f'`)
  })

  it("includes stable public blog slugs for listing and detail smoke coverage", () => {
    expect(seedSql).toContain("'why-monthly-cadence-matters'")
    expect(seedSql).toContain("'what-contributors-actually-need-from-a-project-directory'")
    expect(seedSql).toContain("'from-kyc-friction-to-trust-signals'")
  })

  it("bumps the local project and user sequences past the curated fixtures", () => {
    expect(seedSql).toContain(`SELECT pg_catalog.setval('"public"."projects_id_seq1"', 103, true);`)
    expect(seedSql).toContain(`SELECT pg_catalog.setval('"public"."users_sequential_id_seq"', 104, true);`)
    expect(seedSql).toContain(`SELECT pg_catalog.setval('"public"."user_asset_preferences_id_seq"', 110, true);`)
    expect(seedSql).toContain(`SELECT pg_catalog.setval('"public"."project_attribution_datasets_id_seq"', 101, true);`)
    expect(seedSql).toContain(`SELECT pg_catalog.setval('"public"."project_attribution_rows_id_seq"', 103, true);`)
    expect(seedSql).toContain(`SELECT pg_catalog.setval('"public"."blog_posts_id_seq"', 26, true);`)
  })
})

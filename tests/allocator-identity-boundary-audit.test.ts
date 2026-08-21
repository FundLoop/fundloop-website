import { readFileSync } from "node:fs"
import { resolve } from "node:path"
import { describe, expect, test } from "vitest"

const root = process.cwd()
const read = (path: string) => readFileSync(resolve(root, path), "utf8")

const audit = read("docs/engineering/2026-08-13-allocator-identity-boundary-audit.md")
const improvementSuggestions = read("docs/project-reviews/2026-08-13-business-red-team/improvement-suggestions.md")
const attribution = read("supabase/migrations/20260720203000_project_attribution_datasets.sql")
const packages = read("supabase/migrations/20260809140000_epoch_project_packages.sql")
const allocation = read("supabase/migrations/20260809160000_epoch_funded_allocation.sql")
const legacyResults = read("supabase/migrations/20260721072000_mvp_allocation_results.sql")

describe("allocator identity-boundary audit evidence", () => {
  test("records and explicitly accepts the current FundLoop identity joins for the MVP", () => {
    expect(attribution).toMatch(/scoped_cubid_id text NOT NULL[\s\S]*user_id uuid[\s\S]*user_email text/)
    expect(packages).toMatch(/source_row_id bigint[\s\S]*user_id uuid NOT NULL[\s\S]*project_pseudonym text NOT NULL[\s\S]*locked_cubid_score/)
    expect(allocation).toMatch(/project_id bigint NOT NULL[\s\S]*user_id uuid NOT NULL[\s\S]*project_pseudonym text NOT NULL[\s\S]*locked_cubid_score/)
    expect(allocation).toMatch(/user_id uuid NOT NULL[\s\S]*project_claims jsonb NOT NULL/)
    expect(legacyResults).toMatch(/project_id integer NOT NULL[\s\S]*user_id uuid NOT NULL[\s\S]*scoped_cubid_id text NOT NULL/)

    for (const finding of ["APB-001", "APB-002", "APB-003", "APB-004", "APB-005", "APB-006", "APB-007"]) {
      expect(audit).toContain(`| ${finding} |`)
    }
    expect(audit).toContain("Result: **pass with required cross-repo follow-up**")
    expect(audit).toContain("FundLoop identity joins are accepted for the MVP")
    expect(audit).toContain("project claims                  # MVP only; replace with currency claims in v2")
  })

  test("keeps unavailable future flows separate from the approved conventional MVP", () => {
    expect(audit).toContain("The conventional scoped-identifier flow is the approved MVP")
    expect(audit).toContain("The alias-separated/ZK diagram remains future work")
    expect(audit).toContain("The consented email-list flow remains unavailable")
    expect(audit).toContain("Production value flow remains disabled")
  })

  test("binds the allocator contract to scoped identifiers and rejects unrelated identity", () => {
    for (const allowedField of [
      "project_scoped_uid",
      "fundloop_scoped_uid",
      "score_version / evidence hash",
      "currency",
    ]) {
      expect(audit).toContain(allowedField)
    }
    for (const forbiddenField of ["email, phone", "global Cubid account/user ID", "raw stamps", "project-membership"]) {
      expect(audit).toContain(forbiddenField)
    }
    expect(audit).toContain("There is no separate \"adjudicator\"")
  })

  test("defines the multi-repo split and v2 roadmap without requiring a separate MVP database", () => {
    expect(audit).toContain("Create a Feature tree for a private `cubid-allocator-api`")
    expect(audit).toContain("introduce explicit allocator-only tables/roles/contracts")
    expect(audit).toMatch(/add mandatory currency to allocator inputs, outputs, persisted artifacts, hashes, and replay\s+checks/)
    expect(audit).toContain("Replace project claims in allocator results with currency claims")
    expect(audit).toContain("A shared physical database is accepted for the MVP")
  })

  test("cross-references every allocator recommendation to MVP, Cubid, FundLoop, or v2 ownership", () => {
    expect(improvementSuggestions).toContain("### 2026-08-13 implementation and deferral map")
    expect(improvementSuggestions).toContain("**Accepted MVP bypass**")
    for (const issue of [
      "FundLoop/fundloop-website/issues/204",
      "FundLoop/fundloop-website/issues/188",
      "Cubid-Me/cubid-monorepo/issues/77",
      "Cubid-Me/cubid-monorepo/issues/79",
      "Cubid-Me/cubid-monorepo/issues/80",
      "Cubid-Me/cubid-monorepo/issues/81",
    ]) {
      expect(improvementSuggestions).toContain(issue)
    }
    expect(improvementSuggestions).toContain("FundLoop may retain the identity join before and after")
    expect(improvementSuggestions).toContain("Project claims become currency claims in privacy v2")
    expect(improvementSuggestions).toContain("Project membership/self-identification is not an")
    expect(improvementSuggestions).toContain("> allocator input")
  })
})

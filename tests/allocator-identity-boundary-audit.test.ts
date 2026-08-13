import { readFileSync } from "node:fs"
import { resolve } from "node:path"
import { describe, expect, test } from "vitest"

const root = process.cwd()
const read = (path: string) => readFileSync(resolve(root, path), "utf8")

const audit = read("docs/engineering/2026-08-13-allocator-identity-boundary-audit.md")
const attribution = read("supabase/migrations/20260720203000_project_attribution_datasets.sql")
const packages = read("supabase/migrations/20260809140000_epoch_project_packages.sql")
const allocation = read("supabase/migrations/20260809160000_epoch_funded_allocation.sql")
const legacyResults = read("supabase/migrations/20260721072000_mvp_allocation_results.sql")

describe("allocator identity-boundary audit evidence", () => {
  test("records the current cross-scope joins instead of certifying the candidate", () => {
    expect(attribution).toMatch(/scoped_cubid_id text NOT NULL[\s\S]*user_id uuid[\s\S]*user_email text/)
    expect(packages).toMatch(/source_row_id bigint[\s\S]*user_id uuid NOT NULL[\s\S]*project_pseudonym text NOT NULL[\s\S]*locked_cubid_score/)
    expect(allocation).toMatch(/project_id bigint NOT NULL[\s\S]*user_id uuid NOT NULL[\s\S]*project_pseudonym text NOT NULL[\s\S]*locked_cubid_score/)
    expect(allocation).toMatch(/user_id uuid NOT NULL[\s\S]*project_claims jsonb NOT NULL/)
    expect(legacyResults).toMatch(/project_id integer NOT NULL[\s\S]*user_id uuid NOT NULL[\s\S]*scoped_cubid_id text NOT NULL/)

    for (const finding of ["AIB-001", "AIB-002", "AIB-003", "AIB-004", "AIB-005", "AIB-006", "AIB-007", "AIB-008", "AIB-009", "AIB-010"]) {
      expect(audit).toContain(`| ${finding} |`)
    }
    expect(audit).toContain("Result: **fail — architectural remediation requires approval**")
  })

  test("accounts for all approved diagrams and keeps future flows unavailable", () => {
    expect(audit).toContain("## Diagram 1 — conventional scoped-identifier MVP")
    expect(audit).toContain("## Diagram 2 — alias-separated ZK flow")
    expect(audit).toContain("## Diagram 3 — consented email-list project flow")
    expect(audit).toContain("Every future-ZK arrow is unavailable")
    expect(audit).toContain("The consented email-list route is unavailable")
    expect(audit).toContain("Production value flow is disabled")
  })

  test("excludes external-only arrows from remediation reach", () => {
    expect(audit).toContain("## Remediation reach boundary")
    for (const externalArrow of [
      "Participant → Project",
      "Participant → CUBID",
      "Project → CUBID",
      "CUBID → Project",
    ]) {
      expect(audit).toContain(externalArrow)
    }
    expect(audit).toContain("may cover only FundLoop or allocator/adjudicator endpoints")
    expect(audit).toContain("Do not alter upstream Participant/Project/CUBID flows")
  })

  test("defines approval-gated remediation without changing allocation policy", () => {
    for (const task of [
      "R1 — Introduce scoped identity-link vault and token contracts",
      "R2 — Separate project attribution ingestion from FundLoop account resolution",
      "R3 — Rekey v2 allocator inputs/results behind the isolated contract",
      "R4 — Enforce scoped projections, operator access, retention, and backup hygiene",
    ]) {
      expect(audit).toContain(task)
    }
    expect(audit).toMatch(/Preserve all\s+cap, E−3, claim, FX, fee, and conservation semantics byte-for-byte at the policy layer/)
    expect(audit).toContain("Explicit user approval is required before inserting these Tasks")
  })
})

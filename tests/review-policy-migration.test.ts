import { readFileSync } from "node:fs"
import { describe, expect, it } from "vitest"

const migration = readFileSync("supabase/migrations/20260808230000_review_policy_versions_and_acceptances.sql", "utf8")

describe("review policy persistence boundary", () => {
  it("requires approval evidence before any document can be effective", () => {
    expect(migration).toContain("legal_document_effective_requires_approval")
    expect(migration).toContain("status <> 'effective' OR (approved_at IS NOT NULL AND effective_at IS NOT NULL)")
    expect(migration).not.toMatch(/VALUES \('terms'.*'effective'/)
  })

  it("records immutable actor, version, locale, status, timestamp, and source evidence", () => {
    for (const field of ["actor_user_id", "document_version_id", "document_identifier", "content_hash", "locale", "document_status", "actor_capacity", "source_surface", "accepted_at"]) {
      expect(migration).toContain(field)
    }
  })

  it("keeps writes behind the service-role command boundary", () => {
    expect(migration).toContain("REVOKE ALL ON FUNCTION public.record_review_policy_acknowledgement")
    expect(migration).toContain("GRANT EXECUTE ON FUNCTION public.record_review_policy_acknowledgement")
    expect(migration).toContain("TO service_role")
  })
})

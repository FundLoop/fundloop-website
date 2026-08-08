import { readFileSync } from "node:fs"
import { describe, expect, it } from "vitest"
import { privacyReviewDocument } from "@/lib/policies/review-policy"
import { publicProfileFields, validateProfilePublicationChoiceInput } from "@/lib/edge-functions/profile-publication-choice-contract"

const migration = readFileSync("supabase/migrations/20260808233000_profile_publication_consents.sql", "utf8")
describe("profile publication privacy boundary", () => {
  it("requires explicit fields for grant but permits withdrawal", () => {
    expect(validateProfilePublicationChoiceInput({ ...privacyReviewDocument, action: "grant", fields: [], sourceSurface: "account_profile_visibility" }).ok).toBe(false)
    expect(validateProfilePublicationChoiceInput({ ...privacyReviewDocument, action: "grant", fields: [...publicProfileFields], sourceSurface: "account_profile_visibility" }).ok).toBe(true)
    expect(validateProfilePublicationChoiceInput({ ...privacyReviewDocument, action: "withdraw", fields: [], sourceSurface: "account_profile_visibility" }).ok).toBe(true)
  })
  it("defaults profiles private and uses latest consent for discovery", () => {
    expect(migration).toContain("ALTER COLUMN is_public SET DEFAULT false")
    expect(migration).toContain("DISTINCT ON (consent.user_id)")
    expect(migration).toContain("latest.action = 'grant'")
    expect(migration).toContain("is_public = (p_action = 'grant')")
  })
  it("keeps audit writes service-role only while exposing only discoverable ids", () => {
    expect(migration).toContain("profile_publication_consents_self_select")
    expect(migration).toContain("GRANT EXECUTE ON FUNCTION public.record_profile_publication_choice")
    expect(migration).toContain("GRANT EXECUTE ON FUNCTION public.list_discoverable_public_user_ids() TO anon, authenticated, service_role")
  })
})


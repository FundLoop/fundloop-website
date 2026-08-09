import { readFileSync } from "node:fs"
import { describe, expect, it } from "vitest"
import { canReadInvitationReviewSharing } from "@/lib/policies/review-policy"
describe("Privacy review surfaces", () => {
  it("labels the preview and preserves unresolved provider and retention questions", () => {
    const route = readFileSync("app/[locale]/(public)/privacy/page.tsx", "utf8")
    expect(route).toContain("REVIEW_POLICY_BANNER")
    expect(route).toContain("No final retention period is promised")
    expect(route).toContain("provider roles")
  })
  it("requires consent evidence in public discovery and fails closed in production", () => {
    const discovery = readFileSync("lib/public-discovery.ts", "utf8")
    expect(discovery).toContain("list_discoverable_public_user_ids")
    expect(discovery).toContain("if (!isReviewPolicyPreviewEnabled()) return")
    expect(discovery).toContain('consentedFields.has("display_name")')
    expect(discovery).toContain('consentedFields.has("avatar")')
    expect(discovery).toContain("fullName: null")
    expect(discovery).toContain("contributionDetails: null")
    expect(discovery).toContain('.select("user_id, is_admin, users!inner(status)")')
    expect(discovery).toContain('.eq("users.status", "active")')
    const edge = readFileSync("supabase/functions/profile-publication-choice-record/index.ts", "utf8")
    expect(edge).toContain('FUNDLOOP_DEPLOYMENT_ENV") === "production"')
  })
  it("fails closed for invitation review reads in production even when preview is requested", () => {
    expect(canReadInvitationReviewSharing({
      NODE_ENV: "production", NEXT_PUBLIC_FUNDLOOP_DEPLOYMENT_ENV: "production", NEXT_PUBLIC_POLICY_REVIEW_PREVIEW: "1",
    })).toBe(false)
    const discovery = readFileSync("lib/public-discovery.ts", "utf8")
    expect(discovery).toContain("hasAccess && canReadInvitationReviewSharing()")
    expect(discovery).toContain("invokeProjectMemberSharedProfilesReadServer")
    expect(discovery).not.toContain('supabase.rpc("list_project_member_shared_profiles"')
    const edge = readFileSync("supabase/functions/project-member-shared-profiles-read/index.ts", "utf8")
    expect(edge).toContain('getEnv("FUNDLOOP_DEPLOYMENT_ENV") === "production"')
    expect(edge).toContain("actorUserId: auth.user.id")
  })
})

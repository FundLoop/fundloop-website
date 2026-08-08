import { describe, expect, it } from "vitest"
import { canActivatePolicyAsEffective, isReviewPolicyPreviewEnabled, REVIEW_POLICY_BANNER, termsReviewDocument } from "@/lib/policies/review-policy"
import { validatePolicyAcknowledgementInput } from "@/lib/edge-functions/policy-acknowledgement-contract"

describe("review policy gates", () => {
  it("keeps the review draft non-effective even when approval flags are accidentally present", () => {
    expect(canActivatePolicyAsEffective(termsReviewDocument, { NODE_ENV: "production", NEXT_PUBLIC_POLICY_PROFESSIONAL_APPROVALS_COMPLETE: "1", NEXT_PUBLIC_TERMS_EFFECTIVE_HASH: termsReviewDocument.contentHash })).toBe(false)
    expect(REVIEW_POLICY_BANNER).toBe("DRAFT - NOT APPROVED - NOT EFFECTIVE")
  })

  it("fails closed in production unless the explicit preview flag is enabled", () => {
    expect(isReviewPolicyPreviewEnabled({ NODE_ENV: "production" })).toBe(false)
    expect(isReviewPolicyPreviewEnabled({ NODE_ENV: "production", NEXT_PUBLIC_POLICY_REVIEW_PREVIEW: "1" })).toBe(true)
    expect(isReviewPolicyPreviewEnabled({ NODE_ENV: "development" })).toBe(true)
  })

  it("accepts only the immutable current review Terms metadata", () => {
    const valid = validatePolicyAcknowledgementInput({ ...termsReviewDocument, sourceSurface: "payout_preview", actorCapacity: "user" })
    expect(valid.ok).toBe(true)
    expect(validatePolicyAcknowledgementInput({ ...termsReviewDocument, contentHash: "0".repeat(64), sourceSurface: "payout_preview", actorCapacity: "user" }).ok).toBe(false)
    expect(validatePolicyAcknowledgementInput({ ...termsReviewDocument, status: "effective", sourceSurface: "project_funding_preview", actorCapacity: "project_actor" }).ok).toBe(false)
  })
})


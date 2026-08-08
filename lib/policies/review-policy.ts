export const REVIEW_POLICY_BANNER = "DRAFT - NOT APPROVED - NOT EFFECTIVE" as const

export type ReviewPolicyKind = "terms" | "privacy"
export type ReviewPolicyStatus = "review" | "effective"

export type ReviewPolicyDocument = {
  kind: ReviewPolicyKind
  documentId: string
  version: string
  contentHash: string
  status: ReviewPolicyStatus
  locale: "en-CA"
}

export const termsReviewDocument = {
  kind: "terms",
  documentId: "fundloop-terms-ca-review-draft-2026-08-08",
  version: "2026-08-08.review.1",
  contentHash: "5fdad9b8c1a73e4072612820d079e357e56abf0a217f499de84db2cd78b5aa20",
  status: "review",
  locale: "en-CA",
} as const satisfies ReviewPolicyDocument

export const privacyReviewDocument = {
  kind: "privacy",
  documentId: "fundloop-privacy-ca-review-draft-2026-08-08",
  version: "2026-08-08.review.1",
  contentHash: "97523eedf0c1cbf79b3cfd87eee42392815dd6458d45e1ceeaf68b2e859eb65a",
  status: "review",
  locale: "en-CA",
} as const satisfies ReviewPolicyDocument

export function isReviewPolicyPreviewEnabled(environment: Record<string, string | undefined> = process.env) {
  return environment.NODE_ENV !== "production" || environment.NEXT_PUBLIC_POLICY_REVIEW_PREVIEW === "1"
}

export function canActivatePolicyAsEffective(
  document: ReviewPolicyDocument,
  environment: Record<string, string | undefined> = process.env,
) {
  if (document.status !== "effective") return false
  if (environment.NEXT_PUBLIC_POLICY_PROFESSIONAL_APPROVALS_COMPLETE !== "1") return false
  const configuredHash = environment[`NEXT_PUBLIC_${document.kind.toUpperCase()}_EFFECTIVE_HASH`]
  return Boolean(configuredHash && configuredHash === document.contentHash)
}

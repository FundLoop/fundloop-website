import { edgeCommandFailure, edgeCommandSuccess, type EdgeCommandResult } from "./result.ts"
import { termsReviewDocument } from "../policies/review-policy.ts"

export const POLICY_ACKNOWLEDGEMENT_FUNCTION = "policy-acknowledgement-record"
export const policyAcknowledgementSources = ["project_funding_preview", "payout_preview"] as const
export type PolicyAcknowledgementSource = (typeof policyAcknowledgementSources)[number]

export type PolicyAcknowledgementInput = {
  documentId: string
  version: string
  contentHash: string
  status: "review"
  locale: string
  sourceSurface: PolicyAcknowledgementSource
  actorCapacity: "project_actor" | "user"
}

export type PolicyAcknowledgementOutput = {
  acceptanceId: string
  recordedAt: string
  status: "review"
  noLegalEffect: true
  noValueFlowEnabled: true
}

function isObject(value: unknown): value is Record<string, unknown> {
  return Boolean(value && typeof value === "object" && !Array.isArray(value))
}

export function validatePolicyAcknowledgementInput(input: unknown): EdgeCommandResult<PolicyAcknowledgementInput> {
  if (!isObject(input)) return edgeCommandFailure("invalid_payload", "Request body must be a JSON object.")
  const expected = termsReviewDocument
  if (
    input.documentId !== expected.documentId ||
    input.version !== expected.version ||
    input.contentHash !== expected.contentHash ||
    input.status !== "review"
  ) {
    return edgeCommandFailure("review_document_mismatch", "Only the current non-effective Terms review draft can be acknowledged.")
  }
  if (typeof input.locale !== "string" || !input.locale.trim()) {
    return edgeCommandFailure("invalid_payload", "locale is required.")
  }
  if (!policyAcknowledgementSources.includes(input.sourceSurface as PolicyAcknowledgementSource)) {
    return edgeCommandFailure("invalid_payload", "sourceSurface is not an allowed preview boundary.")
  }
  if (input.actorCapacity !== "project_actor" && input.actorCapacity !== "user") {
    return edgeCommandFailure("invalid_payload", "actorCapacity must be project_actor or user.")
  }
  return edgeCommandSuccess(input as PolicyAcknowledgementInput)
}

export function normalizePolicyAcknowledgementResult(result: EdgeCommandResult<unknown>): EdgeCommandResult<PolicyAcknowledgementOutput> {
  if (!result.ok) return result
  if (!isObject(result.data) || typeof result.data.acceptanceId !== "string" || typeof result.data.recordedAt !== "string" || result.data.status !== "review" || result.data.noLegalEffect !== true || result.data.noValueFlowEnabled !== true) {
    return edgeCommandFailure("invalid_edge_response", "Policy acknowledgement returned an invalid response.")
  }
  return edgeCommandSuccess(result.data as PolicyAcknowledgementOutput)
}


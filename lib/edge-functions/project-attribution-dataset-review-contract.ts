import { edgeCommandFailure, edgeCommandSuccess, type EdgeCommandResult } from "./result.ts"
import type { ProjectAttributionDatasetSummary } from "./project-attribution-dataset-submit-contract.ts"

export const PROJECT_ATTRIBUTION_DATASET_REVIEW_FUNCTION = "project-attribution-dataset-review"

export type ProjectAttributionDatasetReviewDecision = "approved" | "rejected"

export type ProjectAttributionDatasetReviewCommandInput = {
  datasetId: number
  decision: ProjectAttributionDatasetReviewDecision
  reason?: string
  attemptId?: string
}

export type ProjectAttributionDatasetReviewCommandOutput = ProjectAttributionDatasetSummary & {
  decision: ProjectAttributionDatasetReviewDecision
  reviewedAt: string
  reviewedByUserId: string
  reason: string | null
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return Boolean(value && typeof value === "object" && !Array.isArray(value))
}

function readOptionalString(input: Record<string, unknown>, key: string) {
  if (input[key] === undefined || input[key] === null) return edgeCommandSuccess(undefined)
  if (typeof input[key] !== "string") return edgeCommandFailure("invalid_payload", `${key} must be a string when provided.`)
  const value = input[key].trim()
  return edgeCommandSuccess(value || undefined)
}

export function validateProjectAttributionDatasetReviewInput(
  input: unknown,
): EdgeCommandResult<ProjectAttributionDatasetReviewCommandInput> {
  if (!isPlainObject(input)) {
    return edgeCommandFailure("invalid_payload", "Request body must be a JSON object.")
  }

  if (!Number.isInteger(input.datasetId) || Number(input.datasetId) <= 0) {
    return edgeCommandFailure("invalid_payload", "datasetId must be a positive integer.")
  }

  if (input.decision !== "approved" && input.decision !== "rejected") {
    return edgeCommandFailure("invalid_payload", "decision must be approved or rejected.")
  }

  const reason = readOptionalString(input, "reason")
  if (!reason.ok) return reason
  if (input.decision === "rejected" && !reason.data) {
    return edgeCommandFailure("invalid_payload", "reason is required when rejecting an attribution dataset.")
  }

  const attemptId = readOptionalString(input, "attemptId")
  if (!attemptId.ok) return attemptId

  return edgeCommandSuccess({
    datasetId: Number(input.datasetId),
    decision: input.decision,
    reason: reason.data,
    attemptId: attemptId.data,
  })
}

function isProjectAttributionDatasetReviewOutput(value: unknown): value is ProjectAttributionDatasetReviewCommandOutput {
  return (
    isPlainObject(value) &&
    Number.isInteger(value.id) &&
    Number.isInteger(value.projectId) &&
    typeof value.projectSlug === "string" &&
    Number.isInteger(value.cycleId) &&
    typeof value.cycleKey === "string" &&
    (value.status === "approved" || value.status === "rejected") &&
    (value.decision === "approved" || value.decision === "rejected") &&
    typeof value.reviewedAt === "string" &&
    typeof value.reviewedByUserId === "string" &&
    (value.reason === null || typeof value.reason === "string") &&
    Array.isArray(value.rows)
  )
}

export function normalizeProjectAttributionDatasetReviewResult(
  result: EdgeCommandResult<unknown>,
): EdgeCommandResult<ProjectAttributionDatasetReviewCommandOutput> {
  if (!result.ok) return result
  if (!isProjectAttributionDatasetReviewOutput(result.data)) {
    return edgeCommandFailure("invalid_edge_response", `${PROJECT_ATTRIBUTION_DATASET_REVIEW_FUNCTION} returned an invalid response envelope.`)
  }

  return edgeCommandSuccess(result.data)
}

import { edgeCommandFailure, edgeCommandSuccess, type EdgeCommandResult } from "./result.ts"

export const MONTHLY_CYCLE_VERIFICATION_REVIEW_FUNCTION = "monthly-cycle-verification-review"

export type MonthlyCycleVerificationDecision = "verified" | "needs_cleanup"

export type MonthlyCycleVerificationReviewCommandInput = {
  cycleKey: string
  decision: MonthlyCycleVerificationDecision
  note: string
  attemptId?: string
}

export type MonthlyCycleVerificationReviewCommandOutput = {
  cycleId: number
  cycleKey: string
  status: "verification" | "calculation"
  decision: MonthlyCycleVerificationDecision
  verificationStartedAt: string | null
  cleanupRequired: boolean
  note: string
}

const CYCLE_KEY_PATTERN = /^\d{4}-(0[1-9]|1[0-2])$/

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return Boolean(value && typeof value === "object" && !Array.isArray(value))
}

export function validateMonthlyCycleVerificationReviewInput(
  input: unknown,
): EdgeCommandResult<MonthlyCycleVerificationReviewCommandInput> {
  if (!isPlainObject(input)) {
    return edgeCommandFailure("invalid_payload", "Request body must be a JSON object.")
  }

  const cycleKey = typeof input.cycleKey === "string" ? input.cycleKey.trim() : ""
  if (!CYCLE_KEY_PATTERN.test(cycleKey)) {
    return edgeCommandFailure("invalid_payload", "cycleKey must use YYYY-MM format.")
  }

  if (input.decision !== "verified" && input.decision !== "needs_cleanup") {
    return edgeCommandFailure("invalid_payload", "decision must be verified or needs_cleanup.")
  }

  const note = typeof input.note === "string" ? input.note.trim() : ""
  if (!note) {
    return edgeCommandFailure("invalid_payload", "note is required.")
  }

  if (input.attemptId !== undefined && typeof input.attemptId !== "string") {
    return edgeCommandFailure("invalid_payload", "attemptId must be a string when provided.")
  }

  return edgeCommandSuccess({
    cycleKey,
    decision: input.decision,
    note,
    attemptId: typeof input.attemptId === "string" && input.attemptId.trim() ? input.attemptId.trim() : undefined,
  })
}

function isOutput(value: unknown): value is MonthlyCycleVerificationReviewCommandOutput {
  return (
    isPlainObject(value) &&
    Number.isInteger(value.cycleId) &&
    typeof value.cycleKey === "string" &&
    (value.status === "verification" || value.status === "calculation") &&
    (value.decision === "verified" || value.decision === "needs_cleanup") &&
    (typeof value.verificationStartedAt === "string" || value.verificationStartedAt === null) &&
    typeof value.cleanupRequired === "boolean" &&
    typeof value.note === "string"
  )
}

export function normalizeMonthlyCycleVerificationReviewResult(
  result: EdgeCommandResult<unknown>,
): EdgeCommandResult<MonthlyCycleVerificationReviewCommandOutput> {
  if (!result.ok) return result
  if (!isOutput(result.data)) {
    return edgeCommandFailure("invalid_edge_response", `${MONTHLY_CYCLE_VERIFICATION_REVIEW_FUNCTION} returned an invalid response envelope.`)
  }
  return edgeCommandSuccess(result.data)
}

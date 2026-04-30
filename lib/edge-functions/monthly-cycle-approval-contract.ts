import { edgeCommandFailure, edgeCommandSuccess, type EdgeCommandResult } from "./result.ts"

export const MONTHLY_CYCLE_APPROVAL_FUNCTION = "monthly-cycle-approval"

export type MonthlyCycleApprovalCommandInput = {
  cycleKey: string
  note: string
  attemptId?: string
}

export type MonthlyCycleApprovalCommandOutput = {
  cycleId: number
  cycleKey: string
  status: "approval"
  approvalStartedAt: string
  approvedRunId: number
  totalAllocatedUsd: number
  userCount: number
  note: string
}

const CYCLE_KEY_PATTERN = /^\d{4}-(0[1-9]|1[0-2])$/

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return Boolean(value && typeof value === "object" && !Array.isArray(value))
}

export function validateMonthlyCycleApprovalInput(input: unknown): EdgeCommandResult<MonthlyCycleApprovalCommandInput> {
  if (!isPlainObject(input)) return edgeCommandFailure("invalid_payload", "Request body must be a JSON object.")
  const cycleKey = typeof input.cycleKey === "string" ? input.cycleKey.trim() : ""
  if (!CYCLE_KEY_PATTERN.test(cycleKey)) return edgeCommandFailure("invalid_payload", "cycleKey must use YYYY-MM format.")
  const note = typeof input.note === "string" ? input.note.trim() : ""
  if (!note) return edgeCommandFailure("invalid_payload", "note is required.")
  if (input.attemptId !== undefined && typeof input.attemptId !== "string") {
    return edgeCommandFailure("invalid_payload", "attemptId must be a string when provided.")
  }
  return edgeCommandSuccess({
    cycleKey,
    note,
    attemptId: typeof input.attemptId === "string" && input.attemptId.trim() ? input.attemptId.trim() : undefined,
  })
}

function isOutput(value: unknown): value is MonthlyCycleApprovalCommandOutput {
  return (
    isPlainObject(value) &&
    Number.isInteger(value.cycleId) &&
    typeof value.cycleKey === "string" &&
    value.status === "approval" &&
    typeof value.approvalStartedAt === "string" &&
    Number.isInteger(value.approvedRunId) &&
    typeof value.totalAllocatedUsd === "number" &&
    Number.isInteger(value.userCount) &&
    typeof value.note === "string"
  )
}

export function normalizeMonthlyCycleApprovalResult(
  result: EdgeCommandResult<unknown>,
): EdgeCommandResult<MonthlyCycleApprovalCommandOutput> {
  if (!result.ok) return result
  if (!isOutput(result.data)) {
    return edgeCommandFailure("invalid_edge_response", `${MONTHLY_CYCLE_APPROVAL_FUNCTION} returned an invalid response envelope.`)
  }
  return edgeCommandSuccess(result.data)
}

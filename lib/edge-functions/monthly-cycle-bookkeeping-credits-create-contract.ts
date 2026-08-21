import { edgeCommandFailure, edgeCommandSuccess, type EdgeCommandResult } from "./result.ts"

export const MONTHLY_CYCLE_BOOKKEEPING_CREDITS_CREATE_FUNCTION = "monthly-cycle-bookkeeping-credits-create"

export type MonthlyCycleBookkeepingCreditsCreateCommandInput = {
  cycleKey: string
  attemptId?: string
}

export type MonthlyCycleBookkeepingCreditsCreateCommandOutput = {
  cycleId: number
  cycleKey: string
  status: "distribution"
  distributionStartedAt: string
  createdCount: number
  existingCount: number
  creditedCount: number
  totalCreditedUsd: number
  returnedPoolUsd: number
  assetFillCount: number
  sourceBreakdownCount: number
  noPayoutExecuted: true
}

const CYCLE_KEY_PATTERN = /^\d{4}-(0[1-9]|1[0-2])$/

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return Boolean(value && typeof value === "object" && !Array.isArray(value))
}

export function validateMonthlyCycleBookkeepingCreditsCreateInput(
  input: unknown,
): EdgeCommandResult<MonthlyCycleBookkeepingCreditsCreateCommandInput> {
  if (!isPlainObject(input)) return edgeCommandFailure("invalid_payload", "Request body must be a JSON object.")

  const cycleKey = typeof input.cycleKey === "string" ? input.cycleKey.trim() : ""
  if (!CYCLE_KEY_PATTERN.test(cycleKey)) return edgeCommandFailure("invalid_payload", "cycleKey must use YYYY-MM format.")

  if (input.attemptId !== undefined && typeof input.attemptId !== "string") {
    return edgeCommandFailure("invalid_payload", "attemptId must be a string when provided.")
  }

  return edgeCommandSuccess({
    cycleKey,
    attemptId: typeof input.attemptId === "string" && input.attemptId.trim() ? input.attemptId.trim() : undefined,
  })
}

function isOutput(value: unknown): value is MonthlyCycleBookkeepingCreditsCreateCommandOutput {
  return (
    isPlainObject(value) &&
    Number.isInteger(value.cycleId) &&
    typeof value.cycleKey === "string" &&
    value.status === "distribution" &&
    typeof value.distributionStartedAt === "string" &&
    Number.isInteger(value.createdCount) &&
    Number.isInteger(value.existingCount) &&
    Number.isInteger(value.creditedCount) &&
    typeof value.totalCreditedUsd === "number" &&
    typeof value.returnedPoolUsd === "number" &&
    Number.isInteger(value.assetFillCount) &&
    Number.isInteger(value.sourceBreakdownCount) &&
    value.noPayoutExecuted === true
  )
}

export function normalizeMonthlyCycleBookkeepingCreditsCreateResult(
  result: EdgeCommandResult<unknown>,
): EdgeCommandResult<MonthlyCycleBookkeepingCreditsCreateCommandOutput> {
  if (!result.ok) return result
  if (!isOutput(result.data)) {
    return edgeCommandFailure(
      "invalid_edge_response",
      `${MONTHLY_CYCLE_BOOKKEEPING_CREDITS_CREATE_FUNCTION} returned an invalid response envelope.`,
    )
  }

  return edgeCommandSuccess(result.data)
}

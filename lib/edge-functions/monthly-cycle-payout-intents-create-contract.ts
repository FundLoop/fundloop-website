import { edgeCommandFailure, edgeCommandSuccess, type EdgeCommandResult } from "./result"

export const MONTHLY_CYCLE_PAYOUT_INTENTS_CREATE_FUNCTION = "monthly-cycle-payout-intents-create"

export type MonthlyCyclePayoutIntentsCreateCommandInput = {
  cycleKey: string
  attemptId?: string
}

export type MonthlyCyclePayoutIntentsCreateCommandOutput = {
  cycleId: number
  cycleKey: string
  status: "distribution"
  distributionStartedAt: string
  createdCount: number
  existingCount: number
  readyCount: number
  draftCount: number
  totalAmountUsd: number
}

const CYCLE_KEY_PATTERN = /^\d{4}-(0[1-9]|1[0-2])$/

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return Boolean(value && typeof value === "object" && !Array.isArray(value))
}

export function validateMonthlyCyclePayoutIntentsCreateInput(
  input: unknown,
): EdgeCommandResult<MonthlyCyclePayoutIntentsCreateCommandInput> {
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

function isOutput(value: unknown): value is MonthlyCyclePayoutIntentsCreateCommandOutput {
  return (
    isPlainObject(value) &&
    Number.isInteger(value.cycleId) &&
    typeof value.cycleKey === "string" &&
    value.status === "distribution" &&
    typeof value.distributionStartedAt === "string" &&
    Number.isInteger(value.createdCount) &&
    Number.isInteger(value.existingCount) &&
    Number.isInteger(value.readyCount) &&
    Number.isInteger(value.draftCount) &&
    typeof value.totalAmountUsd === "number"
  )
}

export function normalizeMonthlyCyclePayoutIntentsCreateResult(
  result: EdgeCommandResult<unknown>,
): EdgeCommandResult<MonthlyCyclePayoutIntentsCreateCommandOutput> {
  if (!result.ok) return result
  if (!isOutput(result.data)) {
    return edgeCommandFailure(
      "invalid_edge_response",
      `${MONTHLY_CYCLE_PAYOUT_INTENTS_CREATE_FUNCTION} returned an invalid response envelope.`,
    )
  }

  return edgeCommandSuccess(result.data)
}

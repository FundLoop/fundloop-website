import { edgeCommandFailure, edgeCommandSuccess, type EdgeCommandResult } from "./result.ts"

export const USER_WITHDRAWAL_REQUEST_CREATE_FUNCTION = "user-withdrawal-request-create"

export type UserWithdrawalRequestCreateInput = { payoutRouteId: number; idempotencyKey: string }
export type UserWithdrawalRequestCreateResult = {
  requestId: string
  payoutRouteId: number
  status: "requested"
  requestedUsdAmount: number
  currencyCode: "USD"
  creditCount: number
  requestedAt: string
  noPayoutExecuted: true
}

function record(value: unknown): Record<string, unknown> | null {
  return value && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : null
}

export function validateUserWithdrawalRequestCreateInput(input: unknown): EdgeCommandResult<UserWithdrawalRequestCreateInput> {
  const value = record(input)
  if (!value) return edgeCommandFailure("invalid_payload", "Request body must be a JSON object.")
  const payoutRouteId = value.payoutRouteId
  const idempotencyKey = typeof value.idempotencyKey === "string" ? value.idempotencyKey.trim() : ""
  if (!Number.isInteger(payoutRouteId) || Number(payoutRouteId) <= 0) return edgeCommandFailure("invalid_payload", "A payout route is required.")
  if (idempotencyKey.length < 8 || idempotencyKey.length > 128) return edgeCommandFailure("invalid_payload", "idempotencyKey must be 8-128 characters.")
  return edgeCommandSuccess({ payoutRouteId: Number(payoutRouteId), idempotencyKey })
}

export function normalizeUserWithdrawalRequestCreateResult(result: EdgeCommandResult<unknown>): EdgeCommandResult<UserWithdrawalRequestCreateResult> {
  if (!result.ok) return result
  const value = record(result.data)
  if (!value || typeof value.requestId !== "string" || typeof value.payoutRouteId !== "number" || value.status !== "requested" ||
    typeof value.requestedUsdAmount !== "number" || value.requestedUsdAmount <= 0 || value.currencyCode !== "USD" ||
    typeof value.creditCount !== "number" || value.creditCount < 1 || typeof value.requestedAt !== "string" || value.noPayoutExecuted !== true) {
    return edgeCommandFailure("invalid_edge_response", "Withdrawal request creation returned an invalid response.")
  }
  return edgeCommandSuccess(value as UserWithdrawalRequestCreateResult)
}

import { edgeCommandFailure, edgeCommandSuccess, type EdgeCommandResult } from "./result.ts"

export const USER_WITHDRAWAL_REQUEST_CREATE_FUNCTION = "user-withdrawal-request-create"

export type UserWithdrawalRequestInput =
  | { action: "create"; payoutRouteId: number; requestedMinor: number; projectId: number; assetKey: string; userFeeBps: number; idempotencyKey: string }
  | { action: "cancel" | "retry"; requestId: string; reason?: string }

export type UserWithdrawalRequestResult = {
  requestId: string
  status: "reserved" | "queued" | "held" | "cancelled" | "closed"
  requestedMinor?: string
  feeMinor?: string
  netMinor?: string
  assetKey?: string
  projectId?: number
  railKey?: "stripe_bank_transfer" | "base_stablecoin"
  payoutIntentId?: number | null
  noPayoutExecuted: true
}

const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i
const assetPattern = /^[a-z][a-z0-9_-]{1,63}$/

function record(value: unknown): Record<string, unknown> | null {
  return value && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : null
}

function exactKeys(value: Record<string, unknown>, allowed: string[]) {
  const actual = Object.keys(value).sort()
  const expected = [...allowed].sort()
  return actual.length === expected.length && actual.every((key, index) => key === expected[index])
}

export function validateUserWithdrawalRequestInput(input: unknown): EdgeCommandResult<UserWithdrawalRequestInput> {
  const value = record(input)
  if (!value || typeof value.action !== "string") return edgeCommandFailure("invalid_payload", "A withdrawal action is required.")
  if (value.action === "create" && exactKeys(value, ["action", "payoutRouteId", "requestedMinor", "projectId", "assetKey", "userFeeBps", "idempotencyKey"])) {
    const idempotencyKey = typeof value.idempotencyKey === "string" ? value.idempotencyKey.trim() : ""
    if (!Number.isSafeInteger(value.payoutRouteId) || Number(value.payoutRouteId) <= 0 ||
      !Number.isSafeInteger(value.requestedMinor) || Number(value.requestedMinor) <= 0 ||
      !Number.isSafeInteger(value.projectId) || Number(value.projectId) <= 0 ||
      !Number.isInteger(value.userFeeBps) || Number(value.userFeeBps) < 0 || Number(value.userFeeBps) > 10000 ||
      typeof value.assetKey !== "string" || !assetPattern.test(value.assetKey) || idempotencyKey.length < 8 || idempotencyKey.length > 128) {
      return edgeCommandFailure("invalid_payload", "Route, positive minor-unit amount, eligible asset, 0%-100% fee snapshot, and idempotency key are required.")
    }
    return edgeCommandSuccess({ action: "create", payoutRouteId: Number(value.payoutRouteId), requestedMinor: Number(value.requestedMinor), projectId: Number(value.projectId),
      assetKey: value.assetKey, userFeeBps: Number(value.userFeeBps), idempotencyKey })
  }
  if ((value.action === "cancel" || value.action === "retry") &&
    (exactKeys(value, ["action", "requestId"]) || exactKeys(value, ["action", "requestId", "reason"])) &&
    typeof value.requestId === "string" && uuidPattern.test(value.requestId) &&
    (value.reason === undefined || (typeof value.reason === "string" && value.reason.length <= 160))) {
    return edgeCommandSuccess({ action: value.action, requestId: value.requestId, ...(value.reason ? { reason: value.reason } : {}) })
  }
  return edgeCommandFailure("invalid_payload", "Unexpected withdrawal fields are not allowed.")
}

export function normalizeUserWithdrawalRequestResult(result: EdgeCommandResult<unknown>): EdgeCommandResult<UserWithdrawalRequestResult> {
  if (!result.ok) return result
  const value = record(result.data)
  if (!value || typeof value.requestId !== "string" ||
    !["reserved", "queued", "held", "cancelled", "closed"].includes(String(value.status)) || value.noPayoutExecuted !== true) {
    return edgeCommandFailure("invalid_edge_response", "Withdrawal request returned an invalid response.")
  }
  return edgeCommandSuccess(value as UserWithdrawalRequestResult)
}

// Compatibility aliases for callers that still import the earlier symbol names.
export type UserWithdrawalRequestCreateInput = UserWithdrawalRequestInput
export type UserWithdrawalRequestCreateResult = UserWithdrawalRequestResult
export const validateUserWithdrawalRequestCreateInput = validateUserWithdrawalRequestInput
export const normalizeUserWithdrawalRequestCreateResult = normalizeUserWithdrawalRequestResult

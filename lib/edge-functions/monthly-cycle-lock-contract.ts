import { edgeCommandFailure, edgeCommandSuccess, type EdgeCommandResult } from "./result.ts"

export const MONTHLY_CYCLE_LOCK_FUNCTION = "monthly-cycle-lock"

export type MonthlyCycleLockCommandInput = {
  cycleKey: string
  attemptId?: string
  overrideUnresolvedOnchain?: boolean
  overrideReason?: string
}

export type MonthlyCycleLockCommandOutput = {
  cycleId: number
  cycleKey: string
  status: "locked"
  lockedAt: string
  lockedManifestHash: string
  counts: {
    payments: number
    onchainSubmissions: number
    unresolvedOnchainSubmissions: number
    identitySnapshots: number
    approvedDatasets: number
    identityArtifacts: number
  }
  overrideApplied: boolean
}

const CYCLE_KEY_PATTERN = /^\d{4}-(0[1-9]|1[0-2])$/

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return Boolean(value && typeof value === "object" && !Array.isArray(value))
}

function readCycleKey(input: Record<string, unknown>) {
  const cycleKey = typeof input.cycleKey === "string" ? input.cycleKey.trim() : ""
  if (!CYCLE_KEY_PATTERN.test(cycleKey)) {
    return edgeCommandFailure("invalid_payload", "cycleKey must use YYYY-MM format.")
  }

  return edgeCommandSuccess(cycleKey)
}

function readOptionalAttemptId(input: Record<string, unknown>) {
  if (input.attemptId !== undefined && typeof input.attemptId !== "string") {
    return edgeCommandFailure("invalid_payload", "attemptId must be a string when provided.")
  }

  return edgeCommandSuccess(typeof input.attemptId === "string" && input.attemptId.trim() ? input.attemptId.trim() : undefined)
}

export function validateMonthlyCycleLockInput(input: unknown): EdgeCommandResult<MonthlyCycleLockCommandInput> {
  if (!isPlainObject(input)) {
    return edgeCommandFailure("invalid_payload", "Request body must be a JSON object.")
  }

  const cycleKey = readCycleKey(input)
  if (!cycleKey.ok) return cycleKey
  const attemptId = readOptionalAttemptId(input)
  if (!attemptId.ok) return attemptId

  if (input.overrideUnresolvedOnchain !== undefined && typeof input.overrideUnresolvedOnchain !== "boolean") {
    return edgeCommandFailure("invalid_payload", "overrideUnresolvedOnchain must be a boolean when provided.")
  }

  if (input.overrideReason !== undefined && typeof input.overrideReason !== "string") {
    return edgeCommandFailure("invalid_payload", "overrideReason must be a string when provided.")
  }

  return edgeCommandSuccess({
    cycleKey: cycleKey.data,
    attemptId: attemptId.data,
    overrideUnresolvedOnchain: input.overrideUnresolvedOnchain as boolean | undefined,
    overrideReason: typeof input.overrideReason === "string" ? input.overrideReason.trim() : undefined,
  })
}

function isLockCounts(value: unknown): value is MonthlyCycleLockCommandOutput["counts"] {
  if (!isPlainObject(value)) return false

  return (
    Number.isInteger(value.payments) &&
    Number.isInteger(value.onchainSubmissions) &&
    Number.isInteger(value.unresolvedOnchainSubmissions) &&
    Number.isInteger(value.identitySnapshots) &&
    Number.isInteger(value.approvedDatasets) &&
    Number.isInteger(value.identityArtifacts)
  )
}

function isMonthlyCycleLockOutput(value: unknown): value is MonthlyCycleLockCommandOutput {
  if (!isPlainObject(value)) return false

  return (
    Number.isInteger(value.cycleId) &&
    typeof value.cycleKey === "string" &&
    value.status === "locked" &&
    typeof value.lockedAt === "string" &&
    typeof value.lockedManifestHash === "string" &&
    typeof value.overrideApplied === "boolean" &&
    isLockCounts(value.counts)
  )
}

export function normalizeMonthlyCycleLockResult(
  result: EdgeCommandResult<unknown>,
): EdgeCommandResult<MonthlyCycleLockCommandOutput> {
  if (!result.ok) {
    return result
  }

  if (!isMonthlyCycleLockOutput(result.data)) {
    return edgeCommandFailure("invalid_edge_response", `${MONTHLY_CYCLE_LOCK_FUNCTION} returned an invalid response envelope.`)
  }

  return edgeCommandSuccess(result.data)
}

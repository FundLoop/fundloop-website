import { edgeCommandFailure, edgeCommandSuccess, type EdgeCommandResult } from "./result.ts"

export type EpochFundedAllocationInput =
  | { action: "read"; cycleKey?: string }
  | { action: "lock"; cycleKey: string }
  | { action: "calculate"; cycleKey: string }

const cycleKeyPattern = /^\d{4}-(?:0[1-9]|1[0-2])$/

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value && typeof value === "object" && !Array.isArray(value))
}

function hasExactKeys(value: Record<string, unknown>, keys: string[]) {
  const actual = Object.keys(value).sort()
  const expected = [...keys].sort()
  return actual.length === expected.length && actual.every((key, index) => key === expected[index])
}

export function validateEpochFundedAllocationInput(value: unknown): EdgeCommandResult<EpochFundedAllocationInput> {
  if (!isRecord(value) || typeof value.action !== "string") {
    return edgeCommandFailure("invalid_payload", "A supported allocation action is required.")
  }
  if (value.action === "read") {
    if (!hasExactKeys(value, value.cycleKey === undefined ? ["action"] : ["action", "cycleKey"])) {
      return edgeCommandFailure("invalid_payload", "Unexpected allocation fields are not allowed.")
    }
    if (value.cycleKey !== undefined && (typeof value.cycleKey !== "string" || !cycleKeyPattern.test(value.cycleKey))) {
      return edgeCommandFailure("invalid_cycle", "Cycle key must use YYYY-MM.")
    }
    return edgeCommandSuccess({ action: "read", ...(typeof value.cycleKey === "string" ? { cycleKey: value.cycleKey } : {}) })
  }
  if ((value.action === "lock" || value.action === "calculate") && hasExactKeys(value, ["action", "cycleKey"])) {
    if (typeof value.cycleKey !== "string" || !cycleKeyPattern.test(value.cycleKey)) {
      return edgeCommandFailure("invalid_cycle", "Cycle key must use YYYY-MM.")
    }
    return edgeCommandSuccess({ action: value.action, cycleKey: value.cycleKey })
  }
  return edgeCommandFailure("invalid_payload", "The allocation command is invalid.")
}

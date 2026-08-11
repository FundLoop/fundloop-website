import { edgeCommandFailure, edgeCommandSuccess, type EdgeCommandResult } from "./result.ts"

export type EpochFundedAllocationInput =
  | { action: "read"; cycleKey?: string }
  | { action: "preview"; cycleKey: string; capMultiple: string }
  | { action: "lock"; cycleKey: string; capMultiple: string; selectedPreviewHash: string }
  | { action: "calculate"; cycleKey: string }

const cycleKeyPattern = /^\d{4}-(?:0[1-9]|1[0-2])$/
const capMultiplePattern = /^(?:[1-9]\.\d{2}|10\.00)$/
const hashPattern = /^[0-9a-f]{64}$/

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
  if (value.action === "preview" && hasExactKeys(value, ["action", "cycleKey", "capMultiple"])) {
    if (typeof value.cycleKey !== "string" || !cycleKeyPattern.test(value.cycleKey)) {
      return edgeCommandFailure("invalid_cycle", "Cycle key must use YYYY-MM.")
    }
    if (typeof value.capMultiple !== "string" || !capMultiplePattern.test(value.capMultiple)) {
      return edgeCommandFailure("invalid_cap_multiple", "Cap multiple must be between 1.00 and 10.00 in 0.01 increments.")
    }
    return edgeCommandSuccess({ action: "preview", cycleKey: value.cycleKey, capMultiple: value.capMultiple })
  }
  if (value.action === "lock" && hasExactKeys(value, ["action", "cycleKey", "capMultiple", "selectedPreviewHash"])) {
    if (typeof value.cycleKey !== "string" || !cycleKeyPattern.test(value.cycleKey)) {
      return edgeCommandFailure("invalid_cycle", "Cycle key must use YYYY-MM.")
    }
    if (typeof value.capMultiple !== "string" || !capMultiplePattern.test(value.capMultiple)
      || typeof value.selectedPreviewHash !== "string" || !hashPattern.test(value.selectedPreviewHash)) {
      return edgeCommandFailure("invalid_payload", "A governed cap multiple and selected preview hash are required.")
    }
    return edgeCommandSuccess({ action: "lock", cycleKey: value.cycleKey, capMultiple: value.capMultiple, selectedPreviewHash: value.selectedPreviewHash })
  }
  if (value.action === "calculate" && hasExactKeys(value, ["action", "cycleKey"])) {
    if (typeof value.cycleKey !== "string" || !cycleKeyPattern.test(value.cycleKey)) {
      return edgeCommandFailure("invalid_cycle", "Cycle key must use YYYY-MM.")
    }
    return edgeCommandSuccess({ action: "calculate", cycleKey: value.cycleKey })
  }
  return edgeCommandFailure("invalid_payload", "The allocation command is invalid.")
}

import { edgeCommandFailure, edgeCommandSuccess, type EdgeCommandResult } from "./result.ts"

export type EpochFundedAllocationInput =
  | { action: "read"; cycleKey?: string; currency?: string }
  | { action: "preview"; cycleKey: string; capMultiple: string; currency?: string }
  | { action: "lock"; cycleKey: string; capMultiple: string; selectedPreviewHash: string; currency?: string }
  | { action: "calculate"; cycleKey: string; currency?: string }

const cycleKeyPattern = /^\d{4}-(?:0[1-9]|1[0-2])$/
const capMultiplePattern = /^(?:[1-9]\.\d{2}|10\.00)$/
const hashPattern = /^[0-9a-f]{64}$/
const currencyPattern = /^[A-Z]{3}$/

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value && typeof value === "object" && !Array.isArray(value))
}

function hasAllowedKeys(value: Record<string, unknown>, requiredKeys: string[], optionalKeys: string[] = []): boolean {
  const actualKeys = Object.keys(value)
  const allowed = new Set([...requiredKeys, ...optionalKeys])
  if (!requiredKeys.every((k) => actualKeys.includes(k))) return false
  return actualKeys.every((k) => allowed.has(k))
}

export function validateEpochFundedAllocationInput(value: unknown): EdgeCommandResult<EpochFundedAllocationInput> {
  if (!isRecord(value) || typeof value.action !== "string") {
    return edgeCommandFailure("invalid_payload", "A supported allocation action is required.")
  }
  if (value.currency !== undefined && (typeof value.currency !== "string" || !currencyPattern.test(value.currency.toUpperCase()))) {
    return edgeCommandFailure("invalid_currency", "Currency must be a 3-letter code (e.g. USD).")
  }
  const currency = typeof value.currency === "string" ? value.currency.toUpperCase() : undefined

  if (value.action === "read") {
    if (!hasAllowedKeys(value, ["action"], ["cycleKey", "currency"])) {
      return edgeCommandFailure("invalid_payload", "Unexpected allocation fields are not allowed.")
    }
    if (value.cycleKey !== undefined && (typeof value.cycleKey !== "string" || !cycleKeyPattern.test(value.cycleKey))) {
      return edgeCommandFailure("invalid_cycle", "Cycle key must use YYYY-MM.")
    }
    return edgeCommandSuccess({
      action: "read",
      ...(typeof value.cycleKey === "string" ? { cycleKey: value.cycleKey } : {}),
      ...(currency ? { currency } : {}),
    })
  }
  if (value.action === "preview" && hasAllowedKeys(value, ["action", "cycleKey", "capMultiple"], ["currency"])) {
    if (typeof value.cycleKey !== "string" || !cycleKeyPattern.test(value.cycleKey)) {
      return edgeCommandFailure("invalid_cycle", "Cycle key must use YYYY-MM.")
    }
    if (typeof value.capMultiple !== "string" || !capMultiplePattern.test(value.capMultiple)) {
      return edgeCommandFailure("invalid_cap_multiple", "Cap multiple must be between 1.00 and 10.00 in 0.01 increments.")
    }
    return edgeCommandSuccess({
      action: "preview",
      cycleKey: value.cycleKey,
      capMultiple: value.capMultiple,
      ...(currency ? { currency } : {}),
    })
  }
  if (value.action === "lock" && hasAllowedKeys(value, ["action", "cycleKey", "capMultiple", "selectedPreviewHash"], ["currency"])) {
    if (typeof value.cycleKey !== "string" || !cycleKeyPattern.test(value.cycleKey)) {
      return edgeCommandFailure("invalid_cycle", "Cycle key must use YYYY-MM.")
    }
    if (typeof value.capMultiple !== "string" || !capMultiplePattern.test(value.capMultiple)
      || typeof value.selectedPreviewHash !== "string" || !hashPattern.test(value.selectedPreviewHash)) {
      return edgeCommandFailure("invalid_payload", "A governed cap multiple and selected preview hash are required.")
    }
    return edgeCommandSuccess({
      action: "lock",
      cycleKey: value.cycleKey,
      capMultiple: value.capMultiple,
      selectedPreviewHash: value.selectedPreviewHash,
      ...(currency ? { currency } : {}),
    })
  }
  if (value.action === "calculate" && hasAllowedKeys(value, ["action", "cycleKey"], ["currency"])) {
    if (typeof value.cycleKey !== "string" || !cycleKeyPattern.test(value.cycleKey)) {
      return edgeCommandFailure("invalid_cycle", "Cycle key must use YYYY-MM.")
    }
    return edgeCommandSuccess({
      action: "calculate",
      cycleKey: value.cycleKey,
      ...(currency ? { currency } : {}),
    })
  }
  return edgeCommandFailure("invalid_payload", "The allocation command is invalid.")
}

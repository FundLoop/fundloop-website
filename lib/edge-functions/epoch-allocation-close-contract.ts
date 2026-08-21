import { edgeCommandFailure, edgeCommandSuccess, type EdgeCommandResult } from "./result.ts"

export type EpochAllocationCloseInput =
  | { action: "approve"; cycleKey: string }
  | { action: "confirm_root"; cycleKey: string; closePackageId: number; rootHash: string }
  | { action: "read"; cycleKey: string; scope: "operator" | "user" }
  | { action: "read"; cycleKey: string; scope: "project"; projectSlug: string }

const cycleKeyPattern = /^\d{4}-(?:0[1-9]|1[0-2])$/
const slugPattern = /^[a-z0-9]+(?:-[a-z0-9]+)*$/
const hashPattern = /^[0-9a-f]{64}$/

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value && typeof value === "object" && !Array.isArray(value))
}

function exactKeys(value: Record<string, unknown>, keys: string[]) {
  const actual = Object.keys(value).sort()
  const expected = [...keys].sort()
  return actual.length === expected.length && actual.every((key, index) => key === expected[index])
}

export function validateEpochAllocationCloseInput(value: unknown): EdgeCommandResult<EpochAllocationCloseInput> {
  if (!isRecord(value) || typeof value.action !== "string" || typeof value.cycleKey !== "string" || !cycleKeyPattern.test(value.cycleKey)) {
    return edgeCommandFailure("invalid_payload", "A supported close action and YYYY-MM cycle key are required.")
  }
  if (value.action === "approve" && exactKeys(value, ["action", "cycleKey"])) {
    return edgeCommandSuccess({ action: "approve", cycleKey: value.cycleKey })
  }
  if (value.action === "confirm_root" && exactKeys(value, ["action", "cycleKey", "closePackageId", "rootHash"]) &&
    typeof value.closePackageId === "number" && Number.isSafeInteger(value.closePackageId) && value.closePackageId > 0 &&
    typeof value.rootHash === "string" && hashPattern.test(value.rootHash)) {
    return edgeCommandSuccess({ action: "confirm_root", cycleKey: value.cycleKey, closePackageId: value.closePackageId, rootHash: value.rootHash })
  }
  if (value.action !== "read" || typeof value.scope !== "string") {
    return edgeCommandFailure("invalid_payload", "The close command is invalid.")
  }
  if ((value.scope === "operator" || value.scope === "user") && exactKeys(value, ["action", "cycleKey", "scope"])) {
    return edgeCommandSuccess({ action: "read", cycleKey: value.cycleKey, scope: value.scope })
  }
  if (value.scope === "project" && exactKeys(value, ["action", "cycleKey", "scope", "projectSlug"]) &&
    typeof value.projectSlug === "string" && slugPattern.test(value.projectSlug)) {
    return edgeCommandSuccess({ action: "read", cycleKey: value.cycleKey, scope: "project", projectSlug: value.projectSlug })
  }
  return edgeCommandFailure("invalid_payload", "Unexpected close-package fields are not allowed.")
}

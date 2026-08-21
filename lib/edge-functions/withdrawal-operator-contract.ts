import { edgeCommandFailure, edgeCommandSuccess, type EdgeCommandResult } from "./result.ts"

export type WithdrawalOperatorInput =
  | { action: "prepare"; closePackageId: number }
  | { action: "hold"; requestId: string; reasonCode: string; evidenceHash: string }
  | { action: "expire" }

const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i
const reason = /^[a-z][a-z0-9:_-]*$/
const hash = /^[0-9a-f]{64}$/
function record(value: unknown): Record<string, unknown> | null { return value && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : null }
function exact(value: Record<string, unknown>, keys: string[]) { return Object.keys(value).sort().join("|") === [...keys].sort().join("|") }

export function validateWithdrawalOperatorInput(input: unknown): EdgeCommandResult<WithdrawalOperatorInput> {
  const value = record(input)
  if (!value || typeof value.action !== "string") return edgeCommandFailure("invalid_payload", "An operator withdrawal action is required.")
  if (value.action === "prepare" && exact(value, ["action", "closePackageId"]) && Number.isSafeInteger(value.closePackageId) && Number(value.closePackageId)>0) {
    return edgeCommandSuccess({ action: "prepare", closePackageId: Number(value.closePackageId) })
  }
  if (value.action === "hold" && exact(value, ["action", "requestId", "reasonCode", "evidenceHash"]) &&
    typeof value.requestId === "string" && uuid.test(value.requestId) && typeof value.reasonCode === "string" && reason.test(value.reasonCode) &&
    typeof value.evidenceHash === "string" && hash.test(value.evidenceHash)) {
    return edgeCommandSuccess({ action: "hold", requestId: value.requestId, reasonCode: value.reasonCode, evidenceHash: value.evidenceHash })
  }
  if (value.action === "expire" && exact(value, ["action"])) return edgeCommandSuccess({ action: "expire" })
  return edgeCommandFailure("invalid_payload", "Unexpected operator withdrawal fields are not allowed.")
}

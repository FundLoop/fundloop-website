import { edgeCommandFailure, edgeCommandSuccess, type EdgeCommandResult } from "./result.ts"

export type FinancialCutoverOpeningBalanceApproval = {
  sourceType: "bookkeeping_credit"
  sourceId: string
  evidenceHash: string
}

export type FinancialCutoverInput =
  | { action: "prepare"; idempotencyKey: string; evidenceHash: string; approvedOpeningBalances: FinancialCutoverOpeningBalanceApproval[] }
  | { action: "activate"; runId: number; manifestHash: string; evidenceHash: string }
  | { action: "rollback"; runId: number; manifestHash: string; evidenceHash: string }
  | { action: "read"; runId: number }

const hash = /^[0-9a-f]{64}$/
const key = /^[a-zA-Z0-9:_-]{8,160}$/
const positiveInteger = /^\d+$/
const allowedEnvironments = new Set(["local", "development", "dev", "preview", "test"])

export function isFinancialCutoverEnvironmentEnabled(environment: string | null | undefined) {
  return allowedEnvironments.has((environment ?? "production").trim().toLowerCase())
}

function record(value: unknown): Record<string, unknown> | null {
  return value && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : null
}

function exact(value: Record<string, unknown>, keys: string[]) {
  return Object.keys(value).sort().join("|") === [...keys].sort().join("|")
}

function openingBalanceApproval(value: unknown): FinancialCutoverOpeningBalanceApproval | null {
  const approval = record(value)
  if (!approval || !exact(approval, ["sourceType", "sourceId", "evidenceHash"]) || approval.sourceType !== "bookkeeping_credit" ||
    typeof approval.sourceId !== "string" || !positiveInteger.test(approval.sourceId) ||
    typeof approval.evidenceHash !== "string" || !hash.test(approval.evidenceHash)) return null
  return { sourceType: "bookkeeping_credit", sourceId: approval.sourceId, evidenceHash: approval.evidenceHash }
}

export function validateFinancialCutoverInput(input: unknown): EdgeCommandResult<FinancialCutoverInput> {
  const value = record(input)
  if (!value || typeof value.action !== "string") return edgeCommandFailure("invalid_payload", "A financial cutover action is required.")
  if (value.action === "prepare" && exact(value, ["action", "idempotencyKey", "evidenceHash", "approvedOpeningBalances"]) &&
    typeof value.idempotencyKey === "string" && key.test(value.idempotencyKey) && typeof value.evidenceHash === "string" && hash.test(value.evidenceHash) &&
    Array.isArray(value.approvedOpeningBalances) && value.approvedOpeningBalances.length <= 500) {
    const approvals = value.approvedOpeningBalances.map(openingBalanceApproval)
    if (approvals.every((approval): approval is FinancialCutoverOpeningBalanceApproval => approval !== null) &&
      new Set(approvals.map((approval) => approval.sourceId)).size === approvals.length) {
      return edgeCommandSuccess({ action: "prepare", idempotencyKey: value.idempotencyKey, evidenceHash: value.evidenceHash, approvedOpeningBalances: approvals })
    }
  }
  if ((value.action === "activate" || value.action === "rollback") && exact(value, ["action", "runId", "manifestHash", "evidenceHash"]) &&
    Number.isSafeInteger(value.runId) && Number(value.runId) > 0 && typeof value.manifestHash === "string" && hash.test(value.manifestHash) &&
    typeof value.evidenceHash === "string" && hash.test(value.evidenceHash)) {
    return edgeCommandSuccess({ action: value.action, runId: Number(value.runId), manifestHash: value.manifestHash, evidenceHash: value.evidenceHash })
  }
  if (value.action === "read" && exact(value, ["action", "runId"]) && Number.isSafeInteger(value.runId) && Number(value.runId) > 0) {
    return edgeCommandSuccess({ action: "read", runId: Number(value.runId) })
  }
  return edgeCommandFailure("invalid_payload", "Unexpected financial cutover fields are not allowed.")
}

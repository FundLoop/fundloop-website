import { edgeCommandFailure, edgeCommandSuccess, type EdgeCommandResult } from "./result.ts"

export const BASE_SAFE_PAYOUT_OPERATOR_FUNCTION="base-safe-payout-operator"

export type BaseSafePayoutOperatorInput =
  | { action: "authorize"; payoutIntentId: number; deploymentId: number; gasBudgetNative: string }
  | { action: "confirm_authorization"; commandId: number }
  | { action: "execute"; commandId: number }
  | { action: "observe"; commandId: number; txHash: `0x${string}`; replacementTxHash?: `0x${string}` }

const integer = /^(0|[1-9][0-9]*)$/
const txHash = /^0x[0-9a-f]{64}$/i
function record(value: unknown): Record<string, unknown> | null { return value && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : null }
function exact(value: Record<string, unknown>, keys: string[]) { return Object.keys(value).sort().join("|") === [...keys].sort().join("|") }

export function validateBaseSafePayoutOperatorInput(input: unknown): EdgeCommandResult<BaseSafePayoutOperatorInput> {
  const value = record(input)
  if (!value || typeof value.action !== "string") return edgeCommandFailure("invalid_payload", "A Base payout action is required.")
  if (value.action === "authorize" && exact(value,["action","payoutIntentId","deploymentId","gasBudgetNative"]) &&
    Number.isSafeInteger(value.payoutIntentId) && Number(value.payoutIntentId)>0 && Number.isSafeInteger(value.deploymentId) && Number(value.deploymentId)>0 &&
    typeof value.gasBudgetNative === "string" && integer.test(value.gasBudgetNative)) {
    return edgeCommandSuccess({ action:"authorize",payoutIntentId:Number(value.payoutIntentId),deploymentId:Number(value.deploymentId),gasBudgetNative:value.gasBudgetNative })
  }
  if ((value.action === "confirm_authorization" || value.action === "execute") && exact(value,["action","commandId"]) &&
    Number.isSafeInteger(value.commandId) && Number(value.commandId)>0) {
    return edgeCommandSuccess({ action:value.action,commandId:Number(value.commandId) })
  }
  if (value.action === "observe" && (exact(value,["action","commandId","txHash"]) || exact(value,["action","commandId","txHash","replacementTxHash"])) &&
    Number.isSafeInteger(value.commandId) && Number(value.commandId)>0 && typeof value.txHash === "string" && txHash.test(value.txHash) &&
    (value.replacementTxHash===undefined || (typeof value.replacementTxHash === "string" && txHash.test(value.replacementTxHash)))) {
    return edgeCommandSuccess({ action:"observe",commandId:Number(value.commandId),txHash:value.txHash as `0x${string}`,
      ...(value.replacementTxHash ? { replacementTxHash:value.replacementTxHash as `0x${string}` } : {}) })
  }
  return edgeCommandFailure("invalid_payload", "Unexpected Base payout fields are not allowed.")
}

import { edgeCommandFailure, edgeCommandSuccess, type EdgeCommandResult } from "./result.ts"

const hash = /^[0-9a-f]{64}$/
const decimal = /^(?:0|[1-9][0-9]{0,19})(?:\.[0-9]{1,18})?$/
const cycle = /^\d{4}-(?:0[1-9]|1[0-2])$/
const key = /^[a-z][a-z0-9:_-]*$/

export type EpochFinancialPrepInput =
  | { action: "read"; cycleKey?: string }
  | { action: "record_fx"; cycleKey: string; assetKey: string; sourceKey: string; sourceRank: number; rateUsdPerUnit: string;
      observedAt: string; freshnessExpiresAt: string; reasonabilityStatus: "eligible"|"rejected_stale"|"rejected_cross_rate"|"rejected_prior_movement"|"rejected_peg"; evidenceHash: string }
  | { action: "post_fx"; cycleKey: string; assetKey: string; method: "primary"|"fallback"|"manual_after_exhaustion";
      observationId?: number; manualRateUsdPerUnit?: string; preanalysis: Record<string, unknown>; evidenceHash: string }
  | { action: "prepare_sources"; packageId: number }
  | { action: "harvest"; sourceLotId: number; targetCycleKey: string }

function object(value: unknown): value is Record<string, unknown> {
  return Boolean(value && typeof value === "object" && !Array.isArray(value))
}

function positiveId(value: unknown) { return Number.isSafeInteger(value) && Number(value) > 0 }
function timestamp(value: unknown) { return typeof value === "string" && Number.isFinite(Date.parse(value)) }
function exactKeys(value: Record<string, unknown>, allowed: string[]) { return Object.keys(value).every((item) => allowed.includes(item)) }

export function validateEpochFinancialPrepInput(value: unknown): EdgeCommandResult<EpochFinancialPrepInput> {
  if (!object(value) || typeof value.action !== "string") return edgeCommandFailure("invalid_payload", "A supported action is required.")
  if (value.action === "read") {
    if (!exactKeys(value,["action","cycleKey"])) return edgeCommandFailure("invalid_payload", "Unexpected fields are not allowed.")
    if (value.cycleKey !== undefined && (typeof value.cycleKey !== "string" || !cycle.test(value.cycleKey))) return edgeCommandFailure("invalid_cycle", "Invalid cycle key.")
    return edgeCommandSuccess({ action: "read", ...(value.cycleKey ? { cycleKey: value.cycleKey as string } : {}) })
  }
  if (value.action === "prepare_sources" && exactKeys(value,["action","packageId"]) && positiveId(value.packageId)) return edgeCommandSuccess({ action: "prepare_sources", packageId: Number(value.packageId) })
  if (value.action === "harvest" && exactKeys(value,["action","sourceLotId","targetCycleKey"]) && positiveId(value.sourceLotId) && typeof value.targetCycleKey === "string" && cycle.test(value.targetCycleKey)) {
    return edgeCommandSuccess({ action: "harvest", sourceLotId: Number(value.sourceLotId), targetCycleKey: value.targetCycleKey })
  }
  if (value.action === "record_fx" && exactKeys(value,["action","cycleKey","assetKey","sourceKey","sourceRank","rateUsdPerUnit","observedAt","freshnessExpiresAt","reasonabilityStatus","evidenceHash"])
    && typeof value.cycleKey === "string" && cycle.test(value.cycleKey)
    && typeof value.assetKey === "string" && key.test(value.assetKey) && typeof value.sourceKey === "string" && key.test(value.sourceKey)
    && Number.isInteger(value.sourceRank) && Number(value.sourceRank) >= 1 && Number(value.sourceRank) <= 100
    && typeof value.rateUsdPerUnit === "string" && decimal.test(value.rateUsdPerUnit) && Number(value.rateUsdPerUnit) > 0
    && timestamp(value.observedAt) && timestamp(value.freshnessExpiresAt) && Date.parse(String(value.freshnessExpiresAt)) > Date.parse(String(value.observedAt))
    && ["eligible","rejected_stale","rejected_cross_rate","rejected_prior_movement","rejected_peg"].includes(String(value.reasonabilityStatus))
    && typeof value.evidenceHash === "string" && hash.test(value.evidenceHash)) {
    return edgeCommandSuccess(value as EpochFinancialPrepInput)
  }
  if (value.action === "post_fx" && exactKeys(value,["action","cycleKey","assetKey","method","observationId","manualRateUsdPerUnit","preanalysis","evidenceHash"])
    && typeof value.cycleKey === "string" && cycle.test(value.cycleKey)
    && typeof value.assetKey === "string" && key.test(value.assetKey)
    && ["primary","fallback","manual_after_exhaustion"].includes(String(value.method)) && object(value.preanalysis)
    && typeof value.evidenceHash === "string" && hash.test(value.evidenceHash)) {
    const manual = value.method === "manual_after_exhaustion"
    if (manual !== (typeof value.manualRateUsdPerUnit === "string" && decimal.test(value.manualRateUsdPerUnit) && Number(value.manualRateUsdPerUnit) > 0)) {
      return edgeCommandFailure("invalid_fx_method", "Manual rate is required only after source exhaustion.")
    }
    if (!manual && !positiveId(value.observationId)) return edgeCommandFailure("invalid_fx_observation", "A reviewed observation is required.")
    return edgeCommandSuccess(value as EpochFinancialPrepInput)
  }
  return edgeCommandFailure("invalid_payload", "The financial prep command is invalid.")
}

import { edgeCommandFailure, edgeCommandSuccess, type EdgeCommandResult } from "./result"

export const MONTHLY_CYCLE_CALCULATION_PACKAGE_FUNCTION = "monthly-cycle-calculation-package"

export type MonthlyCycleCalculationPackageCommandInput = {
  cycleKey: string
  attemptId?: string
}

export type MonthlyCycleCalculationPackageCommandOutput = {
  cycleId: number
  cycleKey: string
  status: "calculation"
  calculationStartedAt: string
  runId: number
  runStatus: "locked"
  packageArtifactPath: string
  packageArtifactHash: string
  runManifestHash: string
  counts: {
    datasets: number
    payments: number
    identityArtifacts: number
  }
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

export function validateMonthlyCycleCalculationPackageInput(
  input: unknown,
): EdgeCommandResult<MonthlyCycleCalculationPackageCommandInput> {
  if (!isPlainObject(input)) {
    return edgeCommandFailure("invalid_payload", "Request body must be a JSON object.")
  }

  const cycleKey = readCycleKey(input)
  if (!cycleKey.ok) return cycleKey
  const attemptId = readOptionalAttemptId(input)
  if (!attemptId.ok) return attemptId

  return edgeCommandSuccess({
    cycleKey: cycleKey.data,
    attemptId: attemptId.data,
  })
}

function isCounts(value: unknown): value is MonthlyCycleCalculationPackageCommandOutput["counts"] {
  return (
    isPlainObject(value) &&
    Number.isInteger(value.datasets) &&
    Number.isInteger(value.payments) &&
    Number.isInteger(value.identityArtifacts)
  )
}

function isMonthlyCycleCalculationPackageOutput(value: unknown): value is MonthlyCycleCalculationPackageCommandOutput {
  return (
    isPlainObject(value) &&
    Number.isInteger(value.cycleId) &&
    typeof value.cycleKey === "string" &&
    value.status === "calculation" &&
    typeof value.calculationStartedAt === "string" &&
    Number.isInteger(value.runId) &&
    value.runStatus === "locked" &&
    typeof value.packageArtifactPath === "string" &&
    typeof value.packageArtifactHash === "string" &&
    typeof value.runManifestHash === "string" &&
    isCounts(value.counts)
  )
}

export function normalizeMonthlyCycleCalculationPackageResult(
  result: EdgeCommandResult<unknown>,
): EdgeCommandResult<MonthlyCycleCalculationPackageCommandOutput> {
  if (!result.ok) {
    return result
  }

  if (!isMonthlyCycleCalculationPackageOutput(result.data)) {
    return edgeCommandFailure(
      "invalid_edge_response",
      `${MONTHLY_CYCLE_CALCULATION_PACKAGE_FUNCTION} returned an invalid response envelope.`,
    )
  }

  return edgeCommandSuccess(result.data)
}

import { edgeCommandFailure, edgeCommandSuccess, type EdgeCommandResult } from "./result.ts"

export const PROJECT_MONTHLY_CONTRIBUTION_SUBMIT_FUNCTION = "project-monthly-contribution-submit"

export type ProjectMonthlyContributionSubmitCommandInput = {
  projectSlug: string
  cycleKey: string
  periodStart: string
  periodEnd: string
  sourceCurrency: string
  sourceAmount: number
  usdEquivalentAmount: number
  commitmentPercentage: number
  /**
   * Browser-supplied preview value. The server command recomputes the
   * authoritative contribution amount from USD equivalent and commitment.
   */
  calculatedContributionAmount: number
  sourceReference?: string
  notes?: string
  attemptId?: string
}

export type ProjectMonthlyContributionSubmissionSummary = {
  id: number
  projectId: number
  projectSlug: string
  cycleId: number
  cycleKey: string
  periodStart: string
  periodEnd: string
  sourceCurrency: string
  sourceAmount: number
  usdEquivalentAmount: number
  commitmentPercentage: number
  calculatedContributionAmount: number
  sourceReference: string | null
  notes: string | null
  status: "submitted"
  submittedByUserId: string | null
  submittedAt: string
  updatedAt: string
}

const CYCLE_KEY_PATTERN = /^\d{4}-(0[1-9]|1[0-2])$/
const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/
const CURRENCY_PATTERN = /^[A-Z0-9]{3,12}$/

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return Boolean(value && typeof value === "object" && !Array.isArray(value))
}

function readString(input: Record<string, unknown>, key: string, message?: string) {
  const value = typeof input[key] === "string" ? input[key].trim() : ""
  if (!value) {
    return edgeCommandFailure("invalid_payload", message ?? `${key} is required.`)
  }

  return edgeCommandSuccess(value)
}

function readOptionalString(input: Record<string, unknown>, key: string) {
  if (input[key] === undefined || input[key] === null) return edgeCommandSuccess(undefined)
  if (typeof input[key] !== "string") return edgeCommandFailure("invalid_payload", `${key} must be a string when provided.`)
  const value = input[key].trim()
  return edgeCommandSuccess(value || undefined)
}

function readMoney(input: Record<string, unknown>, key: string) {
  const value = input[key]
  if (typeof value !== "number" || !Number.isFinite(value) || value < 0) {
    return edgeCommandFailure("invalid_payload", `${key} must be a non-negative number.`)
  }

  return edgeCommandSuccess(Math.round(value * 100) / 100)
}

function readSourceAmount(input: Record<string, unknown>) {
  const value = input.sourceAmount
  if (typeof value !== "number" || !Number.isFinite(value) || value < 0) {
    return edgeCommandFailure("invalid_payload", "sourceAmount must be a non-negative number.")
  }

  return edgeCommandSuccess(Math.round(value * 1_000_000) / 1_000_000)
}

function isDateOnly(value: string) {
  return DATE_PATTERN.test(value) && !Number.isNaN(Date.parse(`${value}T00:00:00.000Z`))
}

export function validateProjectMonthlyContributionSubmitInput(
  input: unknown,
): EdgeCommandResult<ProjectMonthlyContributionSubmitCommandInput> {
  if (!isPlainObject(input)) {
    return edgeCommandFailure("invalid_payload", "Request body must be a JSON object.")
  }

  const projectSlug = readString(input, "projectSlug", "projectSlug is required.")
  if (!projectSlug.ok) return projectSlug

  const cycleKey = readString(input, "cycleKey", "cycleKey is required.")
  if (!cycleKey.ok) return cycleKey
  if (!CYCLE_KEY_PATTERN.test(cycleKey.data)) {
    return edgeCommandFailure("invalid_payload", "cycleKey must use YYYY-MM format.")
  }

  const periodStart = readString(input, "periodStart", "periodStart is required.")
  if (!periodStart.ok) return periodStart
  const periodEnd = readString(input, "periodEnd", "periodEnd is required.")
  if (!periodEnd.ok) return periodEnd
  if (!isDateOnly(periodStart.data) || !isDateOnly(periodEnd.data)) {
    return edgeCommandFailure("invalid_payload", "periodStart and periodEnd must use YYYY-MM-DD format.")
  }
  if (periodEnd.data < periodStart.data) {
    return edgeCommandFailure("invalid_payload", "periodEnd must be on or after periodStart.")
  }

  const sourceCurrency = readString(input, "sourceCurrency", "sourceCurrency is required.")
  if (!sourceCurrency.ok) return sourceCurrency
  const normalizedCurrency = sourceCurrency.data.toUpperCase()
  if (!CURRENCY_PATTERN.test(normalizedCurrency)) {
    return edgeCommandFailure("invalid_payload", "sourceCurrency must be a 3-12 character uppercase currency or token code.")
  }

  const sourceAmount = readSourceAmount(input)
  if (!sourceAmount.ok) return sourceAmount
  const usdEquivalentAmount = readMoney(input, "usdEquivalentAmount")
  if (!usdEquivalentAmount.ok) return usdEquivalentAmount
  const commitmentPercentage = readMoney(input, "commitmentPercentage")
  if (!commitmentPercentage.ok) return commitmentPercentage
  const calculatedContributionAmount = readMoney(input, "calculatedContributionAmount")
  if (!calculatedContributionAmount.ok) return calculatedContributionAmount

  const sourceReference = readOptionalString(input, "sourceReference")
  if (!sourceReference.ok) return sourceReference
  const notes = readOptionalString(input, "notes")
  if (!notes.ok) return notes
  const attemptId = readOptionalString(input, "attemptId")
  if (!attemptId.ok) return attemptId

  return edgeCommandSuccess({
    projectSlug: projectSlug.data,
    cycleKey: cycleKey.data,
    periodStart: periodStart.data,
    periodEnd: periodEnd.data,
    sourceCurrency: normalizedCurrency,
    sourceAmount: sourceAmount.data,
    usdEquivalentAmount: usdEquivalentAmount.data,
    commitmentPercentage: commitmentPercentage.data,
    calculatedContributionAmount: calculatedContributionAmount.data,
    sourceReference: sourceReference.data,
    notes: notes.data,
    attemptId: attemptId.data,
  })
}

function isSubmissionSummary(value: unknown): value is ProjectMonthlyContributionSubmissionSummary {
  if (!isPlainObject(value)) return false

  return (
    Number.isInteger(value.id) &&
    Number.isInteger(value.projectId) &&
    typeof value.projectSlug === "string" &&
    Number.isInteger(value.cycleId) &&
    typeof value.cycleKey === "string" &&
    typeof value.periodStart === "string" &&
    typeof value.periodEnd === "string" &&
    typeof value.sourceCurrency === "string" &&
    typeof value.sourceAmount === "number" &&
    typeof value.usdEquivalentAmount === "number" &&
    typeof value.commitmentPercentage === "number" &&
    typeof value.calculatedContributionAmount === "number" &&
    (typeof value.sourceReference === "string" || value.sourceReference === null) &&
    (typeof value.notes === "string" || value.notes === null) &&
    value.status === "submitted" &&
    (typeof value.submittedByUserId === "string" || value.submittedByUserId === null) &&
    typeof value.submittedAt === "string" &&
    typeof value.updatedAt === "string"
  )
}

export function normalizeProjectMonthlyContributionSubmitResult(
  result: EdgeCommandResult<unknown>,
): EdgeCommandResult<ProjectMonthlyContributionSubmissionSummary> {
  if (!result.ok) return result
  if (!isSubmissionSummary(result.data)) {
    return edgeCommandFailure(
      "invalid_edge_response",
      `${PROJECT_MONTHLY_CONTRIBUTION_SUBMIT_FUNCTION} returned an invalid response envelope.`,
    )
  }

  return edgeCommandSuccess(result.data)
}

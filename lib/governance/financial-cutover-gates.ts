export const FINANCIAL_CUTOVER_GOVERNANCE_DOMAINS = [
  "canadian_legal_counsel",
  "retail_payment_activities_act",
  "fintrac_msb_obligations",
  "sanctions_kyc_kyb",
  "securities_derivatives",
  "custody_insolvency",
  "consumer_protection",
  "accounting_tax_recognition",
  "functional_currency_treatment",
  "token_fx_fee_treatment",
  "opening_balance_liability",
  "expiry_unclaimed_property",
  "privacy_retention",
  "provider_data_processing",
  "production_readiness_engineering",
] as const

export type FinancialCutoverGovernanceDomain = (typeof FINANCIAL_CUTOVER_GOVERNANCE_DOMAINS)[number]

export type FinancialCutoverConditionResolution = {
  condition: string
  evidenceHash: string
  resolvedAt: string
}

export type FinancialCutoverGovernanceGate = {
  domain: FinancialCutoverGovernanceDomain
  qualifiedReviewerIdentity: string
  jurisdictionOrStandard: string
  artifactHash: string
  conditions: string[]
  conditionResolutions: FinancialCutoverConditionResolution[]
  disposition: string
  reReviewDate: string
  approvedAt: string
}

const HASH = /^[0-9a-f]{64}$/
const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/
const ISO_TIMESTAMP = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{3})?Z$/
const GATE_KEYS = ["domain", "qualifiedReviewerIdentity", "jurisdictionOrStandard", "artifactHash", "conditions", "conditionResolutions", "disposition", "reReviewDate", "approvedAt"]
const RESOLUTION_KEYS = ["condition", "evidenceHash", "resolvedAt"]

function record(value: unknown): Record<string, unknown> | null {
  return value && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : null
}

function hasExactKeys(value: Record<string, unknown>, keys: string[]) {
  return Object.keys(value).sort().join("|") === [...keys].sort().join("|")
}

function isExactIsoTimestamp(value: unknown): value is string {
  if (typeof value !== "string" || !ISO_TIMESTAMP.test(value)) return false
  const parsed = new Date(value)
  if (!Number.isFinite(parsed.getTime())) return false
  const canonical = parsed.toISOString()
  return value.includes(".") ? canonical === value : canonical.replace(".000Z", "Z") === value
}

function isExactIsoDate(value: unknown): value is string {
  if (typeof value !== "string" || !ISO_DATE.test(value)) return false
  return new Date(`${value}T00:00:00.000Z`).toISOString().slice(0, 10) === value
}

export function isFinancialCutoverGovernanceGateComplete(
  input: unknown,
  evaluatedAt: Date = new Date(),
): input is FinancialCutoverGovernanceGate {
  const gate = record(input)
  if (!gate || !hasExactKeys(gate, GATE_KEYS)) return false
  if (typeof gate.domain !== "string" || !FINANCIAL_CUTOVER_GOVERNANCE_DOMAINS.includes(gate.domain as FinancialCutoverGovernanceDomain)) return false
  if (typeof gate.qualifiedReviewerIdentity !== "string" || gate.qualifiedReviewerIdentity.trim().length < 4) return false
  if (typeof gate.jurisdictionOrStandard !== "string" || gate.jurisdictionOrStandard.trim().length < 2) return false
  if (typeof gate.artifactHash !== "string" || !HASH.test(gate.artifactHash)) return false
  if (typeof gate.disposition !== "string" || gate.disposition.trim().length < 4) return false
  if (!isExactIsoTimestamp(gate.approvedAt) || new Date(gate.approvedAt) > evaluatedAt) return false
  if (gate.reReviewDate !== "no-expiry") {
    if (!isExactIsoDate(gate.reReviewDate)) return false
    if (new Date(`${gate.reReviewDate}T23:59:59.999Z`) <= evaluatedAt) return false
  }
  if (!Array.isArray(gate.conditions) || !Array.isArray(gate.conditionResolutions)) return false
  const conditions = gate.conditions as unknown[]
  const resolutions = gate.conditionResolutions as unknown[]
  if (!conditions.every((condition): condition is string => typeof condition === "string" && !!condition.trim())) return false
  if (new Set(conditions).size !== conditions.length || resolutions.length !== conditions.length) return false
  const parsedResolutions = resolutions.map(record)
  if (parsedResolutions.some((resolution) => !resolution || !hasExactKeys(resolution, RESOLUTION_KEYS))) return false
  if (new Set(parsedResolutions.map((resolution) => resolution?.condition)).size !== parsedResolutions.length) return false
  return conditions.every((condition) => parsedResolutions.some((resolution) =>
    resolution?.condition === condition && typeof resolution.evidenceHash === "string" && HASH.test(resolution.evidenceHash) &&
    isExactIsoTimestamp(resolution.resolvedAt) && new Date(resolution.resolvedAt) <= evaluatedAt,
  ))
}

export function isFinancialCutoverGovernanceUnlocked(
  gates: unknown[],
  evaluatedAt: Date = new Date(),
): gates is FinancialCutoverGovernanceGate[] {
  if (gates.length !== FINANCIAL_CUTOVER_GOVERNANCE_DOMAINS.length) return false
  const records = gates.map(record)
  if (records.some((gate) => !gate) || new Set(records.map((gate) => gate?.domain)).size !== gates.length) return false
  return FINANCIAL_CUTOVER_GOVERNANCE_DOMAINS.every((domain) => {
    const gate = gates.find((candidate) => record(candidate)?.domain === domain)
    return !!gate && isFinancialCutoverGovernanceGateComplete(gate, evaluatedAt)
  })
}

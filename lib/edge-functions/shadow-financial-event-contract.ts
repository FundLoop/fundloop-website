import { edgeCommandFailure, edgeCommandSuccess } from "./result.ts"

const HASH = /^[0-9a-f]{64}$/

export function validateShadowFinancialEvent(value: unknown, environment: string) {
  if (!["local", "dev", "test"].includes(environment)) {
    return edgeCommandFailure("production_disabled", "Shadow ingestion is unavailable in this environment.")
  }

  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return edgeCommandFailure("invalid_payload", "Expected an object.")
  }

  const event = value as Record<string, unknown>
  const legacyEvidence = event.legacyTimestampEvidence
  const validLegacyEvidence =
    legacyEvidence === undefined ||
    (legacyEvidence !== null && typeof legacyEvidence === "object" && !Array.isArray(legacyEvidence))
  const validSequence = event.providerSequence === undefined || Number.isInteger(event.providerSequence)

  if (
    typeof event.providerKey !== "string" ||
    event.providerKey.length === 0 ||
    typeof event.providerEventId !== "string" ||
    event.providerEventId.length === 0 ||
    !Number.isInteger(event.custodyAccountId) ||
    Number(event.custodyAccountId) <= 0 ||
    !Number.isInteger(event.assetId) ||
    Number(event.assetId) <= 0 ||
    typeof event.eventType !== "string" ||
    event.eventType.length === 0 ||
    !validSequence ||
    !/^\d+$/.test(String(event.settledNativeAmount)) ||
    typeof event.occurredAt !== "string" ||
    Number.isNaN(Date.parse(event.occurredAt)) ||
    typeof event.evidenceHash !== "string" ||
    !HASH.test(event.evidenceHash) ||
    !validLegacyEvidence
  ) {
    return edgeCommandFailure("invalid_payload", "External financial event fields are invalid.")
  }

  return edgeCommandSuccess(event)
}

import { edgeCommandFailure, edgeCommandSuccess } from "./result.ts"

const TYPES = new Set(["receipt", "fee", "allocation", "payout", "suspense"])
const STATUSES = new Set(["matched", "explained_variance", "unmatched", "suspense"])

export function validateShadowJournal(value: unknown, environment: string) {
  if (!["local", "dev", "test"].includes(environment)) {
    return edgeCommandFailure("production_disabled", "Shadow posting unavailable in this environment.")
  }

  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return edgeCommandFailure("invalid_payload", "Expected an object.")
  }

  const journal = value as Record<string, unknown>
  const detail = journal.detail
  const validDetail = detail === undefined || (detail !== null && typeof detail === "object" && !Array.isArray(detail))

  if (
    !Number.isInteger(journal.eventId) ||
    Number(journal.eventId) <= 0 ||
    !Number.isInteger(journal.ledgerTransactionId) ||
    Number(journal.ledgerTransactionId) <= 0 ||
    typeof journal.journalType !== "string" ||
    !TYPES.has(journal.journalType) ||
    typeof journal.comparisonStatus !== "string" ||
    !STATUSES.has(journal.comparisonStatus) ||
    typeof journal.evidenceHash !== "string" ||
    !/^[0-9a-f]{64}$/.test(journal.evidenceHash) ||
    !validDetail
  ) {
    return edgeCommandFailure("invalid_payload", "Shadow journal fields are invalid.")
  }

  return edgeCommandSuccess(journal)
}

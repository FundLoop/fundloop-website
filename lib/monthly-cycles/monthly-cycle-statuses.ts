export const unresolvedOnchainSubmissionStatuses = [
  "submitted",
  "confirming",
  "awaiting_confirmation",
  "pending",
] as const

export function isUnresolvedOnchainSubmissionStatus(status: string | null | undefined) {
  return unresolvedOnchainSubmissionStatuses.includes(status as (typeof unresolvedOnchainSubmissionStatuses)[number])
}

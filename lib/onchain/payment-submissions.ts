export type OnchainSubmissionStatus = "submitted" | "confirming" | "confirmed" | "failed"

export type OnchainSubmissionSummary = {
  id: number
  payment_id: number | null
  project_id: number
  payment_method_id: number
  period_id: number
  tx_hash: string
  wallet_address: string
  status: OnchainSubmissionStatus
  confirmation_count: number
  confirmation_depth: number
  failure_code: string | null
  failure_reason: string | null
  submitted_at: string
  last_checked_at: string | null
  reconciled_at: string | null
  matched_log_index: number | null
  chain: {
    id: number
    display_name: string
    network_key: string
  }
  asset: {
    id: number
    symbol: string
    is_native: boolean
  }
}

export function sortOnchainSubmissionSummaries(entries: OnchainSubmissionSummary[]) {
  return [...entries].sort((left, right) => {
    const submittedAtDiff = new Date(right.submitted_at).getTime() - new Date(left.submitted_at).getTime()
    if (submittedAtDiff !== 0) {
      return submittedAtDiff
    }

    return right.id - left.id
  })
}

export function buildLatestOnchainSubmissionMap(entries: OnchainSubmissionSummary[]) {
  const map = new Map<number, OnchainSubmissionSummary>()

  for (const entry of sortOnchainSubmissionSummaries(entries)) {
    if (entry.payment_id === null || map.has(entry.payment_id)) {
      continue
    }

    map.set(entry.payment_id, entry)
  }

  return map
}

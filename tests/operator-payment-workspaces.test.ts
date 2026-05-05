import { describe, expect, it } from "vitest"
import {
  buildAdminPaymentOperationsWorkspace,
  buildAdminPaymentReconciliationWorkspace,
  formatPaymentFailureSummary,
} from "@/lib/operator/payment-workspaces"
import type { OnchainSubmissionSummary } from "@/lib/onchain/payment-submissions"
import type { PaymentFlowEventListItem } from "@/lib/observability/payment-flow-server"
import type { PaymentRecordSummaryRow } from "@/lib/payments/payment-record-summary"

const paymentRow: PaymentRecordSummaryRow = {
  id: 101,
  project_id: 7,
  period_start: "2026-04-01",
  period_end: "2026-04-30",
  revenue: 1000,
  payment_amount: 50,
  payment_percentage: 5,
  payment_method_id: 3,
  status_id: 2,
  notes: null,
  created_at: "2026-05-01T00:00:00Z",
  updated_at: "2026-05-01T00:00:00Z",
  paid_at: null,
  confirmed_at: null,
  projects: { name: "Civic Mesh", slug: "civic-mesh" },
  ref_payment_methods: { name: "Crypto", code: "crypto" },
  ref_payment_statuses: { name: "Awaiting confirmation", code: "awaiting_confirmation" },
}

const submission: OnchainSubmissionSummary = {
  id: 501,
  payment_id: 101,
  project_id: 7,
  payment_method_id: 3,
  period_id: 202604,
  tx_hash: "0xabc",
  wallet_address: "0x123",
  status: "confirming",
  confirmation_count: 2,
  confirmation_depth: 6,
  failure_code: null,
  failure_reason: null,
  submitted_at: "2026-05-01T00:05:00Z",
  last_checked_at: null,
  reconciled_at: null,
  matched_log_index: null,
  chain: { id: 1, display_name: "Base", network_key: "base-sepolia" },
  asset: { id: 2, symbol: "USDC", is_native: false },
}

const failureEvent: PaymentFlowEventListItem = {
  id: 1,
  created_at: "2026-05-01T00:10:00Z",
  flow: "receipt_recording",
  stage: "submit",
  outcome: "failure",
  severity: "error",
  attempt_id: "attempt-123456789",
  actor_user_id: "user-1",
  actor_role: "project_admin",
  project_id: 7,
  payment_id: 101,
  submission_id: null,
  payment_method_id: 3,
  chain_id: 1,
  chain_asset_id: 2,
  intake_contract_id: 4,
  tx_hash: "0xabc",
  wallet_address: "0x123",
  environment: "preview",
  error_code: "receipt_failed",
  error_message: "Receipt could not be recorded.",
  metadata: {},
  project_name: "Civic Mesh",
  project_slug: "civic-mesh",
}

describe("operator payment workspace read models", () => {
  it("maps payment rows with latest onchain submission and warning state", () => {
    const workspace = buildAdminPaymentOperationsWorkspace({
      paymentRows: [paymentRow],
      latestOnchainSubmissionByPaymentId: new Map([[101, submission]]),
      recentFailures: [failureEvent],
      warnings: [{ code: "partial", message: "A secondary read failed." }],
    })

    expect(workspace.payments).toHaveLength(1)
    expect(workspace.payments[0]).toMatchObject({
      id: 101,
      project_name: "Civic Mesh",
      latest_onchain_submission: { id: 501, status: "confirming" },
    })
    expect(workspace.recentFailures).toHaveLength(1)
    expect(workspace.warnings).toEqual([{ code: "partial", message: "A secondary read failed." }])
  })

  it("keeps reconciliation row context optional when enrichment reads fail", () => {
    const workspace = buildAdminPaymentReconciliationWorkspace({
      queue: [submission],
      warnings: [{ code: "project_context_failed", message: "Project labels are unavailable." }],
      limit: 25,
    })

    expect(workspace.rows).toEqual([{ submission, project: null, payment: null }])
    expect(workspace.totals).toEqual({
      trackedSubmissions: 1,
      unresolvedSubmissions: 1,
      latestScopeLabel: "Showing the 25 most recent tracked submissions.",
    })
    expect(workspace.warnings).toHaveLength(1)
  })

  it("formats recent failure context once for page and future operator clients", () => {
    expect(formatPaymentFailureSummary(failureEvent)).toEqual({
      title: "receipt recording · submit",
      message: "Receipt could not be recorded.",
      context: "Attempt attempt- · Civic Mesh · Payment #101",
    })
  })
})

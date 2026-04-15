import { describe, expect, it, vi } from "vitest"
import { render, screen } from "@testing-library/react"

vi.mock("@/lib/zkas/auth", () => ({
  requireInternalAdminActor: vi.fn().mockResolvedValue({ userId: "admin-1" }),
}))

vi.mock("@/lib/observability/payment-flow-server", () => ({
  buildAttemptLabel: (attemptId: string) => `Attempt ${attemptId.slice(0, 8)}`,
  formatEventError: (event: { error_message: string | null; error_code: string | null; stage: string }) =>
    event.error_message ?? event.error_code ?? event.stage,
  listAttemptPaymentFlowEvents: vi.fn().mockResolvedValue([
    {
      id: 2,
      created_at: "2026-04-14T12:00:00.000Z",
      flow: "wallet_connect",
      stage: "timeout",
      outcome: "failure",
      severity: "warning",
      attempt_id: "attempt-xyz12345",
      actor_user_id: "user-1",
      actor_role: "project_admin",
      project_id: 7,
      payment_id: 22,
      submission_id: null,
      payment_method_id: null,
      chain_id: null,
      chain_asset_id: null,
      intake_contract_id: null,
      tx_hash: null,
      wallet_address: null,
      environment: "preview",
      error_code: "wallet_connect_timeout",
      error_message: "Wallet connection timed out.",
      metadata: {},
      project_name: "FundLoop Studio",
      project_slug: "fundloop-studio",
    },
  ]),
  listPaymentFlowEvents: vi.fn().mockResolvedValue([
    {
      id: 1,
      created_at: "2026-04-14T12:00:00.000Z",
      flow: "payment_save",
      stage: "submit",
      outcome: "failure",
      severity: "error",
      attempt_id: "attempt-abc12345",
      actor_user_id: "user-1",
      actor_role: "project_admin",
      project_id: 7,
      payment_id: 22,
      submission_id: null,
      payment_method_id: null,
      chain_id: null,
      chain_asset_id: null,
      intake_contract_id: null,
      tx_hash: null,
      wallet_address: null,
      environment: "preview",
      error_code: "submit_failed",
      error_message: "Could not save payments",
      metadata: {},
      project_name: "FundLoop Studio",
      project_slug: "fundloop-studio",
    },
  ]),
  listPaymentFlowSummaries: vi.fn().mockResolvedValue([
    {
      flow: "wallet_connect",
      last24h: { attempts: 2, successes: 1, failures: 1, latestFailureAt: "2026-04-14T12:00:00.000Z" },
      last7d: { attempts: 5, successes: 3, failures: 2, latestFailureAt: "2026-04-14T12:00:00.000Z" },
    },
    {
      flow: "payment_save",
      last24h: { attempts: 4, successes: 3, failures: 1, latestFailureAt: "2026-04-14T12:00:00.000Z" },
      last7d: { attempts: 6, successes: 5, failures: 1, latestFailureAt: "2026-04-14T12:00:00.000Z" },
    },
    {
      flow: "receipt_recording",
      last24h: { attempts: 1, successes: 1, failures: 0, latestFailureAt: null },
      last7d: { attempts: 3, successes: 2, failures: 1, latestFailureAt: "2026-04-13T12:00:00.000Z" },
    },
    {
      flow: "admin_confirmation",
      last24h: { attempts: 2, successes: 2, failures: 0, latestFailureAt: null },
      last7d: { attempts: 2, successes: 2, failures: 0, latestFailureAt: null },
    },
  ]),
}))

describe("AdminPaymentsObservabilityPage", () => {
  it("renders summary cards, filtered events, and attempt drill-downs", async () => {
    const Page = (await import("@/app/[locale]/admin/payments/observability/page")).default
    render(
      await Page({
        searchParams: Promise.resolve({
          attemptId: "attempt-xyz12345",
          days: "7",
        }),
      }),
    )

    expect(screen.getByText("Payment Flow Observability")).toBeTruthy()
    expect(screen.getAllByText("wallet connect").length).toBeGreaterThan(0)
    expect(screen.getByText("Could not save payments")).toBeTruthy()
    expect(screen.getAllByText(/Attempt attempt-/i).length).toBeGreaterThan(0)
  })
})

import { describe, expect, it, vi } from "vitest"
import { sanitizePaymentFlowMetadata } from "@/lib/observability/payment-flow"
import { recordPaymentFlowEvent, summarizePaymentFlowEvents } from "@/lib/observability/payment-flow-server"

const insert = vi.fn()

vi.mock("@/lib/supabase-admin", () => ({
  getAdminSupabaseClient: () => ({
    from: () => ({
      insert,
    }),
  }),
}))

describe("payment flow observability helpers", () => {
  it("sanitizes nested metadata into a compact json payload", () => {
    const metadata = sanitizePaymentFlowMetadata({
      note: "x".repeat(400),
      nested: {
        values: [1, 2, 3],
      },
      bigint: BigInt(42),
    })

    expect(metadata).toMatchObject({
      nested: {
        values: [1, 2, 3],
      },
      bigint: "42",
    })
    expect((metadata as { note: string }).note.length).toBeLessThanOrEqual(300)
  })

  it("summarizes distinct attempts, successes, and failures by flow window", () => {
    const now = new Date("2026-04-14T12:00:00.000Z")
    const summaries = summarizePaymentFlowEvents(
      [
        {
          id: 1,
          created_at: "2026-04-14T11:30:00.000Z",
          flow: "wallet_connect",
          stage: "cta_click",
          outcome: "attempt",
          severity: "info",
          attempt_id: "attempt-a",
          actor_user_id: null,
          actor_role: "authenticated_user",
          project_id: null,
          payment_id: null,
          submission_id: null,
          payment_method_id: null,
          chain_id: null,
          chain_asset_id: null,
          intake_contract_id: null,
          tx_hash: null,
          wallet_address: null,
          environment: "preview",
          error_code: null,
          error_message: null,
          metadata: {},
        },
        {
          id: 2,
          created_at: "2026-04-14T11:31:00.000Z",
          flow: "wallet_connect",
          stage: "connected",
          outcome: "success",
          severity: "info",
          attempt_id: "attempt-a",
          actor_user_id: null,
          actor_role: "authenticated_user",
          project_id: null,
          payment_id: null,
          submission_id: null,
          payment_method_id: null,
          chain_id: null,
          chain_asset_id: null,
          intake_contract_id: null,
          tx_hash: null,
          wallet_address: null,
          environment: "preview",
          error_code: null,
          error_message: null,
          metadata: {},
        },
        {
          id: 3,
          created_at: "2026-04-14T10:00:00.000Z",
          flow: "payment_save",
          stage: "submit",
          outcome: "failure",
          severity: "error",
          attempt_id: "attempt-b",
          actor_user_id: "user-1",
          actor_role: "project_admin",
          project_id: 7,
          payment_id: null,
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
        },
      ],
      now,
    )

    expect(summaries.find((summary) => summary.flow === "wallet_connect")).toMatchObject({
      last24h: {
        attempts: 1,
        successes: 1,
        failures: 0,
      },
    })
    expect(summaries.find((summary) => summary.flow === "payment_save")).toMatchObject({
      last24h: {
        attempts: 0,
        successes: 0,
        failures: 1,
      },
    })
  })

  it("swallows insert failures so observability cannot break the product flow", async () => {
    insert.mockResolvedValueOnce({ error: new Error("insert failed") })

    await expect(
      recordPaymentFlowEvent({
        flow: "payment_save",
        stage: "submit",
        outcome: "failure",
        attemptId: "attempt-safe",
        environment: "preview",
        errorMessage: "boom",
      }),
    ).resolves.toBeUndefined()
  })
})

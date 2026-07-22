import { describe, expect, it } from "vitest"
import { buildMonthlyCyclePayoutOverview } from "@/lib/monthly-cycles/monthly-cycle-payouts"

const cycle = {
  id: 1,
  cycle_key: "2026-05",
  period_start: "2026-05-01",
  period_end: "2026-05-31",
  status: "distribution" as const,
  approval_started_at: "2026-06-02T00:00:00Z",
  distribution_started_at: "2026-06-03T00:00:00Z",
  status_note: "Bookkeeping credits created. No payout transfers executed.",
}

describe("monthly cycle payout overview", () => {
  it("summarizes bookkeeping credits and returned future-pool rows separately from payout intents", () => {
    const overview = buildMonthlyCyclePayoutOverview({
      cycle,
      publishedResults: [
        { id: 10, allocation_usd: 300 },
        { id: 11, allocation_usd: 120 },
      ],
      bookkeepingCredits: [
        {
          id: 20,
          user_id: "00000000-0000-4000-8000-000000000101",
          usd_equivalent_amount: 300,
          status: "credited",
          payment_status: "not_paid",
          asset_fills: [{ assetCode: "USDC" }, { assetCode: "USD" }],
        },
        {
          id: 21,
          user_id: "00000000-0000-4000-8000-000000000102",
          usd_equivalent_amount: 120,
          status: "credited",
          payment_status: "not_paid",
          asset_fills: [{ assetCode: "USD" }],
        },
      ],
      returnedPools: [
        {
          id: 30,
          project_id: 7,
          asset_type: "project_token",
          asset_code: "CIVIC",
          usd_value: 45,
          reason_code: "preference_unfulfillable",
        },
      ],
      intents: [],
      batches: [],
      reconciliationEvents: [],
      warnings: [],
    })

    expect(overview.bookkeepingCredits).toMatchObject({
      count: 2,
      userCount: 2,
      totalCreditedUsd: 420,
      notPaidCount: 2,
      voidedCount: 0,
      assetFillCount: 3,
    })
    expect(overview.returnedPools).toMatchObject({
      count: 1,
      totalAmountUsd: 45,
    })
    expect(overview.intents.count).toBe(0)
  })
})

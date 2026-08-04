import { describe, expect, it } from "vitest"
import { buildUserEarningsWorkspace } from "@/lib/workspace/user-earnings-workspace"

describe("buildUserEarningsWorkspace", () => {
  it("summarizes credited-not-paid bookkeeping earnings with asset fills and source breakdown", () => {
    const workspace = buildUserEarningsWorkspace({
      publishedResults: [],
      cycles: [{ id: 1, cycle_key: "2026-04", status: "distribution" }],
      runs: [{ id: 7, month: "2026-04" }],
      projects: [{ id: 7, name: "Origin Project" }],
      payoutRoutes: [],
      payoutIntents: [],
      bookkeepingCredits: [
        {
          id: 30,
          monthly_cycle_id: 1,
          run_id: 7,
          source_result_id: 10,
          usd_equivalent_amount: 125,
          currency_code: "USD",
          status: "credited",
          payment_status: "not_paid",
          credited_at: "2026-05-01T00:00:00Z",
          asset_fills: [
            {
              assetType: "stablecoin",
              assetCode: "USDC",
              sourceAmount: 100,
              usdValue: 100,
              preferenceRank: 1,
              partial: true,
              projectId: 7,
            },
            {
              assetType: "fiat",
              assetCode: "USD",
              sourceAmount: 25,
              usdValue: 25,
              preferenceRank: 2,
              partial: false,
              projectId: 7,
            },
          ],
          source_breakdown: [
            {
              projectId: 7,
              scopedCubidId: "scoped-user-1",
              attributionPoints: 10,
              totalProjectPoints: 40,
              projectPoolUsd: 500,
              rawEntitlementUsd: 100,
            },
          ],
          allocation_breakdown: {
            rawEntitlementUsd: 100,
            baselineUsd: 100,
            equalizationTopUpUsd: 25,
            capMultiple: 3,
            capApplied: false,
          },
        },
      ],
      batchItems: [],
      batches: [],
      reconciliationEvents: [],
      warnings: [],
    })

    expect(workspace.summary).toMatchObject({
      creditCount: 1,
      totalCreditedUsd: 125,
      paidPayoutUsd: 0,
      pendingPayoutUsd: 0,
    })
    expect(workspace.credits[0]).toMatchObject({
      key: "2026-04",
      status: "credited",
      paymentStatus: "not_paid",
      usdEquivalentAmount: 125,
      assetFills: [
        expect.objectContaining({ assetCode: "USDC", partial: true }),
        expect.objectContaining({ assetCode: "USD", preferenceRank: 2 }),
      ],
      sourceBreakdown: [expect.objectContaining({ projectName: "Origin Project", scopedCubidId: "scoped-user-1", rawEntitlementUsd: 100 })],
      allocationBreakdown: expect.objectContaining({ baselineUsd: 100, equalizationTopUpUsd: 25 }),
    })
  })

  it("shows published results as route-required earnings when payout intents have not been created", () => {
    const workspace = buildUserEarningsWorkspace({
      publishedResults: [
        {
          id: 10,
          monthly_cycle_id: 1,
          allocation_usd: 125,
          aggregate_score: 220,
          published_at: "2026-04-30T00:00:00Z",
          run_id: 7,
        },
      ],
      cycles: [{ id: 1, cycle_key: "2026-04", status: "approval" }],
      runs: [{ id: 7, month: "2026-04" }],
      payoutRoutes: [],
      payoutIntents: [],
      batchItems: [],
      batches: [],
      reconciliationEvents: [],
      warnings: [],
    })

    expect(workspace.summary).toMatchObject({
      resultCount: 1,
      payoutIntentCount: 0,
      totalPublishedAllocationUsd: 125,
      totalPayoutIntentUsd: 0,
      hasDefaultRoute: false,
      nextAction: "add_payout_route",
    })
    expect(workspace.cycles[0]).toMatchObject({
      key: "2026-04",
      cycleStatus: "approval",
      payoutStatus: "not_created",
      payoutAmountUsd: null,
    })
    expect(workspace.pendingDistributions).toEqual([])
  })

  it("summarizes pending payout intents, routes, batches, and reconciliation status", () => {
    const workspace = buildUserEarningsWorkspace({
      publishedResults: [
        {
          id: 10,
          monthly_cycle_id: 1,
          allocation_usd: 125,
          aggregate_score: 220,
          published_at: "2026-04-30T00:00:00Z",
          run_id: 7,
        },
      ],
      cycles: [{ id: 1, cycle_key: "2026-04", status: "distribution" }],
      runs: [],
      payoutRoutes: [
        {
          id: 3,
          label: "Main wallet",
          rail: "evm",
          currency_code: "USD",
          status: "active",
          is_default: true,
        },
      ],
      payoutIntents: [
        {
          id: 20,
          monthly_cycle_id: 1,
          source_result_id: 10,
          payout_route_id: 3,
          rail: "evm",
          amount_usd: 125,
          currency_code: "USD",
          status: "processing",
          status_reason: null,
        },
      ],
      batchItems: [{ payout_intent_id: 20, payout_batch_id: 30, status: "processing" }],
      batches: [{ id: 30, status: "processing" }],
      reconciliationEvents: [
        {
          payout_intent_id: 20,
          status: "pending",
          created_at: "2026-05-01T00:00:00Z",
        },
      ],
      warnings: [],
    })

    expect(workspace.summary).toMatchObject({
      totalPayoutIntentUsd: 125,
      pendingPayoutUsd: 125,
      paidPayoutUsd: 0,
      activeRouteCount: 1,
      hasDefaultRoute: true,
      nextAction: "wait_for_distribution",
    })
    expect(workspace.routes.defaultRoute).toMatchObject({ label: "Main wallet", rail: "evm" })
    expect(workspace.pendingDistributions[0]).toMatchObject({
      payoutStatus: "processing",
      batchStatus: "processing",
      reconciliationStatus: "pending",
      routeLabel: "Main wallet",
    })
  })

  it("separates paid history from current pending distributions", () => {
    const workspace = buildUserEarningsWorkspace({
      publishedResults: [
        {
          id: 10,
          monthly_cycle_id: 1,
          allocation_usd: 125,
          aggregate_score: 220,
          published_at: "2026-04-30T00:00:00Z",
          run_id: 7,
        },
      ],
      cycles: [{ id: 1, cycle_key: "2026-04", status: "completed" }],
      runs: [],
      payoutRoutes: [
        {
          id: 3,
          label: "",
          rail: "solana",
          currency_code: "USD",
          status: "active",
          is_default: true,
        },
      ],
      payoutIntents: [
        {
          id: 20,
          monthly_cycle_id: 1,
          source_result_id: 10,
          payout_route_id: 3,
          rail: "solana",
          amount_usd: 125,
          currency_code: "USD",
          status: "paid",
          status_reason: null,
        },
      ],
      batchItems: [],
      batches: [],
      reconciliationEvents: [],
      warnings: [{ scope: "payout-routes", message: "partial read" }],
    })

    expect(workspace.summary.paidPayoutUsd).toBe(125)
    expect(workspace.summary.pendingPayoutUsd).toBe(0)
    expect(workspace.summary.nextAction).toBe("review_history")
    expect(workspace.routes.defaultRoute?.label).toBe("solana")
    expect(workspace.pendingDistributions).toEqual([])
    expect(workspace.payoutHistory).toHaveLength(1)
    expect(workspace.warnings).toEqual([{ scope: "payout-routes", message: "partial read" }])
  })
})

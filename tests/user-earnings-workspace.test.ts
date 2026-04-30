import { describe, expect, it } from "vitest"
import { buildUserEarningsWorkspace } from "@/lib/workspace/user-earnings-workspace"

describe("buildUserEarningsWorkspace", () => {
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

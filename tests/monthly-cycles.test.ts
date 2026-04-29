import { describe, expect, it } from "vitest"
import { buildMonthlyCycleAdminOverview, parseMonthlyCycleKey } from "@/lib/monthly-cycles"

const baseCycle = {
  id: 1,
  cycle_key: "2026-04",
  year: 2026,
  month: 4,
  period_start: "2026-04-01",
  period_end: "2026-04-30",
  status: "open" as const,
  opened_at: "2026-04-01T00:00:00Z",
  locked_at: null,
  locked_by_user_id: null,
  locked_manifest_hash: null,
  lock_override_unresolved_onchain: false,
  lock_override_reason: null,
  prep_started_at: null,
  calculation_started_at: null,
  verification_started_at: null,
  approval_started_at: null,
  distribution_started_at: null,
  completed_at: null,
  reporting_published_at: null,
  operator_note: null,
  status_note: null,
}

function buildOverview(overrides: Partial<Parameters<typeof buildMonthlyCycleAdminOverview>[0]> = {}) {
  return buildMonthlyCycleAdminOverview({
    cycles: [baseCycle],
    payments: [
      {
        monthly_cycle_id: 1,
        revenue: 1000,
        payment_amount: 30,
        ref_payment_statuses: { code: "confirmed" },
      },
      {
        monthly_cycle_id: 1,
        revenue: 2000,
        payment_amount: 60,
        ref_payment_statuses: { code: "awaiting_confirmation" },
      },
    ],
    onchainSubmissions: [
      { monthly_cycle_id: 1, status: "submitted" },
      { monthly_cycle_id: 1, status: "confirming" },
      { monthly_cycle_id: 1, status: "confirmed" },
      { monthly_cycle_id: 1, status: "failed" },
    ],
    datasets: [
      { monthly_cycle_id: 1, status: "approved" },
      { monthly_cycle_id: 1, status: "uploaded" },
    ],
    identityArtifacts: [{ monthly_cycle_id: 1, status: "approved" }],
    runs: [
      {
        monthly_cycle_id: 1,
        month: "2026-04",
        status: "finalized",
        total_allocated_usd: 75,
        published_at: "2026-04-18T00:00:00Z",
        created_at: "2026-04-17T00:00:00Z",
      },
    ],
    publishedResults: [
      { monthly_cycle_id: 1, allocation_usd: 25 },
      { monthly_cycle_id: 1, allocation_usd: 50 },
    ],
    projectSummaries: [{ monthly_cycle_id: 1, id: 10 }],
    warnings: [],
    ...overrides,
  })
}

describe("parseMonthlyCycleKey", () => {
  it("parses valid cycle keys into calendar bounds", () => {
    expect(parseMonthlyCycleKey("2026-04")).toEqual({
      cycleKey: "2026-04",
      year: 2026,
      month: 4,
      periodStart: "2026-04-01",
      periodEndExclusive: "2026-05-01",
      periodEnd: "2026-04-30",
    })
  })

  it("rejects invalid month keys", () => {
    expect(() => parseMonthlyCycleKey("2026-13")).toThrow("Invalid month string")
    expect(() => parseMonthlyCycleKey("April 2026")).toThrow("Invalid month string")
  })
})

describe("buildMonthlyCycleAdminOverview", () => {
  it("handles no cycles as a calm empty overview", () => {
    const overview = buildMonthlyCycleAdminOverview({
      cycles: [],
      payments: [],
      onchainSubmissions: [],
      datasets: [],
      identityArtifacts: [],
      runs: [],
      publishedResults: [],
      projectSummaries: [],
      warnings: [],
    })

    expect(overview.cycles).toEqual([])
    expect(overview.totals).toMatchObject({
      cycleCount: 0,
      paymentCount: 0,
      totalContributionAmount: 0,
      zkasRunCount: 0,
    })
  })

  it("summarizes linked payments, reconciliation, zkAS rows, and published allocations", () => {
    const overview = buildOverview()

    expect(overview.cycles[0]).toMatchObject({
      cycleKey: "2026-04",
      statusLabel: "Open",
      payments: {
        count: 2,
        confirmedCount: 1,
        awaitingConfirmationCount: 1,
        totalRevenue: 3000,
        totalContributionAmount: 90,
      },
      reconciliation: {
        submissionCount: 4,
        confirmedCount: 1,
        unresolvedCount: 2,
        failedCount: 1,
      },
      zkas: {
        datasetCount: 2,
        approvedDatasetCount: 1,
        identityArtifactCount: 1,
        runCount: 1,
        latestRunStatus: "finalized",
        latestPublishedMonth: "2026-04",
        publishedResultCount: 2,
        projectSummaryCount: 1,
        totalPublishedAllocationUsd: 75,
      },
    })
    expect(overview.totals).toMatchObject({
      cycleCount: 1,
      openCycleCount: 1,
      lockedOrLaterCycleCount: 0,
      paymentCount: 2,
      totalContributionAmount: 90,
      zkasRunCount: 1,
    })
  })

  it("tracks locked-or-later cycles separately from open cycles", () => {
    const overview = buildOverview({
      cycles: [{ ...baseCycle, status: "verification", locked_at: "2026-05-01T00:00:00Z" }],
    })

    expect(overview.totals.openCycleCount).toBe(0)
    expect(overview.totals.lockedOrLaterCycleCount).toBe(1)
    expect(overview.cycles[0]?.statusLabel).toBe("Verification")
  })

  it("preserves partial read warnings without crashing the overview", () => {
    const overview = buildOverview({
      payments: [],
      warnings: [{ scope: "payments", message: "column unavailable" }],
    })

    expect(overview.warnings).toEqual([{ scope: "payments", message: "column unavailable" }])
    expect(overview.cycles[0]?.payments.count).toBe(0)
  })
})

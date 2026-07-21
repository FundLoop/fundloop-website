import { describe, expect, it } from "vitest"
import {
  buildFounderProjectReportingWorkspace,
  buildOperatorCycleReportingWorkspace,
  buildPublicReportingOverview,
  buildUserReportingWorkspace,
} from "@/lib/reporting/monthly-cycle-reports"

const cycle = {
  id: 1,
  cycle_key: "2026-04",
  status: "reporting" as const,
  reporting_published_at: "2026-05-03T00:00:00Z",
}

const report = {
  id: 10,
  monthly_cycle_id: 1,
  audience: "public" as const,
  title: "April loop report",
  summary: "A truthful public summary.",
  artifact_bucket: "monthly-cycle-reports",
  artifact_path: "2026-04/public/report.md",
  artifact_mime_type: "text/markdown",
  artifact_hash: "abc123",
  published_at: "2026-05-03T00:00:00Z",
  subject_project_id: null,
  subject_user_id: null,
  payload: { cycleKey: "2026-04" },
}

describe("monthly cycle reporting read models", () => {
  it("builds the public reporting overview from published report rows", () => {
    const overview = buildPublicReportingOverview({
      reports: [report],
      cycles: [cycle],
      warnings: [],
    })

    expect(overview.totals).toEqual({
      publishedReportCount: 1,
      latestCycleKey: "2026-04",
    })
    expect(overview.reports[0]).toMatchObject({
      cycleKey: "2026-04",
      title: "April loop report",
      artifact: {
        bucket: "monthly-cycle-reports",
        path: "2026-04/public/report.md",
        hash: "abc123",
      },
    })
  })

  it("adds pending user report placeholders for published results without report artifacts", () => {
    const workspace = buildUserReportingWorkspace({
      reports: [],
      cycles: [cycle],
      results: [{ monthly_cycle_id: 1, allocation_usd: 42 }],
      warnings: [],
    })

    expect(workspace.resultCount).toBe(1)
    expect(workspace.totalAllocationUsd).toBe(42)
    expect(workspace.reports[0]).toMatchObject({
      id: null,
      cycleKey: "2026-04",
      audience: "user",
    })
  })

  it("maps founder project summaries into cycle-indexed reporting rows", () => {
    const workspace = buildFounderProjectReportingWorkspace({
      project: { id: 7, slug: "civic-mesh", name: "Civic Mesh" },
      reports: [{ ...report, audience: "founder", subject_project_id: 7 }],
      cycles: [cycle],
      summaries: [
        {
          monthly_cycle_id: 1,
          project_id: 7,
          active_user_count: 12,
          published_user_count: 10,
          attributed_payout_usd: 250,
          contributed_amount_usd: 500,
        },
      ],
      assetFills: [
        {
          monthly_cycle_id: 1,
          project_id: 7,
          usd_value: 175,
        },
        {
          monthly_cycle_id: 1,
          project_id: 7,
          usd_value: 25,
        },
      ],
      returnedPools: [
        {
          monthly_cycle_id: 1,
          project_id: 7,
          usd_value: 40,
        },
      ],
      warnings: [],
    })

    expect(workspace.project.slug).toBe("civic-mesh")
    expect(workspace.reports[0]?.audience).toBe("founder")
    expect(workspace.summaries[0]).toMatchObject({
      cycleKey: "2026-04",
      publishedUserCount: 10,
      attributedPayoutUsd: 250,
    })
    expect(workspace.bookkeeping[0]).toMatchObject({
      cycleKey: "2026-04",
      creditedUsd: 200,
      returnedFuturePoolUsd: 40,
      assetFillCount: 2,
      returnedPoolCount: 1,
    })
  })

  it("summarizes operator reporting coverage for a cycle", () => {
    const workspace = buildOperatorCycleReportingWorkspace({
      cycle,
      reports: [
        report,
        { ...report, id: 11, audience: "operator", title: "Operator audit report" },
        { ...report, id: 12, audience: "user", subject_user_id: "user-1", artifact_path: null, artifact_hash: null },
        { ...report, id: 13, audience: "founder", subject_project_id: 7 },
      ],
      publishedResults: [
        { monthly_cycle_id: 1, allocation_usd: 42 },
        { monthly_cycle_id: 1, allocation_usd: 58 },
      ],
      projectSummaries: [
        {
          monthly_cycle_id: 1,
          project_id: 7,
          active_user_count: 12,
          published_user_count: 10,
          attributed_payout_usd: 250,
          contributed_amount_usd: 500,
        },
      ],
      warnings: [],
    })

    expect(workspace.reports).toMatchObject({
      userCount: 1,
      founderCount: 1,
      artifactCount: 3,
    })
    expect(workspace.metrics).toMatchObject({
      publishedUserResultCount: 2,
      projectSummaryCount: 1,
      totalPublishedAllocationUsd: 100,
    })
  })
})

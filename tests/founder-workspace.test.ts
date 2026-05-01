import { describe, expect, it } from "vitest"
import {
  buildFounderWorkspaceHome,
  findFounderWorkspaceProject,
  type FounderWorkspaceWarning,
} from "@/lib/workspace/founder-workspace"

const managedProjects = [
  { id: 1, slug: "solar-commons", name: "Solar Commons" },
  { id: 2, slug: null, name: "Untitled Project" },
]

function buildHome(overrides: Partial<Parameters<typeof buildFounderWorkspaceHome>[0]> = {}) {
  const warnings: FounderWorkspaceWarning[] = []

  return buildFounderWorkspaceHome({
    managedProjects,
    projectRows: [
      {
        id: 1,
        slug: "solar-commons",
        name: "Solar Commons",
        description: "Community solar revenue loop",
        logo_url: null,
        is_public: true,
        status: "active",
        payment_percentage: 3,
        default_payment_method_id: 10,
      },
      {
        id: 2,
        slug: null,
        name: "Untitled Project",
        description: null,
        logo_url: null,
        is_public: false,
        status: "draft",
        payment_percentage: null,
        default_payment_method_id: null,
      },
    ],
    payments: [
      {
        project_id: 1,
        period_start: "2026-03-01",
        period_end: "2026-03-31",
        revenue: 1000,
        payment_amount: 30,
        ref_payment_statuses: { code: "confirmed" },
      },
      {
        project_id: 1,
        period_start: "2026-04-01",
        period_end: "2026-04-30",
        revenue: 1200,
        payment_amount: 36,
        ref_payment_statuses: { code: "awaiting_confirmation" },
      },
    ],
    paymentMethods: [
      { project_id: 1, id: 10, is_enabled: true },
      { project_id: 1, id: 11, is_enabled: false },
    ],
    participants: [
      { project_id: 1, is_admin: true },
      { project_id: 1, is_admin: false },
      { project_id: 2, is_admin: true },
    ],
    datasets: [
      {
        id: 100,
        project_id: 1,
        month: "2026-04",
        file_name: "solar-commons-2026-04.csv",
        status: "ready",
        row_count: 42,
        validation_summary: { issueCounts: { errors: 0, warnings: 1 } },
        created_at: "2026-04-15T00:00:00Z",
      },
    ],
    runSummaries: [
      {
        project_id: 1,
        run_id: 7,
        active_user_count: 20,
        published_user_count: 18,
        attributed_payout_usd: 25,
        contributed_amount_usd: 36,
        created_at: "2026-04-16T00:00:00Z",
      },
    ],
    runs: [{ id: 7, month: "2026-04", published_at: "2026-04-17T00:00:00Z" }],
    stats: [
      {
        project_id: 1,
        year: 2026,
        month: 4,
        monthly_revenue: 1200,
        contributed_amount: 36,
        unique_user_count: 25,
        actual_percentage: 3,
        pledged_percentage: 3,
      },
    ],
    warnings,
    ...overrides,
  })
}

describe("buildFounderWorkspaceHome", () => {
  it("returns an empty founder state when there are no managed projects", () => {
    const home = buildFounderWorkspaceHome({
      managedProjects: [],
      projectRows: [],
      payments: [],
      paymentMethods: [],
      participants: [],
      datasets: [],
      runSummaries: [],
      runs: [],
      stats: [],
      warnings: [],
    })

    expect(home.hasProjects).toBe(false)
    expect(home.projects).toEqual([])
    expect(home.totals.projectCount).toBe(0)
  })

  it("summarizes managed project setup, payments, attribution, growth, and team context", () => {
    const home = buildHome()
    const project = home.projects[0]

    expect(project?.setup).toMatchObject({
      hasSlug: true,
      hasContributionRate: true,
      hasDefaultPaymentMethod: true,
      enabledPaymentMethodCount: 1,
      isReady: true,
      missingItems: [],
    })
    expect(project?.payments).toMatchObject({
      paymentCount: 2,
      awaitingConfirmationCount: 1,
      confirmedCount: 1,
      totalRevenue: 2200,
      totalContributionAmount: 66,
      latestPeriodLabel: "2026-04-01 - 2026-04-30",
    })
    expect(project?.contributionCycles).toEqual([
      expect.objectContaining({
        cycleKey: "2026-04",
        status: "awaiting_confirmation",
        revenue: 1200,
        contributionAmount: 36,
        awaitingConfirmationCount: 1,
      }),
      expect.objectContaining({
        cycleKey: "2026-03",
        status: "confirmed",
        revenue: 1000,
        contributionAmount: 30,
        confirmedCount: 1,
      }),
    ])
    expect(project?.attribution).toMatchObject({
      datasetCount: 1,
      approvedDatasetCount: 0,
      issueCount: 1,
      latestDatasetMonth: "2026-04",
      latestDatasetStatus: "ready",
      latestDatasetRowCount: 42,
      recentSubmissions: [
        expect.objectContaining({
          id: 100,
          fileName: "solar-commons-2026-04.csv",
          issueCount: 1,
          rowCount: 42,
        }),
      ],
    })
    expect(project?.reporting).toMatchObject({
      latestPublishedMonth: "2026-04",
      activeUserCount: 20,
      publishedUserCount: 18,
    })
    expect(project?.growth).toMatchObject({
      latestMonthLabel: "2026-04",
      monthlyRevenue: 1200,
      contributedAmount: 36,
      uniqueUserCount: 25,
    })
    expect(project?.team).toMatchObject({ memberCount: 2, adminCount: 1 })
    expect(home.totals).toMatchObject({
      projectCount: 2,
      readyProjectCount: 1,
      needsSetupProjectCount: 1,
      totalRevenue: 2200,
      totalContributionAmount: 66,
      pendingPaymentCount: 1,
      confirmedPaymentCount: 1,
      datasetCount: 1,
      latestPublishedMonth: "2026-04",
    })
  })

  it("surfaces missing slug and payment setup flags explicitly", () => {
    const home = buildHome()
    const draftProject = home.projects[1]

    expect(draftProject?.slug).toBeNull()
    expect(draftProject?.setup.isReady).toBe(false)
    expect(draftProject?.setup.missingItems).toEqual([
      "slug",
      "contribution_rate",
      "payment_method",
      "default_payment_method",
    ])
  })

  it("groups monthly contribution cycles by period and exposes actionable statuses", () => {
    const home = buildHome({
      payments: [
        {
          project_id: 1,
          period_start: "2026-05-01",
          period_end: "2026-05-31",
          revenue: 1500,
          payment_amount: 45,
          ref_payment_statuses: { code: "pending" },
        },
        {
          project_id: 1,
          period_start: "2026-05-01",
          period_end: "2026-05-31",
          revenue: 500,
          payment_amount: 15,
          ref_payment_statuses: { code: "draft" },
        },
      ],
    })

    expect(home.projects[0]?.contributionCycles).toEqual([
      expect.objectContaining({
        cycleKey: "2026-05",
        paymentCount: 2,
        revenue: 2000,
        contributionAmount: 60,
        draftCount: 1,
        pendingCount: 1,
        status: "needs_submission",
      }),
    ])
  })

  it("preserves soft read warnings without crashing the built home", () => {
    const warnings = [{ scope: "payments", message: "network unavailable" }]
    const home = buildHome({ payments: [], warnings })

    expect(home.warnings).toEqual(warnings)
    expect(home.projects[0]?.payments.paymentCount).toBe(0)
    expect(home.totals.totalContributionAmount).toBe(0)
  })

  it("uses the latest published month across all managed projects for aggregate reporting", () => {
    const home = buildFounderWorkspaceHome({
      managedProjects: [
        { id: 1, slug: "alpha-project", name: "Alpha Project" },
        { id: 2, slug: "zeta-project", name: "Zeta Project" },
      ],
      projectRows: [
        {
          id: 1,
          slug: "alpha-project",
          name: "Alpha Project",
          description: null,
          logo_url: null,
          is_public: true,
          status: "active",
          payment_percentage: 1,
          default_payment_method_id: null,
        },
        {
          id: 2,
          slug: "zeta-project",
          name: "Zeta Project",
          description: null,
          logo_url: null,
          is_public: true,
          status: "active",
          payment_percentage: 1,
          default_payment_method_id: null,
        },
      ],
      payments: [],
      paymentMethods: [],
      participants: [],
      datasets: [],
      runSummaries: [
        {
          project_id: 1,
          run_id: 21,
          active_user_count: 5,
          published_user_count: 4,
          attributed_payout_usd: 20,
          contributed_amount_usd: 25,
          created_at: "2026-02-16T00:00:00Z",
        },
        {
          project_id: 2,
          run_id: 22,
          active_user_count: 8,
          published_user_count: 7,
          attributed_payout_usd: 30,
          contributed_amount_usd: 35,
          created_at: "2026-04-16T00:00:00Z",
        },
      ],
      runs: [
        { id: 21, month: "2026-02", published_at: "2026-02-17T00:00:00Z" },
        { id: 22, month: "2026-04", published_at: "2026-04-17T00:00:00Z" },
      ],
      stats: [],
      warnings: [],
    })

    expect(home.projects[0]?.reporting.latestPublishedMonth).toBe("2026-02")
    expect(home.projects[1]?.reporting.latestPublishedMonth).toBe("2026-04")
    expect(home.totals.latestPublishedMonth).toBe("2026-04")
  })

  it("only resolves per-project homes for managed slugs", () => {
    const home = buildHome()

    expect(findFounderWorkspaceProject(home, "solar-commons")?.name).toBe("Solar Commons")
    expect(findFounderWorkspaceProject(home, "unknown-project")).toBeNull()
  })
})

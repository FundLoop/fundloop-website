import "server-only"

import type { ManagedProjectSummary, NavigationContext } from "@/lib/navigation-context"
import { getAdminSupabaseClient } from "@/lib/supabase-admin"
import { createServerSupabaseClient } from "@/lib/supabase-server"

export type FounderWorkspaceWarning = {
  scope: string
  message: string
}

export type FounderWorkspaceProject = {
  id: number
  slug: string | null
  name: string
  description: string | null
  logoUrl: string | null
  isPublic: boolean
  status: string | null
  setup: {
    hasSlug: boolean
    hasContributionRate: boolean
    hasDefaultPaymentMethod: boolean
    enabledPaymentMethodCount: number
    isReady: boolean
    missingItems: string[]
  }
  payments: {
    paymentCount: number
    draftCount: number
    pendingCount: number
    awaitingConfirmationCount: number
    confirmedCount: number
    totalRevenue: number
    totalContributionAmount: number
    latestPeriodLabel: string | null
  }
  attribution: {
    datasetCount: number
    latestDatasetStatus: string | null
    latestDatasetMonth: string | null
    latestDatasetRowCount: number | null
  }
  reporting: {
    latestPublishedMonth: string | null
    activeUserCount: number | null
    publishedUserCount: number | null
    attributedPayoutUsd: number | null
    contributedAmountUsd: number | null
  }
  growth: {
    latestMonthLabel: string | null
    monthlyRevenue: number | null
    contributedAmount: number | null
    uniqueUserCount: number | null
    actualPercentage: number | null
    pledgedPercentage: number | null
  }
  team: {
    memberCount: number
    adminCount: number
  }
}

export type FounderWorkspaceHome = {
  hasProjects: boolean
  projects: FounderWorkspaceProject[]
  totals: {
    projectCount: number
    readyProjectCount: number
    needsSetupProjectCount: number
    enabledPaymentMethodCount: number
    totalRevenue: number
    totalContributionAmount: number
    pendingPaymentCount: number
    confirmedPaymentCount: number
    datasetCount: number
    latestPublishedMonth: string | null
  }
  warnings: FounderWorkspaceWarning[]
}

type ProjectDetailRow = {
  id: number
  slug: string | null
  name: string
  description: string | null
  logo_url: string | null
  is_public: boolean | null
  status: string | null
  payment_percentage: number | null
  default_payment_method_id: number | null
}

type PaymentRow = {
  project_id: number
  period_start: string | null
  period_end: string | null
  revenue: number | null
  payment_amount: number | null
  ref_payment_statuses: { code: string | null } | { code: string | null }[] | null
}

type PaymentMethodRow = {
  project_id: number
  id: number
  is_enabled: boolean | null
}

type ParticipantRow = {
  project_id: number
  is_admin: boolean | null
}

type ZkasDatasetRow = {
  project_id: number
  month: string
  status: string
  row_count: number | null
  created_at: string
}

type ZkasRunSummaryRow = {
  project_id: number
  run_id: number
  active_user_count: number | null
  published_user_count: number | null
  attributed_payout_usd: number | null
  contributed_amount_usd: number | null
  created_at: string
}

type ZkasRunRow = {
  id: number
  month: string
  published_at: string | null
}

type ProjectStatsMonthlyRow = {
  project_id: number
  year: number
  month: number
  monthly_revenue: number | null
  contributed_amount: number | null
  unique_user_count: number | null
  actual_percentage: number | null
  pledged_percentage: number | null
}

type SupabaseReadResult<T> = {
  data: T | null
  error: { message?: string } | null
}

function warningFromError(scope: string, error: { message?: string } | null | undefined): FounderWorkspaceWarning | null {
  if (!error) {
    return null
  }

  return {
    scope,
    message: error.message ?? "Founder workspace data could not be loaded.",
  }
}

async function readFounderData<T>(
  scope: string,
  query: PromiseLike<SupabaseReadResult<T>>,
  warnings: FounderWorkspaceWarning[],
  fallback: T,
): Promise<T> {
  try {
    const { data, error } = await query
    const warning = warningFromError(scope, error)
    if (warning) {
      warnings.push(warning)
      return fallback
    }

    return data ?? fallback
  } catch (error) {
    warnings.push({
      scope,
      message: error instanceof Error ? error.message : "Founder workspace data could not be loaded.",
    })
    return fallback
  }
}

function numberValue(value: number | null | undefined): number {
  return Number(value ?? 0)
}

function statusCode(payment: PaymentRow): string {
  const status = Array.isArray(payment.ref_payment_statuses) ? payment.ref_payment_statuses[0] : payment.ref_payment_statuses
  return status?.code ?? "unknown"
}

function periodLabel(payment: PaymentRow | null): string | null {
  if (!payment?.period_start && !payment?.period_end) {
    return null
  }

  if (payment.period_start && payment.period_end) {
    return `${payment.period_start} - ${payment.period_end}`
  }

  return payment.period_end ?? payment.period_start
}

function statMonthLabel(stat: ProjectStatsMonthlyRow | null): string | null {
  if (!stat) {
    return null
  }

  return `${stat.year}-${String(stat.month).padStart(2, "0")}`
}

function sortByDateDescending<T>(rows: T[], readDate: (row: T) => string | null | undefined): T[] {
  return [...rows].sort((left, right) => new Date(readDate(right) ?? 0).getTime() - new Date(readDate(left) ?? 0).getTime())
}

export function buildFounderWorkspaceHome({
  managedProjects,
  projectRows,
  payments,
  paymentMethods,
  participants,
  datasets,
  runSummaries,
  runs,
  stats,
  warnings,
}: {
  managedProjects: ManagedProjectSummary[]
  projectRows: ProjectDetailRow[]
  payments: PaymentRow[]
  paymentMethods: PaymentMethodRow[]
  participants: ParticipantRow[]
  datasets: ZkasDatasetRow[]
  runSummaries: ZkasRunSummaryRow[]
  runs: ZkasRunRow[]
  stats: ProjectStatsMonthlyRow[]
  warnings: FounderWorkspaceWarning[]
}): FounderWorkspaceHome {
  const projectRowById = new Map(projectRows.map((project) => [project.id, project]))
  const runById = new Map(runs.map((run) => [run.id, run]))
  const projects = managedProjects.map((managedProject) => {
    const project = projectRowById.get(managedProject.id)
    const projectPayments = payments.filter((payment) => payment.project_id === managedProject.id)
    const projectPaymentMethods = paymentMethods.filter((method) => method.project_id === managedProject.id)
    const projectParticipants = participants.filter((participant) => participant.project_id === managedProject.id)
    const projectDatasets = sortByDateDescending(
      datasets.filter((dataset) => dataset.project_id === managedProject.id),
      (dataset) => dataset.created_at,
    )
    const projectRunSummaries = sortByDateDescending(
      runSummaries.filter((summary) => summary.project_id === managedProject.id),
      (summary) => runById.get(summary.run_id)?.published_at ?? summary.created_at,
    )
    const projectStats = [...stats]
      .filter((stat) => stat.project_id === managedProject.id)
      .sort((left, right) => right.year - left.year || right.month - left.month)
    const enabledPaymentMethodCount = projectPaymentMethods.filter((method) => method.is_enabled === true).length
    const hasDefaultPaymentMethod =
      project?.default_payment_method_id !== null &&
      project?.default_payment_method_id !== undefined &&
      projectPaymentMethods.some((method) => method.id === project.default_payment_method_id && method.is_enabled === true)
    const hasContributionRate = numberValue(project?.payment_percentage) > 0
    const missingItems = [
      managedProject.slug ? null : "slug",
      hasContributionRate ? null : "contribution_rate",
      enabledPaymentMethodCount > 0 ? null : "payment_method",
      hasDefaultPaymentMethod ? null : "default_payment_method",
    ].filter((item): item is string => Boolean(item))
    const latestDataset = projectDatasets[0] ?? null
    const latestRunSummary = projectRunSummaries[0] ?? null
    const latestRun = latestRunSummary ? runById.get(latestRunSummary.run_id) : null
    const latestStat = projectStats[0] ?? null

    return {
      id: managedProject.id,
      slug: managedProject.slug,
      name: project?.name ?? managedProject.name,
      description: project?.description ?? null,
      logoUrl: project?.logo_url ?? null,
      isPublic: project?.is_public === true,
      status: project?.status ?? null,
      setup: {
        hasSlug: Boolean(managedProject.slug),
        hasContributionRate,
        hasDefaultPaymentMethod,
        enabledPaymentMethodCount,
        isReady: missingItems.length === 0,
        missingItems,
      },
      payments: {
        paymentCount: projectPayments.length,
        draftCount: projectPayments.filter((payment) => statusCode(payment) === "draft").length,
        pendingCount: projectPayments.filter((payment) => statusCode(payment) === "pending").length,
        awaitingConfirmationCount: projectPayments.filter((payment) => statusCode(payment) === "awaiting_confirmation").length,
        confirmedCount: projectPayments.filter((payment) => statusCode(payment) === "confirmed").length,
        totalRevenue: projectPayments.reduce((sum, payment) => sum + numberValue(payment.revenue), 0),
        totalContributionAmount: projectPayments.reduce((sum, payment) => sum + numberValue(payment.payment_amount), 0),
        latestPeriodLabel: periodLabel(sortByDateDescending(projectPayments, (payment) => payment.period_end ?? payment.period_start)[0] ?? null),
      },
      attribution: {
        datasetCount: projectDatasets.length,
        latestDatasetStatus: latestDataset?.status ?? null,
        latestDatasetMonth: latestDataset?.month ?? null,
        latestDatasetRowCount: latestDataset?.row_count ?? null,
      },
      reporting: {
        latestPublishedMonth: latestRun?.published_at ? latestRun.month : null,
        activeUserCount: latestRunSummary?.active_user_count ?? null,
        publishedUserCount: latestRunSummary?.published_user_count ?? null,
        attributedPayoutUsd: latestRunSummary?.attributed_payout_usd ?? null,
        contributedAmountUsd: latestRunSummary?.contributed_amount_usd ?? null,
      },
      growth: {
        latestMonthLabel: statMonthLabel(latestStat),
        monthlyRevenue: latestStat?.monthly_revenue ?? null,
        contributedAmount: latestStat?.contributed_amount ?? null,
        uniqueUserCount: latestStat?.unique_user_count ?? null,
        actualPercentage: latestStat?.actual_percentage ?? null,
        pledgedPercentage: latestStat?.pledged_percentage ?? null,
      },
      team: {
        memberCount: projectParticipants.length,
        adminCount: projectParticipants.filter((participant) => participant.is_admin === true).length,
      },
    }
  })

  return {
    hasProjects: projects.length > 0,
    projects,
    totals: {
      projectCount: projects.length,
      readyProjectCount: projects.filter((project) => project.setup.isReady).length,
      needsSetupProjectCount: projects.filter((project) => !project.setup.isReady).length,
      enabledPaymentMethodCount: projects.reduce((sum, project) => sum + project.setup.enabledPaymentMethodCount, 0),
      totalRevenue: projects.reduce((sum, project) => sum + project.payments.totalRevenue, 0),
      totalContributionAmount: projects.reduce((sum, project) => sum + project.payments.totalContributionAmount, 0),
      pendingPaymentCount: projects.reduce(
        (sum, project) => sum + project.payments.pendingCount + project.payments.awaitingConfirmationCount,
        0,
      ),
      confirmedPaymentCount: projects.reduce((sum, project) => sum + project.payments.confirmedCount, 0),
      datasetCount: projects.reduce((sum, project) => sum + project.attribution.datasetCount, 0),
      latestPublishedMonth: projects.find((project) => project.reporting.latestPublishedMonth)?.reporting.latestPublishedMonth ?? null,
    },
    warnings,
  }
}

export function findFounderWorkspaceProject(home: FounderWorkspaceHome, slug: string): FounderWorkspaceProject | null {
  return home.projects.find((project) => project.slug === slug) ?? null
}

function getFounderSupabaseClient() {
  try {
    return getAdminSupabaseClient()
  } catch {
    return null
  }
}

export async function getFounderWorkspaceHome(navigationContext: NavigationContext): Promise<FounderWorkspaceHome> {
  const warnings: FounderWorkspaceWarning[] = []
  const managedProjects = navigationContext.managedProjects

  if (managedProjects.length === 0) {
    return buildFounderWorkspaceHome({
      managedProjects,
      projectRows: [],
      payments: [],
      paymentMethods: [],
      participants: [],
      datasets: [],
      runSummaries: [],
      runs: [],
      stats: [],
      warnings,
    })
  }

  const supabase = getFounderSupabaseClient() ?? (await createServerSupabaseClient())
  const projectIds = managedProjects.map((project) => project.id)

  const [projectRows, payments, paymentMethods, participants, datasets, runSummaries, stats] = await Promise.all([
    readFounderData<ProjectDetailRow[]>(
      "projects",
      supabase
        .from("projects")
        .select("id, slug, name, description, logo_url, is_public, status, payment_percentage, default_payment_method_id")
        .in("id", projectIds)
        .is("deleted_at", null)
        .returns<ProjectDetailRow[]>(),
      warnings,
      [],
    ),
    readFounderData<PaymentRow[]>(
      "payments",
      supabase
        .from("payments")
        .select("project_id, period_start, period_end, revenue, payment_amount, ref_payment_statuses(code)")
        .in("project_id", projectIds)
        .is("deleted_at", null)
        .returns<PaymentRow[]>(),
      warnings,
      [],
    ),
    readFounderData<PaymentMethodRow[]>(
      "payment-methods",
      supabase
        .from("payment_methods")
        .select("project_id, id, is_enabled")
        .in("project_id", projectIds)
        .returns<PaymentMethodRow[]>(),
      warnings,
      [],
    ),
    readFounderData<ParticipantRow[]>(
      "participants",
      supabase.from("participants").select("project_id, is_admin").in("project_id", projectIds).returns<ParticipantRow[]>(),
      warnings,
      [],
    ),
    readFounderData<ZkasDatasetRow[]>(
      "zkas-datasets",
      supabase
        .from("zkas_datasets")
        .select("project_id, month, status, row_count, created_at")
        .in("project_id", projectIds)
        .order("created_at", { ascending: false })
        .returns<ZkasDatasetRow[]>(),
      warnings,
      [],
    ),
    readFounderData<ZkasRunSummaryRow[]>(
      "zkas-run-summaries",
      supabase
        .from("zkas_run_project_summaries")
        .select("project_id, run_id, active_user_count, published_user_count, attributed_payout_usd, contributed_amount_usd, created_at")
        .in("project_id", projectIds)
        .returns<ZkasRunSummaryRow[]>(),
      warnings,
      [],
    ),
    readFounderData<ProjectStatsMonthlyRow[]>(
      "growth",
      supabase
        .from("project_stats_monthly")
        .select("project_id, year, month, monthly_revenue, contributed_amount, unique_user_count, actual_percentage, pledged_percentage")
        .in("project_id", projectIds)
        .returns<ProjectStatsMonthlyRow[]>(),
      warnings,
      [],
    ),
  ])

  const runIds = Array.from(new Set(runSummaries.map((summary) => summary.run_id)))
  const runs =
    runIds.length > 0
      ? await readFounderData<ZkasRunRow[]>(
          "zkas-runs",
          supabase.from("zkas_runs").select("id, month, published_at").in("id", runIds).returns<ZkasRunRow[]>(),
          warnings,
          [],
        )
      : []

  return buildFounderWorkspaceHome({
    managedProjects,
    projectRows,
    payments,
    paymentMethods,
    participants,
    datasets,
    runSummaries,
    runs,
    stats,
    warnings,
  })
}

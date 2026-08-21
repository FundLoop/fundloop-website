import "server-only"

import { getAdminSupabaseClient } from "@/lib/supabase-admin"
import { assertMonthString, getMonthBounds, isValidMonthString } from "@/lib/zkas/month"
import type { Database } from "@/types/supabase"
import { isUnresolvedOnchainSubmissionStatus } from "./monthly-cycle-statuses"

export const monthlyCycleStatuses = [
  "open",
  "locked",
  "prep",
  "calculation",
  "verification",
  "approval",
  "distribution",
  "completed",
  "reporting",
] as const

export type MonthlyCycleStatus = (typeof monthlyCycleStatuses)[number]

export const monthlyCycleStatusLabels: Record<MonthlyCycleStatus, string> = {
  open: "Open",
  locked: "Locked",
  prep: "Prep",
  calculation: "Calculation",
  verification: "Verification",
  approval: "Approval",
  distribution: "Distribution",
  completed: "Completed",
  reporting: "Reporting",
}

export type MonthlyCycleWarning = {
  scope: string
  message: string
}

export type MonthlyCycleRow = Pick<
  Database["public"]["Tables"]["monthly_cycles"]["Row"],
  | "id"
  | "cycle_key"
  | "year"
  | "month"
  | "period_start"
  | "period_end"
  | "status"
  | "opened_at"
  | "locked_at"
  | "locked_manifest_hash"
  | "locked_by_user_id"
  | "lock_override_unresolved_onchain"
  | "lock_override_reason"
  | "prep_started_at"
  | "calculation_started_at"
  | "verification_started_at"
  | "approval_started_at"
  | "distribution_started_at"
  | "completed_at"
  | "reporting_published_at"
  | "operator_note"
  | "status_note"
>

type PaymentCycleRow = {
  monthly_cycle_id: number | null
  revenue: number
  payment_amount: number
  ref_payment_statuses: { code: string } | null
}

type OnchainCycleRow = {
  monthly_cycle_id: number | null
  status: string
}

type ZkasDatasetCycleRow = {
  monthly_cycle_id: number | null
  status: string
}

type ZkasIdentityArtifactCycleRow = {
  monthly_cycle_id: number | null
  status: string
}

type ZkasRunCycleRow = {
  monthly_cycle_id: number | null
  month: string
  status: string
  total_allocated_usd: number | null
  published_at: string | null
  created_at: string
}

type PublishedResultCycleRow = {
  monthly_cycle_id: number | null
  allocation_usd: number
}

type ProjectSummaryCycleRow = {
  monthly_cycle_id: number | null
  id: number
}

type ProjectContributionExpectationRow = {
  id: number
  slug: string | null
  name: string
  status: string | null
  payment_percentage: number | null
}

type ProjectMonthlyContributionSubmissionCycleRow = {
  monthly_cycle_id: number | null
  project_id: number
  usd_equivalent_amount: number
  calculated_contribution_amount: number
  status: string
}

type ProjectAttributionDatasetCycleRow = {
  monthly_cycle_id: number | null
  status: string
}

export type MonthlyCycleAdminSummary = {
  id: number
  cycleKey: string
  year: number
  month: number
  periodStart: string
  periodEnd: string
  status: MonthlyCycleStatus
  statusLabel: string
  stageTimestamps: {
    openedAt: string
    lockedAt: string | null
    prepStartedAt: string | null
    calculationStartedAt: string | null
    verificationStartedAt: string | null
    approvalStartedAt: string | null
    distributionStartedAt: string | null
    completedAt: string | null
    reportingPublishedAt: string | null
  }
  notes: {
    operatorNote: string | null
    statusNote: string | null
  }
  lock: {
    lockedManifestHash: string | null
    lockedByUserId: string | null
    overrideUnresolvedOnchain: boolean
    overrideReason: string | null
  }
  payments: {
    count: number
    confirmedCount: number
    awaitingConfirmationCount: number
    draftOrPendingCount: number
    totalRevenue: number
    totalContributionAmount: number
  }
  contributionSubmissions: {
    submittedCount: number
    expectedProjectCount: number
    missingProjectCount: number
    totalUsdEquivalentAmount: number
    totalCalculatedContributionAmount: number
    missingProjects: Array<{ id: number; slug: string | null; name: string }>
  }
  attribution: {
    datasetCount: number
    submittedCount: number
    approvedCount: number
    rejectedCount: number
  }
  reconciliation: {
    submissionCount: number
    confirmedCount: number
    unresolvedCount: number
    failedCount: number
  }
  zkas: {
    datasetCount: number
    approvedDatasetCount: number
    identityArtifactCount: number
    runCount: number
    latestRunStatus: string | null
    latestPublishedMonth: string | null
    publishedResultCount: number
    projectSummaryCount: number
    totalPublishedAllocationUsd: number
  }
}

export type MonthlyCycleAdminOverview = {
  cycles: MonthlyCycleAdminSummary[]
  totals: {
    cycleCount: number
    openCycleCount: number
    lockedOrLaterCycleCount: number
    paymentCount: number
    contributionSubmissionCount: number
    missingContributionSubmissionCount: number
    attributionDatasetCount: number
    attributionSubmittedCount: number
    attributionApprovedCount: number
    totalContributionAmount: number
    zkasRunCount: number
  }
  warnings: MonthlyCycleWarning[]
}

export function parseMonthlyCycleKey(value: string) {
  const cycleKey = assertMonthString(value)
  const [year, month] = cycleKey.split("-").map((part) => Number.parseInt(part, 10))
  const { startIso, endIso } = getMonthBounds(cycleKey)

  return {
    cycleKey,
    year,
    month,
    periodStart: startIso.slice(0, 10),
    periodEndExclusive: endIso.slice(0, 10),
    periodEnd: new Date(new Date(endIso).getTime() - 86_400_000).toISOString().slice(0, 10),
  }
}

function sumByCycle<T extends { monthly_cycle_id: number | null }>(
  rows: T[],
  cycleId: number,
  selector: (row: T) => number,
) {
  return rows.reduce((sum, row) => (row.monthly_cycle_id === cycleId ? sum + selector(row) : sum), 0)
}

function countByCycle<T extends { monthly_cycle_id: number | null }>(
  rows: T[],
  cycleId: number,
  predicate: (row: T) => boolean = () => true,
) {
  return rows.reduce((count, row) => (row.monthly_cycle_id === cycleId && predicate(row) ? count + 1 : count), 0)
}

function isLockedOrLater(status: MonthlyCycleStatus) {
  return status !== "open"
}

export function buildMonthlyCycleAdminOverview(input: {
  cycles: MonthlyCycleRow[]
  payments: PaymentCycleRow[]
  onchainSubmissions: OnchainCycleRow[]
  datasets: ZkasDatasetCycleRow[]
  identityArtifacts: ZkasIdentityArtifactCycleRow[]
  runs: ZkasRunCycleRow[]
  publishedResults: PublishedResultCycleRow[]
  projectSummaries: ProjectSummaryCycleRow[]
  contributionExpectedProjects: ProjectContributionExpectationRow[]
  contributionSubmissions: ProjectMonthlyContributionSubmissionCycleRow[]
  attributionDatasets: ProjectAttributionDatasetCycleRow[]
  warnings: MonthlyCycleWarning[]
}): MonthlyCycleAdminOverview {
  const expectedContributionProjects = input.contributionExpectedProjects.filter(
    (project) => project.status !== "deleted" && Number(project.payment_percentage ?? 0) > 0,
  )
  const cycles = input.cycles.map((cycle) => {
    const runs = input.runs
      .filter((run) => run.monthly_cycle_id === cycle.id)
      .sort((a, b) => (b.published_at ?? b.created_at).localeCompare(a.published_at ?? a.created_at))
    const latestPublishedRun = runs.find((run) => run.published_at)
    const cycleContributionSubmissions = input.contributionSubmissions.filter(
      (submission) => submission.monthly_cycle_id === cycle.id && submission.status === "submitted",
    )
    const submittedProjectIds = new Set(cycleContributionSubmissions.map((submission) => submission.project_id))
    const missingProjects = expectedContributionProjects
      .filter((project) => !submittedProjectIds.has(project.id))
      .map((project) => ({ id: project.id, slug: project.slug, name: project.name }))

    return {
      id: cycle.id,
      cycleKey: cycle.cycle_key,
      year: cycle.year,
      month: cycle.month,
      periodStart: cycle.period_start,
      periodEnd: cycle.period_end,
      status: cycle.status,
      statusLabel: monthlyCycleStatusLabels[cycle.status],
      stageTimestamps: {
        openedAt: cycle.opened_at,
        lockedAt: cycle.locked_at,
        prepStartedAt: cycle.prep_started_at,
        calculationStartedAt: cycle.calculation_started_at,
        verificationStartedAt: cycle.verification_started_at,
        approvalStartedAt: cycle.approval_started_at,
        distributionStartedAt: cycle.distribution_started_at,
        completedAt: cycle.completed_at,
        reportingPublishedAt: cycle.reporting_published_at,
      },
      notes: {
        operatorNote: cycle.operator_note,
        statusNote: cycle.status_note,
      },
      lock: {
        lockedManifestHash: cycle.locked_manifest_hash,
        lockedByUserId: cycle.locked_by_user_id,
        overrideUnresolvedOnchain: cycle.lock_override_unresolved_onchain,
        overrideReason: cycle.lock_override_reason,
      },
      payments: {
        count: countByCycle(input.payments, cycle.id),
        confirmedCount: countByCycle(input.payments, cycle.id, (payment) => payment.ref_payment_statuses?.code === "confirmed"),
        awaitingConfirmationCount: countByCycle(
          input.payments,
          cycle.id,
          (payment) => payment.ref_payment_statuses?.code === "awaiting_confirmation",
        ),
        draftOrPendingCount: countByCycle(input.payments, cycle.id, (payment) =>
          ["draft", "pending", "submitted"].includes(payment.ref_payment_statuses?.code ?? ""),
        ),
        totalRevenue: sumByCycle(input.payments, cycle.id, (payment) => Number(payment.revenue ?? 0)),
        totalContributionAmount: sumByCycle(input.payments, cycle.id, (payment) => Number(payment.payment_amount ?? 0)),
      },
      contributionSubmissions: {
        submittedCount: cycleContributionSubmissions.length,
        expectedProjectCount: expectedContributionProjects.length,
        missingProjectCount: missingProjects.length,
        totalUsdEquivalentAmount: cycleContributionSubmissions.reduce(
          (sum, submission) => sum + Number(submission.usd_equivalent_amount ?? 0),
          0,
        ),
        totalCalculatedContributionAmount: cycleContributionSubmissions.reduce(
          (sum, submission) => sum + Number(submission.calculated_contribution_amount ?? 0),
          0,
        ),
        missingProjects,
      },
      attribution: {
        datasetCount: countByCycle(input.attributionDatasets, cycle.id),
        submittedCount: countByCycle(input.attributionDatasets, cycle.id, (dataset) => dataset.status === "submitted"),
        approvedCount: countByCycle(input.attributionDatasets, cycle.id, (dataset) => dataset.status === "approved"),
        rejectedCount: countByCycle(input.attributionDatasets, cycle.id, (dataset) => dataset.status === "rejected"),
      },
      reconciliation: {
        submissionCount: countByCycle(input.onchainSubmissions, cycle.id),
        confirmedCount: countByCycle(input.onchainSubmissions, cycle.id, (submission) => submission.status === "confirmed"),
        unresolvedCount: countByCycle(input.onchainSubmissions, cycle.id, (submission) =>
          isUnresolvedOnchainSubmissionStatus(submission.status),
        ),
        failedCount: countByCycle(input.onchainSubmissions, cycle.id, (submission) => submission.status === "failed"),
      },
      zkas: {
        datasetCount: countByCycle(input.datasets, cycle.id),
        approvedDatasetCount: countByCycle(input.datasets, cycle.id, (dataset) =>
          ["approved", "included"].includes(dataset.status),
        ),
        identityArtifactCount: countByCycle(input.identityArtifacts, cycle.id),
        runCount: runs.length,
        latestRunStatus: runs[0]?.status ?? null,
        latestPublishedMonth: latestPublishedRun?.month ?? null,
        publishedResultCount: countByCycle(input.publishedResults, cycle.id),
        projectSummaryCount: countByCycle(input.projectSummaries, cycle.id),
        totalPublishedAllocationUsd: sumByCycle(input.publishedResults, cycle.id, (result) => Number(result.allocation_usd ?? 0)),
      },
    }
  })

  return {
    cycles,
    totals: {
      cycleCount: cycles.length,
      openCycleCount: cycles.filter((cycle) => cycle.status === "open").length,
      lockedOrLaterCycleCount: cycles.filter((cycle) => isLockedOrLater(cycle.status)).length,
      paymentCount: cycles.reduce((sum, cycle) => sum + cycle.payments.count, 0),
      contributionSubmissionCount: cycles.reduce((sum, cycle) => sum + cycle.contributionSubmissions.submittedCount, 0),
      missingContributionSubmissionCount: cycles.reduce((sum, cycle) => sum + cycle.contributionSubmissions.missingProjectCount, 0),
      attributionDatasetCount: cycles.reduce((sum, cycle) => sum + cycle.attribution.datasetCount, 0),
      attributionSubmittedCount: cycles.reduce((sum, cycle) => sum + cycle.attribution.submittedCount, 0),
      attributionApprovedCount: cycles.reduce((sum, cycle) => sum + cycle.attribution.approvedCount, 0),
      totalContributionAmount: cycles.reduce((sum, cycle) => sum + cycle.payments.totalContributionAmount, 0),
      zkasRunCount: cycles.reduce((sum, cycle) => sum + cycle.zkas.runCount, 0),
    },
    warnings: input.warnings,
  }
}

async function softRead<T>(scope: string, read: () => unknown, warnings: MonthlyCycleWarning[]) {
  const { data, error } = (await read()) as { data: T[] | null; error: { message: string } | null }

  if (error) {
    warnings.push({ scope, message: error.message })
    return []
  }

  return data ?? []
}

export async function loadMonthlyCycleAdminOverview(): Promise<MonthlyCycleAdminOverview> {
  const supabase = getAdminSupabaseClient()
  const warnings: MonthlyCycleWarning[] = []

  const cycles = await softRead<MonthlyCycleRow>(
    "monthly_cycles",
    () =>
      supabase
        .from("monthly_cycles")
        .select(
          "id, cycle_key, year, month, period_start, period_end, status, opened_at, locked_at, locked_manifest_hash, locked_by_user_id, lock_override_unresolved_onchain, lock_override_reason, prep_started_at, calculation_started_at, verification_started_at, approval_started_at, distribution_started_at, completed_at, reporting_published_at, operator_note, status_note",
        )
        .order("period_start", { ascending: false })
        .limit(18),
    warnings,
  )

  const cycleIds = cycles.map((cycle) => cycle.id)

  if (cycleIds.length === 0) {
    return buildMonthlyCycleAdminOverview({
      cycles,
      payments: [],
      onchainSubmissions: [],
      datasets: [],
      identityArtifacts: [],
      runs: [],
      publishedResults: [],
      projectSummaries: [],
      contributionExpectedProjects: [],
      contributionSubmissions: [],
      attributionDatasets: [],
      warnings,
    })
  }

  const [
    payments,
    onchainSubmissions,
    datasets,
    identityArtifacts,
    runs,
    publishedResults,
    projectSummaries,
    contributionExpectedProjects,
    contributionSubmissions,
    attributionDatasets,
  ] = await Promise.all([
    softRead(
      "payments",
      () =>
        supabase
          .from("payments")
          .select("monthly_cycle_id, revenue, payment_amount, ref_payment_statuses(code)")
          .in("monthly_cycle_id", cycleIds),
      warnings,
    ),
    softRead(
      "onchain_payment_submissions",
      () => supabase.from("onchain_payment_submissions").select("monthly_cycle_id, status").in("monthly_cycle_id", cycleIds),
      warnings,
    ),
    softRead(
      "zkas_datasets",
      () => supabase.from("zkas_datasets").select("monthly_cycle_id, status").in("monthly_cycle_id", cycleIds),
      warnings,
    ),
    softRead(
      "zkas_identity_artifacts",
      () => supabase.from("zkas_identity_artifacts").select("monthly_cycle_id, status").in("monthly_cycle_id", cycleIds),
      warnings,
    ),
    softRead(
      "zkas_runs",
      () =>
        supabase
          .from("zkas_runs")
          .select("monthly_cycle_id, month, status, total_allocated_usd, published_at, created_at")
          .in("monthly_cycle_id", cycleIds),
      warnings,
    ),
    softRead(
      "zkas_published_user_results",
      () => supabase.from("zkas_published_user_results").select("monthly_cycle_id, allocation_usd").in("monthly_cycle_id", cycleIds),
      warnings,
    ),
    softRead(
      "zkas_run_project_summaries",
      () => supabase.from("zkas_run_project_summaries").select("monthly_cycle_id, id").in("monthly_cycle_id", cycleIds),
      warnings,
    ),
    softRead(
      "projects",
      () =>
        supabase
          .from("projects")
          .select("id, slug, name, status, payment_percentage")
          .is("deleted_at", null)
          .gt("payment_percentage", 0),
      warnings,
    ),
    softRead(
      "project_monthly_contribution_submissions",
      () =>
        supabase
          .from("project_monthly_contribution_submissions")
          .select("monthly_cycle_id, project_id, usd_equivalent_amount, calculated_contribution_amount, status")
          .in("monthly_cycle_id", cycleIds),
      warnings,
    ),
    softRead(
      "project_attribution_datasets",
      () => supabase.from("project_attribution_datasets").select("monthly_cycle_id, status").in("monthly_cycle_id", cycleIds),
      warnings,
    ),
  ])

  return buildMonthlyCycleAdminOverview({
    cycles,
    payments: payments as PaymentCycleRow[],
    onchainSubmissions: onchainSubmissions as OnchainCycleRow[],
    datasets: datasets as ZkasDatasetCycleRow[],
    identityArtifacts: identityArtifacts as ZkasIdentityArtifactCycleRow[],
    runs: runs as ZkasRunCycleRow[],
    publishedResults: publishedResults as PublishedResultCycleRow[],
    projectSummaries: projectSummaries as ProjectSummaryCycleRow[],
    contributionExpectedProjects: contributionExpectedProjects as ProjectContributionExpectationRow[],
    contributionSubmissions: contributionSubmissions as ProjectMonthlyContributionSubmissionCycleRow[],
    attributionDatasets: attributionDatasets as ProjectAttributionDatasetCycleRow[],
    warnings,
  })
}

export { isValidMonthString }

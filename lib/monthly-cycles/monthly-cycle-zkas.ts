import "server-only"

import { getAdminSupabaseClient } from "@/lib/supabase-admin"
import type { Database } from "@/types/supabase"
import { assertMonthString } from "@/lib/zkas/month"
import type { MonthlyCycleStatus } from "./index"

type CycleZkasRow = Pick<
  Database["public"]["Tables"]["monthly_cycles"]["Row"],
  "id" | "cycle_key" | "period_start" | "period_end" | "status" | "locked_at" | "prep_started_at" | "calculation_started_at"
>

type DatasetRow = Pick<
  Database["public"]["Tables"]["zkas_datasets"]["Row"],
  "id" | "project_id" | "month" | "status" | "file_name" | "row_count" | "approved_at" | "created_at"
>

type IdentityArtifactRow = Pick<
  Database["public"]["Tables"]["zkas_identity_artifacts"]["Row"],
  "id" | "month" | "status" | "provider" | "file_name" | "created_at"
>

type RunRow = Pick<
  Database["public"]["Tables"]["zkas_runs"]["Row"],
  "id" | "month" | "status" | "verification_status" | "usd_pool" | "user_count" | "total_allocated_usd" | "created_at" | "published_at"
>

type RunResultRow = Pick<Database["public"]["Tables"]["zkas_run_results"]["Row"], "allocation_usd">
type PublishedUserResultRow = Pick<Database["public"]["Tables"]["zkas_published_user_results"]["Row"], "allocation_usd">
type ProjectSummaryRow = Pick<Database["public"]["Tables"]["zkas_run_project_summaries"]["Row"], "id">

export type MonthlyCycleZkasPosture = "not_locked" | "missing_inputs" | "ready_for_packaging" | "calculation_started" | "published"

export type MonthlyCycleZkasIssue = {
  code: string
  severity: "blocker" | "warning" | "info"
  title: string
  description: string
  actionHref?: string
}

export type MonthlyCycleZkasStage = {
  cycle: {
    id: number
    cycleKey: string
    periodStart: string
    periodEnd: string
    status: MonthlyCycleStatus
    lockedAt: string | null
    prepStartedAt: string | null
    calculationStartedAt: string | null
  }
  posture: MonthlyCycleZkasPosture
  postureLabel: string
  datasets: {
    total: number
    approved: number
    included: number
    rowCount: number
    latestApprovedAt: string | null
    recent: DatasetRow[]
  }
  identityArtifacts: {
    total: number
    approved: number
    providers: string[]
    recent: IdentityArtifactRow[]
  }
  runs: {
    total: number
    draft: number
    locked: number
    running: number
    completed: number
    finalized: number
    failed: number
    latest: RunRow | null
    recent: RunRow[]
  }
  outputs: {
    runResultCount: number
    publishedUserResultCount: number
    projectSummaryCount: number
    totalAllocatedUsd: number
    totalPublishedAllocationUsd: number
  }
  issues: MonthlyCycleZkasIssue[]
  warnings: MonthlyCycleZkasIssue[]
}

function countWhere<T>(rows: T[], predicate: (row: T) => boolean) {
  return rows.reduce((count, row) => (predicate(row) ? count + 1 : count), 0)
}

function sumNumbers<T>(rows: T[], selector: (row: T) => number | null) {
  return rows.reduce((sum, row) => sum + Number(selector(row) ?? 0), 0)
}

function getPosture(input: {
  cycle: CycleZkasRow
  approvedDatasetCount: number
  approvedIdentityArtifactCount: number
  runs: RunRow[]
  publishedUserResultCount: number
}): MonthlyCycleZkasPosture {
  if (input.cycle.status === "open" || !input.cycle.locked_at) {
    return "not_locked"
  }

  if (input.approvedDatasetCount === 0 || input.approvedIdentityArtifactCount === 0) {
    return "missing_inputs"
  }

  if (input.publishedUserResultCount > 0 || input.runs.some((run) => run.published_at)) {
    return "published"
  }

  if (input.runs.length > 0) {
    return "calculation_started"
  }

  return "ready_for_packaging"
}

function getPostureLabel(posture: MonthlyCycleZkasPosture) {
  if (posture === "not_locked") return "Not locked"
  if (posture === "missing_inputs") return "Missing inputs"
  if (posture === "calculation_started") return "Calculation started"
  if (posture === "published") return "Published"
  return "Ready for packaging"
}

export function buildMonthlyCycleZkasStage(input: {
  cycle: CycleZkasRow
  datasets: DatasetRow[]
  identityArtifacts: IdentityArtifactRow[]
  runs: RunRow[]
  runResults: RunResultRow[]
  publishedUserResults: PublishedUserResultRow[]
  projectSummaries: ProjectSummaryRow[]
  warnings?: MonthlyCycleZkasIssue[]
}): MonthlyCycleZkasStage {
  const datasets = [...input.datasets].sort((left, right) => right.created_at.localeCompare(left.created_at))
  const identityArtifacts = [...input.identityArtifacts].sort((left, right) => right.created_at.localeCompare(left.created_at))
  const runs = [...input.runs].sort((left, right) => (right.published_at ?? right.created_at).localeCompare(left.published_at ?? left.created_at))
  const approvedDatasets = countWhere(datasets, (dataset) => dataset.status === "approved" || dataset.status === "included")
  const includedDatasets = countWhere(datasets, (dataset) => dataset.status === "included")
  const approvedIdentityArtifacts = countWhere(identityArtifacts, (artifact) => artifact.status === "approved")
  const posture = getPosture({
    cycle: input.cycle,
    approvedDatasetCount: approvedDatasets,
    approvedIdentityArtifactCount: approvedIdentityArtifacts,
    runs,
    publishedUserResultCount: input.publishedUserResults.length,
  })
  const issues: MonthlyCycleZkasIssue[] = []

  if (input.cycle.status === "open" || !input.cycle.locked_at) {
    issues.push({
      code: "cycle_not_locked",
      severity: "blocker",
      title: "Cycle is not locked",
      description: "zkAS should package calculation inputs from a locked monthly-cycle manifest, not from mutable live rows.",
      actionHref: "/admin/cycles",
    })
  }

  if (approvedDatasets === 0) {
    issues.push({
      code: "missing_approved_datasets",
      severity: "blocker",
      title: "No approved attribution datasets",
      description: "At least one approved or included project attribution dataset is needed before calculation packaging.",
      actionHref: "/admin/zkas/uploads",
    })
  }

  if (approvedIdentityArtifacts === 0) {
    issues.push({
      code: "missing_identity_artifact",
      severity: "blocker",
      title: "No approved identity artifact",
      description: "The cycle needs an approved confidential identity artifact before a trustworthy zkAS run can be prepared.",
      actionHref: "/admin/zkas/uploads",
    })
  }

  if (runs.some((run) => run.status === "failed")) {
    issues.push({
      code: "failed_runs_present",
      severity: "warning",
      title: "Failed zkAS runs exist",
      description: "Review failed runs before relying on newer outputs for verification or publication.",
      actionHref: "/admin/zkas/runs",
    })
  }

  const providers = Array.from(new Set(identityArtifacts.map((artifact) => artifact.provider))).sort()

  return {
    cycle: {
      id: input.cycle.id,
      cycleKey: input.cycle.cycle_key,
      periodStart: input.cycle.period_start,
      periodEnd: input.cycle.period_end,
      status: input.cycle.status,
      lockedAt: input.cycle.locked_at,
      prepStartedAt: input.cycle.prep_started_at,
      calculationStartedAt: input.cycle.calculation_started_at,
    },
    posture,
    postureLabel: getPostureLabel(posture),
    datasets: {
      total: datasets.length,
      approved: approvedDatasets,
      included: includedDatasets,
      rowCount: sumNumbers(datasets, (dataset) => dataset.row_count),
      latestApprovedAt: datasets.find((dataset) => dataset.approved_at)?.approved_at ?? null,
      recent: datasets.slice(0, 6),
    },
    identityArtifacts: {
      total: identityArtifacts.length,
      approved: approvedIdentityArtifacts,
      providers,
      recent: identityArtifacts.slice(0, 6),
    },
    runs: {
      total: runs.length,
      draft: countWhere(runs, (run) => run.status === "draft"),
      locked: countWhere(runs, (run) => run.status === "locked"),
      running: countWhere(runs, (run) => run.status === "running"),
      completed: countWhere(runs, (run) => run.status === "completed"),
      finalized: countWhere(runs, (run) => run.status === "finalized"),
      failed: countWhere(runs, (run) => run.status === "failed"),
      latest: runs[0] ?? null,
      recent: runs.slice(0, 6),
    },
    outputs: {
      runResultCount: input.runResults.length,
      publishedUserResultCount: input.publishedUserResults.length,
      projectSummaryCount: input.projectSummaries.length,
      totalAllocatedUsd: sumNumbers(input.runResults, (result) => result.allocation_usd),
      totalPublishedAllocationUsd: sumNumbers(input.publishedUserResults, (result) => result.allocation_usd),
    },
    issues,
    warnings: input.warnings ?? [],
  }
}

async function softRead<T>(scope: string, read: () => unknown, warnings: MonthlyCycleZkasIssue[]) {
  const { data, error } = (await read()) as { data: T[] | null; error: { message: string } | null }

  if (error) {
    warnings.push({
      code: `read_failed_${scope}`,
      severity: "warning",
      title: "Some zkAS data is temporarily unavailable",
      description: `${scope}: ${error.message}`,
    })
    return []
  }

  return data ?? []
}

export async function loadMonthlyCycleZkasStage(cycleKey: string): Promise<MonthlyCycleZkasStage | null> {
  const parsedCycleKey = assertMonthString(cycleKey)
  const supabase = getAdminSupabaseClient()
  const { data: cycle, error } = await supabase
    .from("monthly_cycles")
    .select("id, cycle_key, period_start, period_end, status, locked_at, prep_started_at, calculation_started_at")
    .eq("cycle_key", parsedCycleKey)
    .maybeSingle()

  if (error) {
    throw new Error(error.message)
  }

  if (!cycle) {
    return null
  }

  const warnings: MonthlyCycleZkasIssue[] = []
  const [datasets, identityArtifacts, runs, runResults, publishedUserResults, projectSummaries] = await Promise.all([
    softRead<DatasetRow>(
      "zkas_datasets",
      () =>
        supabase
          .from("zkas_datasets")
          .select("id, project_id, month, status, file_name, row_count, approved_at, created_at")
          .eq("monthly_cycle_id", cycle.id),
      warnings,
    ),
    softRead<IdentityArtifactRow>(
      "zkas_identity_artifacts",
      () =>
        supabase
          .from("zkas_identity_artifacts")
          .select("id, month, status, provider, file_name, created_at")
          .eq("monthly_cycle_id", cycle.id),
      warnings,
    ),
    softRead<RunRow>(
      "zkas_runs",
      () =>
        supabase
          .from("zkas_runs")
          .select("id, month, status, verification_status, usd_pool, user_count, total_allocated_usd, created_at, published_at")
          .eq("monthly_cycle_id", cycle.id),
      warnings,
    ),
    softRead<RunResultRow>(
      "zkas_run_results",
      () => supabase.from("zkas_run_results").select("allocation_usd").eq("monthly_cycle_id", cycle.id),
      warnings,
    ),
    softRead<PublishedUserResultRow>(
      "zkas_published_user_results",
      () => supabase.from("zkas_published_user_results").select("allocation_usd").eq("monthly_cycle_id", cycle.id),
      warnings,
    ),
    softRead<ProjectSummaryRow>(
      "zkas_run_project_summaries",
      () => supabase.from("zkas_run_project_summaries").select("id").eq("monthly_cycle_id", cycle.id),
      warnings,
    ),
  ])

  return buildMonthlyCycleZkasStage({
    cycle,
    datasets,
    identityArtifacts,
    runs,
    runResults,
    publishedUserResults,
    projectSummaries,
    warnings,
  })
}

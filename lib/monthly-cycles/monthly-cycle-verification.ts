import "server-only"

import { getAdminSupabaseClient } from "@/lib/supabase-admin"
import type { Database } from "@/types/supabase"
import { assertMonthString } from "@/lib/zkas/month"

type CycleRow = Pick<
  Database["public"]["Tables"]["monthly_cycles"]["Row"],
  "id" | "cycle_key" | "period_start" | "period_end" | "status" | "verification_started_at" | "approval_started_at" | "status_note"
>

type RunRow = Pick<
  Database["public"]["Tables"]["zkas_runs"]["Row"],
  | "id"
  | "status"
  | "verification_status"
  | "user_count"
  | "total_score"
  | "total_allocated_usd"
  | "result_artifact_hash"
  | "attestation_artifact_hash"
  | "created_at"
  | "published_at"
>

type ResultRow = Pick<Database["public"]["Tables"]["zkas_run_results"]["Row"], "allocation_usd" | "eligibility">

export type MonthlyCycleVerificationIssue = {
  code: string
  severity: "blocker" | "warning" | "info"
  title: string
  description: string
  actionHref?: string
}

export type MonthlyCycleVerificationReview = {
  cycle: {
    id: number
    cycleKey: string
    periodStart: string
    periodEnd: string
    status: CycleRow["status"]
    verificationStartedAt: string | null
    approvalStartedAt: string | null
    statusNote: string | null
  }
  latestCompletedRun: RunRow | null
  totals: {
    runCount: number
    completedRunCount: number
    failedRunCount: number
    resultCount: number
    eligibleResultCount: number
    totalAllocatedUsd: number
  }
  issues: MonthlyCycleVerificationIssue[]
  canMarkVerified: boolean
  canApprove: boolean
}

function sumAllocations(rows: ResultRow[]) {
  return rows.reduce((sum, row) => sum + Number(row.allocation_usd ?? 0), 0)
}

function isCompletedOrFinalizedRun(run: RunRow) {
  return run.status === "completed" || run.status === "finalized"
}

export function buildMonthlyCycleVerificationReview(input: {
  cycle: CycleRow
  runs: RunRow[]
  results: ResultRow[]
}): MonthlyCycleVerificationReview {
  const runs = [...input.runs].sort((left, right) => right.created_at.localeCompare(left.created_at))
  const latestCompletedRun = runs.find(isCompletedOrFinalizedRun) ?? null
  const issues: MonthlyCycleVerificationIssue[] = []

  if (!["calculation", "verification", "approval"].includes(input.cycle.status)) {
    issues.push({
      code: "cycle_not_in_review_stage",
      severity: "blocker",
      title: "Cycle is not in calculation review",
      description: "Package calculation inputs and run the calculation before cycle verification can proceed.",
      actionHref: `/admin/cycles/${input.cycle.cycle_key}/zkas`,
    })
  }

  if (!latestCompletedRun) {
    issues.push({
      code: "no_completed_run",
      severity: "blocker",
      title: "No completed zkAS run",
      description: "A completed run with result rows is required before this cycle can be verified.",
      actionHref: "/admin/zkas/runs",
    })
  }

  if (runs.some((run) => run.status === "failed")) {
    issues.push({
      code: "failed_run_present",
      severity: "warning",
      title: "Failed run exists",
      description: "Review failed attempts before approving this cycle for distribution.",
      actionHref: "/admin/zkas/runs",
    })
  }

  if (latestCompletedRun && latestCompletedRun.verification_status !== "verified") {
    issues.push({
      code: "run_not_verified",
      severity: "blocker",
      title: "Completed run is not verified",
      description: "The zkAS superadmin run verification must pass before the cycle-level review can be marked clean.",
      actionHref: `/admin/superadmin/zkas/runs/${latestCompletedRun.id}`,
    })
  }

  if (latestCompletedRun && !latestCompletedRun.result_artifact_hash) {
    issues.push({
      code: "result_artifact_missing",
      severity: "blocker",
      title: "Result artifact hash missing",
      description: "The completed run must have a persisted result artifact hash before approval.",
      actionHref: `/admin/superadmin/zkas/runs/${latestCompletedRun.id}`,
    })
  }

  const totalAllocatedUsd = sumAllocations(input.results)
  const runAllocatedUsd = Number(latestCompletedRun?.total_allocated_usd ?? 0)
  if (latestCompletedRun && Math.abs(totalAllocatedUsd - runAllocatedUsd) > 0.01) {
    issues.push({
      code: "allocation_total_mismatch",
      severity: "blocker",
      title: "Allocation totals do not match",
      description: `Result rows total ${totalAllocatedUsd.toFixed(2)} but the completed run reports ${runAllocatedUsd.toFixed(2)}.`,
      actionHref: `/admin/superadmin/zkas/runs/${latestCompletedRun.id}`,
    })
  }

  const hasBlockers = issues.some((issue) => issue.severity === "blocker")
  return {
    cycle: {
      id: input.cycle.id,
      cycleKey: input.cycle.cycle_key,
      periodStart: input.cycle.period_start,
      periodEnd: input.cycle.period_end,
      status: input.cycle.status,
      verificationStartedAt: input.cycle.verification_started_at,
      approvalStartedAt: input.cycle.approval_started_at,
      statusNote: input.cycle.status_note,
    },
    latestCompletedRun,
    totals: {
      runCount: runs.length,
      completedRunCount: runs.filter(isCompletedOrFinalizedRun).length,
      failedRunCount: runs.filter((run) => run.status === "failed").length,
      resultCount: input.results.length,
      eligibleResultCount: input.results.filter((row) => row.eligibility).length,
      totalAllocatedUsd,
    },
    issues,
    canMarkVerified: !hasBlockers && input.cycle.status !== "approval",
    canApprove: input.cycle.status === "verification" && !hasBlockers,
  }
}

export async function loadMonthlyCycleVerificationReview(cycleKey: string): Promise<MonthlyCycleVerificationReview | null> {
  const parsedCycleKey = assertMonthString(cycleKey)
  const supabase = getAdminSupabaseClient()
  const { data: cycle, error } = await supabase
    .from("monthly_cycles")
    .select("id, cycle_key, period_start, period_end, status, verification_started_at, approval_started_at, status_note")
    .eq("cycle_key", parsedCycleKey)
    .maybeSingle()

  if (error) throw new Error(error.message)
  if (!cycle) return null

  const [{ data: runs, error: runsError }, { data: results, error: resultsError }] = await Promise.all([
    supabase
      .from("zkas_runs")
      .select("id, status, verification_status, user_count, total_score, total_allocated_usd, result_artifact_hash, attestation_artifact_hash, created_at, published_at")
      .eq("monthly_cycle_id", cycle.id),
    supabase.from("zkas_run_results").select("allocation_usd, eligibility").eq("monthly_cycle_id", cycle.id),
  ])

  if (runsError) throw new Error(runsError.message)
  if (resultsError) throw new Error(resultsError.message)

  return buildMonthlyCycleVerificationReview({
    cycle,
    runs: runs ?? [],
    results: results ?? [],
  })
}

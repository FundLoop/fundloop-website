import type { SupabaseClient } from "@supabase/supabase-js"
import type { Database, Json } from "../../types/supabase.ts"
import { buildMonthlyCycleVerificationIntegrityIssues } from "./monthly-cycle-verification-integrity.ts"

type ActorRole = "internal_admin" | "system"
export type MonthlyCycleVerificationDecision = "verified" | "needs_cleanup"

export type MonthlyCycleVerificationReviewInput = {
  cycleKey: string
  attemptId: string
  actorUserId: string | null
  actorRole: ActorRole
  decision: MonthlyCycleVerificationDecision
  note: string
}

export type MonthlyCycleApprovalInput = {
  cycleKey: string
  attemptId: string
  actorUserId: string | null
  actorRole: ActorRole
  note: string
}

type CommandResult<T> = { ok: true; data: T } | { ok: false; error: { code: string; message: string } }
type CommandDeps = { now?: () => Date }

function success<T>(data: T): CommandResult<T> {
  return { ok: true, data }
}

function failure(code: string, message: string): CommandResult<never> {
  return { ok: false, error: { code, message } }
}

async function insertCycleEvent(
  supabase: SupabaseClient<Database>,
  input: { cycleKey: string; attemptId: string; actorUserId: string | null; actorRole: ActorRole },
  params: {
    cycleId: number | null
    eventType: "verification_review" | "approval_review"
    outcome: "success" | "failure"
    severity?: "info" | "warning" | "error"
    message?: string
    metadata?: Json
  },
) {
  const { error } = await supabase.from("monthly_cycle_events").insert({
    monthly_cycle_id: params.cycleId,
    cycle_key: input.cycleKey,
    event_type: params.eventType,
    attempt_id: input.attemptId,
    actor_user_id: input.actorUserId,
    actor_role: input.actorRole,
    outcome: params.outcome,
    severity: params.severity ?? "info",
    message: params.message ?? null,
    metadata: params.metadata ?? {},
  })
  return error
}

async function getCycle(supabase: SupabaseClient<Database>, cycleKey: string) {
  return supabase.from("monthly_cycles").select("*").eq("cycle_key", cycleKey).maybeSingle()
}

async function getLatestCompletedRun(supabase: SupabaseClient<Database>, cycleId: number) {
  const { data, error } = await supabase
    .from("zkas_runs")
    .select("id, status, verification_status, total_allocated_usd, user_count, result_artifact_path, result_artifact_hash, published_at")
    .eq("monthly_cycle_id", cycleId)
    .in("status", ["completed", "finalized"])
    .order("created_at", { ascending: false })

  if (error) return { data: null, error }
  return { data: data?.[0] ?? null, error: null }
}

async function loadIntegrityRows(supabase: SupabaseClient<Database>, cycleId: number, runId: number) {
  const [
    { data: results, error: resultsError },
    { data: projectResults, error: projectResultsError },
    { data: assetFills, error: assetFillsError },
    { data: returnedPools, error: returnedPoolsError },
  ] = await Promise.all([
    supabase.from("zkas_run_results").select("zkas_user_id, allocation_usd, eligibility").eq("monthly_cycle_id", cycleId).eq("run_id", runId),
    supabase
      .from("monthly_cycle_allocation_project_results")
      .select("project_id, user_id, scoped_cubid_id, attribution_points, total_project_points, project_pool_usd, raw_usd")
      .eq("monthly_cycle_id", cycleId)
      .eq("run_id", runId),
    supabase
      .from("monthly_cycle_allocation_asset_fills")
      .select("user_id, project_id, asset_type, asset_code, usd_value, preference_rank")
      .eq("monthly_cycle_id", cycleId)
      .eq("run_id", runId),
    supabase
      .from("monthly_cycle_allocation_returned_pools")
      .select("project_id, asset_type, asset_code, usd_value")
      .eq("monthly_cycle_id", cycleId)
      .eq("run_id", runId),
  ])

  const error = resultsError ?? projectResultsError ?? assetFillsError ?? returnedPoolsError
  if (error) return { data: null, error }
  return {
    data: {
      results: results ?? [],
      projectResults: projectResults ?? [],
      assetFills: assetFills ?? [],
      returnedPools: returnedPools ?? [],
    },
    error: null,
  }
}

async function validateMvpVerificationIntegrity(
  supabase: SupabaseClient<Database>,
  cycle: Database["public"]["Tables"]["monthly_cycles"]["Row"],
  run: NonNullable<Awaited<ReturnType<typeof getLatestCompletedRun>>["data"]>,
) {
  const { data: integrityRows, error: integrityRowsError } = await loadIntegrityRows(supabase, cycle.id, run.id)
  if (integrityRowsError) return { ok: false as const, code: "query_failed", message: integrityRowsError.message, blockers: [] }
  const integrityIssues = buildMonthlyCycleVerificationIntegrityIssues({
    cycle,
    latestCompletedRun: run,
    results: integrityRows?.results ?? [],
    projectResults: integrityRows?.projectResults ?? [],
    assetFills: integrityRows?.assetFills ?? [],
    returnedPools: integrityRows?.returnedPools ?? [],
  })
  const blockers = integrityIssues.filter((issue) => issue.severity === "blocker")
  if (blockers.length === 0) return { ok: true as const, blockers }
  return {
    ok: false as const,
    code: "verification_integrity_failed",
    message: `MVP verification integrity checks failed: ${blockers.map((issue) => issue.code).join(", ")}.`,
    blockers,
  }
}

export async function executeMonthlyCycleVerificationReviewCommand(
  supabase: SupabaseClient<Database>,
  input: MonthlyCycleVerificationReviewInput,
  deps: CommandDeps = {},
) {
  if (input.actorRole !== "internal_admin") return failure("forbidden", "Only internal admins can review monthly-cycle verification.")
  const note = input.note.trim()
  if (!note) return failure("note_required", "A verification note is required.")
  const now = (deps.now?.() ?? new Date()).toISOString()
  const { data: cycle, error: cycleError } = await getCycle(supabase, input.cycleKey)
  if (cycleError) return failure("query_failed", cycleError.message)
  if (!cycle) return failure("cycle_not_found", "Monthly cycle not found.")

  if (cycle.status !== "calculation" && cycle.status !== "verification") {
    await insertCycleEvent(supabase, input, {
      cycleId: cycle.id,
      eventType: "verification_review",
      outcome: "failure",
      severity: "warning",
      message: "Cycle is not in calculation or verification.",
      metadata: { status: cycle.status },
    })
    return failure("cycle_not_in_calculation", "Only calculation or verification cycles can be reviewed.")
  }

  const { data: run, error: runError } = await getLatestCompletedRun(supabase, cycle.id)
  if (runError) return failure("query_failed", runError.message)

  if (input.decision === "verified") {
    if (!run) return failure("completed_run_required", "A completed zkAS run is required before cycle verification.")
    if (run.verification_status !== "verified") return failure("run_verification_required", "The completed zkAS run must be verified first.")
    if (!run.result_artifact_hash) return failure("result_artifact_required", "A result artifact hash is required before verification.")
    const integrity = await validateMvpVerificationIntegrity(supabase, cycle, run)
    if (!integrity.ok) {
      if (integrity.code === "query_failed") return failure(integrity.code, integrity.message)
      await insertCycleEvent(supabase, input, {
        cycleId: cycle.id,
        eventType: "verification_review",
        outcome: "failure",
        severity: "warning",
        message: "MVP verification integrity checks failed.",
        metadata: { blockerCodes: integrity.blockers.map((issue) => issue.code), issueCount: integrity.blockers.length },
      })
      return failure(integrity.code, integrity.message)
    }
  }

  const nextStatus = input.decision === "verified" ? "verification" : "calculation"
  const { data: updatedCycle, error: updateError } = await supabase
    .from("monthly_cycles")
    .update({
      status: nextStatus,
      verification_started_at: input.decision === "verified" ? (cycle.verification_started_at ?? now) : cycle.verification_started_at,
      status_note: note,
      updated_by_user_id: input.actorUserId,
    })
    .eq("id", cycle.id)
    .in("status", ["calculation", "verification"])
    .select("id, verification_started_at")
    .maybeSingle()

  if (updateError) return failure("review_failed", updateError.message)
  if (!updatedCycle) return failure("cycle_state_changed", "Cycle changed state before verification review could complete.")

  const eventError = await insertCycleEvent(supabase, input, {
    cycleId: cycle.id,
    eventType: "verification_review",
    outcome: "success",
    severity: input.decision === "needs_cleanup" ? "warning" : "info",
    message: input.decision === "verified" ? "Cycle verification review passed." : "Cycle marked as needing cleanup.",
    metadata: { decision: input.decision, note, runId: run?.id ?? null },
  })
  if (eventError) return failure("query_failed", eventError.message)

  return success({
    cycleId: cycle.id,
    cycleKey: cycle.cycle_key,
    status: nextStatus,
    decision: input.decision,
    verificationStartedAt: updatedCycle.verification_started_at,
    cleanupRequired: input.decision === "needs_cleanup",
    note,
  })
}

export async function executeMonthlyCycleApprovalCommand(
  supabase: SupabaseClient<Database>,
  input: MonthlyCycleApprovalInput,
  deps: CommandDeps = {},
) {
  if (input.actorRole !== "internal_admin") return failure("forbidden", "Only internal admins can approve monthly cycles.")
  const note = input.note.trim()
  if (!note) return failure("note_required", "An approval note is required.")
  const now = (deps.now?.() ?? new Date()).toISOString()
  const { data: cycle, error: cycleError } = await getCycle(supabase, input.cycleKey)
  if (cycleError) return failure("query_failed", cycleError.message)
  if (!cycle) return failure("cycle_not_found", "Monthly cycle not found.")
  if (cycle.status !== "verification" && cycle.status !== "approval") {
    await insertCycleEvent(supabase, input, {
      cycleId: cycle.id,
      eventType: "approval_review",
      outcome: "failure",
      severity: "warning",
      message: "Cycle is not in verification or approval.",
      metadata: { status: cycle.status },
    })
    return failure("cycle_not_verified", "Cycle must be in verification before approval.")
  }

  const { data: run, error: runError } = await getLatestCompletedRun(supabase, cycle.id)
  if (runError) return failure("query_failed", runError.message)
  if (!run) {
    await insertCycleEvent(supabase, input, {
      cycleId: cycle.id,
      eventType: "approval_review",
      outcome: "failure",
      severity: "warning",
      message: "Approval requires a completed zkAS run.",
      metadata: { status: cycle.status },
    })
    return failure("completed_run_required", "A completed zkAS run is required before approval.")
  }
  if (run.verification_status !== "verified") {
    await insertCycleEvent(supabase, input, {
      cycleId: cycle.id,
      eventType: "approval_review",
      outcome: "failure",
      severity: "warning",
      message: "Approval requires a verified zkAS run.",
      metadata: { runId: run.id, verificationStatus: run.verification_status },
    })
    return failure("run_verification_required", "The completed zkAS run must be verified first.")
  }
  if (!run.result_artifact_hash) {
    await insertCycleEvent(supabase, input, {
      cycleId: cycle.id,
      eventType: "approval_review",
      outcome: "failure",
      severity: "warning",
      message: "Approval requires a result artifact hash.",
      metadata: { runId: run.id },
    })
    return failure("result_artifact_required", "A result artifact hash is required before approval.")
  }
  const integrity = await validateMvpVerificationIntegrity(supabase, cycle, run)
  if (!integrity.ok) {
    if (integrity.code === "query_failed") return failure(integrity.code, integrity.message)
    await insertCycleEvent(supabase, input, {
      cycleId: cycle.id,
      eventType: "approval_review",
      outcome: "failure",
      severity: "warning",
      message: "Approval requires clean MVP verification integrity checks.",
      metadata: { runId: run.id, blockerCodes: integrity.blockers.map((issue) => issue.code), issueCount: integrity.blockers.length },
    })
    return failure(integrity.code, integrity.message)
  }

  const { data: updatedCycle, error: updateError } = await supabase
    .from("monthly_cycles")
    .update({
      status: "approval",
      approval_started_at: cycle.approval_started_at ?? now,
      status_note: note,
      updated_by_user_id: input.actorUserId,
    })
    .eq("id", cycle.id)
    .in("status", ["verification", "approval"])
    .select("id, approval_started_at")
    .maybeSingle()
  if (updateError) {
    await insertCycleEvent(supabase, input, {
      cycleId: cycle.id,
      eventType: "approval_review",
      outcome: "failure",
      severity: "error",
      message: updateError.message,
      metadata: { runId: run.id },
    })
    return failure("approval_failed", updateError.message)
  }
  if (!updatedCycle) {
    await insertCycleEvent(supabase, input, {
      cycleId: cycle.id,
      eventType: "approval_review",
      outcome: "failure",
      severity: "warning",
      message: "Cycle changed state before approval could complete.",
      metadata: { runId: run.id },
    })
    return failure("cycle_state_changed", "Cycle changed state before approval could complete.")
  }

  const eventError = await insertCycleEvent(supabase, input, {
    cycleId: cycle.id,
    eventType: "approval_review",
    outcome: "success",
    message: "Cycle approved for bookkeeping credit creation.",
    metadata: {
      note,
      runId: run.id,
      totalAllocatedUsd: Number(run.total_allocated_usd ?? 0),
      userCount: run.user_count ?? 0,
      nextStep: "bookkeeping_credit_creation",
      noPayoutExecuted: true,
    },
  })
  if (eventError) return failure("query_failed", eventError.message)

  return success({
    cycleId: cycle.id,
    cycleKey: cycle.cycle_key,
    status: "approval" as const,
    approvalStartedAt: updatedCycle.approval_started_at ?? now,
    approvedRunId: run.id,
    totalAllocatedUsd: Number(run.total_allocated_usd ?? 0),
    userCount: run.user_count ?? 0,
    note,
  })
}

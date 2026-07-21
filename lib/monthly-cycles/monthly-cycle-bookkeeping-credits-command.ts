import type { SupabaseClient } from "@supabase/supabase-js"
import type { Database, Json } from "../../types/supabase.ts"

type ActorRole = "internal_admin" | "system"
type CommandResult<T> = { ok: true; data: T } | { ok: false; error: { code: string; message: string } }
type CommandDeps = { now?: () => Date }

export type MonthlyCycleBookkeepingCreditsCreateInput = {
  cycleKey: string
  attemptId: string
  actorUserId: string | null
  actorRole: ActorRole
}

export type MonthlyCycleBookkeepingCreditsCreateOutput = {
  cycleId: number
  cycleKey: string
  status: "distribution"
  distributionStartedAt: string
  createdCount: number
  existingCount: number
  creditedCount: number
  totalCreditedUsd: number
  returnedPoolUsd: number
  assetFillCount: number
  sourceBreakdownCount: number
  noPayoutExecuted: true
}

type CycleRow = Pick<
  Database["public"]["Tables"]["monthly_cycles"]["Row"],
  "id" | "cycle_key" | "status" | "distribution_started_at"
>

type RunRow = Pick<
  Database["public"]["Tables"]["zkas_runs"]["Row"],
  "id" | "status" | "verification_status" | "total_allocated_usd" | "user_count" | "result_artifact_hash"
>

type ResultRow = Pick<
  Database["public"]["Tables"]["zkas_run_results"]["Row"],
  | "id"
  | "monthly_cycle_id"
  | "run_id"
  | "zkas_user_id"
  | "allocation_usd"
  | "aggregate_score"
  | "app_count"
  | "project_count"
  | "eligibility"
  | "output_row_hash"
>

type ProjectResultRow = Pick<
  Database["public"]["Tables"]["monthly_cycle_allocation_project_results"]["Row"],
  | "project_id"
  | "user_id"
  | "scoped_cubid_id"
  | "attribution_points"
  | "total_project_points"
  | "project_pool_usd"
  | "raw_usd"
>

type AssetFillRow = Pick<
  Database["public"]["Tables"]["monthly_cycle_allocation_asset_fills"]["Row"],
  | "user_id"
  | "pool_id"
  | "project_id"
  | "asset_type"
  | "asset_code"
  | "source_amount"
  | "usd_value"
  | "preference_rank"
  | "partial"
>

type ReturnedPoolRow = Pick<
  Database["public"]["Tables"]["monthly_cycle_allocation_returned_pools"]["Row"],
  "project_id" | "pool_id" | "asset_type" | "asset_code" | "source_amount" | "usd_value" | "reason_code"
>

type ExistingCreditRow = Pick<
  Database["public"]["Tables"]["monthly_cycle_bookkeeping_credits"]["Row"],
  "id" | "idempotency_key" | "usd_equivalent_amount"
>

function success<T>(data: T): CommandResult<T> {
  return { ok: true, data }
}

function failure(code: string, message: string): CommandResult<never> {
  return { ok: false, error: { code, message } }
}

function asArray<T>(value: T[] | null | undefined): T[] {
  return Array.isArray(value) ? value : []
}

function numeric(value: unknown) {
  return Number(value ?? 0)
}

function idempotencyKey(cycleId: number, runId: number, resultId: number) {
  return `monthly-cycle:${cycleId}:run:${runId}:result:${resultId}:bookkeeping-credit:v1`
}

function indexByUser<T extends { user_id: string }>(rows: T[]) {
  const byUser = new Map<string, T[]>()
  for (const row of rows) {
    const current = byUser.get(row.user_id) ?? []
    current.push(row)
    byUser.set(row.user_id, current)
  }
  return byUser
}

function sumUsd(rows: Array<{ usd_value?: number; usd_equivalent_amount?: number; raw_usd?: number }>, key: keyof (typeof rows)[number]) {
  return rows.reduce((sum, row) => sum + numeric(row[key]), 0)
}

function buildAssetFillSnapshot(rows: AssetFillRow[]): Json {
  return rows.map((row) => ({
    poolId: row.pool_id,
    projectId: row.project_id,
    assetType: row.asset_type,
    assetCode: row.asset_code,
    sourceAmount: numeric(row.source_amount),
    usdValue: numeric(row.usd_value),
    preferenceRank: row.preference_rank,
    partial: row.partial,
  })) as Json
}

function buildSourceBreakdownSnapshot(rows: ProjectResultRow[], assetFills: AssetFillRow[]): Json {
  return rows.map((row) => ({
    projectId: row.project_id,
    scopedCubidId: row.scoped_cubid_id,
    attributionPoints: numeric(row.attribution_points),
    totalProjectPoints: numeric(row.total_project_points),
    projectPoolUsd: numeric(row.project_pool_usd),
    rawEntitlementUsd: numeric(row.raw_usd),
    assetFills: assetFills
      .filter((fill) => fill.project_id === row.project_id)
      .map((fill) => ({
        assetType: fill.asset_type,
        assetCode: fill.asset_code,
        sourceAmount: numeric(fill.source_amount),
        usdValue: numeric(fill.usd_value),
        preferenceRank: fill.preference_rank,
        partial: fill.partial,
      })),
  })) as Json
}

function buildAllocationBreakdownSnapshot(result: ResultRow, projectRows: ProjectResultRow[], assetFills: AssetFillRow[]): Json {
  const rawEntitlementUsd = sumUsd(projectRows, "raw_usd")
  const baselineUsd = projectRows.reduce((max, row) => Math.max(max, numeric(row.raw_usd)), 0)
  const allocationUsd = numeric(result.allocation_usd)
  return {
    aggregateScore: numeric(result.aggregate_score),
    appCount: result.app_count,
    projectCount: result.project_count,
    outputRowHash: result.output_row_hash,
    rawEntitlementUsd,
    baselineUsd,
    equalizationTopUpUsd: Math.max(0, allocationUsd - baselineUsd),
    capMultiple: 3,
    capApplied: baselineUsd > 0 && allocationUsd >= baselineUsd * 3,
    assetFillUsd: sumUsd(assetFills, "usd_value"),
  } as Json
}

async function insertCycleEvent(
  supabase: SupabaseClient<Database>,
  input: MonthlyCycleBookkeepingCreditsCreateInput,
  params: {
    cycleId: number | null
    eventType:
      | "bookkeeping_credits_create_attempt"
      | "bookkeeping_credits_create_success"
      | "bookkeeping_credits_create_failure"
    outcome: "attempt" | "success" | "failure"
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

async function getLatestVerifiedRun(supabase: SupabaseClient<Database>, cycleId: number) {
  const { data, error } = await supabase
    .from("zkas_runs")
    .select("id, status, verification_status, total_allocated_usd, user_count, result_artifact_hash")
    .eq("monthly_cycle_id", cycleId)
    .in("status", ["completed", "finalized"])
    .order("created_at", { ascending: false })

  if (error) return { data: null, error }
  return { data: (data?.[0] ?? null) as RunRow | null, error: null }
}

export async function executeMonthlyCycleBookkeepingCreditsCreateCommand(
  supabase: SupabaseClient<Database>,
  input: MonthlyCycleBookkeepingCreditsCreateInput,
  deps: CommandDeps = {},
): Promise<CommandResult<MonthlyCycleBookkeepingCreditsCreateOutput>> {
  if (input.actorRole !== "internal_admin") {
    return failure("forbidden", "Only internal admins can create bookkeeping credits.")
  }

  const now = (deps.now?.() ?? new Date()).toISOString()
  const { data: cycle, error: cycleError } = await supabase
    .from("monthly_cycles")
    .select("id, cycle_key, status, distribution_started_at")
    .eq("cycle_key", input.cycleKey)
    .maybeSingle()

  if (cycleError) return failure("query_failed", cycleError.message)
  if (!cycle) return failure("cycle_not_found", "Monthly cycle not found.")

  const attemptEventError = await insertCycleEvent(supabase, input, {
    cycleId: cycle.id,
    eventType: "bookkeeping_credits_create_attempt",
    outcome: "attempt",
    message: "Bookkeeping credit creation started.",
    metadata: { status: cycle.status },
  })
  if (attemptEventError) return failure("query_failed", attemptEventError.message)

  if (cycle.status !== "approval" && cycle.status !== "distribution") {
    await insertCycleEvent(supabase, input, {
      cycleId: cycle.id,
      eventType: "bookkeeping_credits_create_failure",
      outcome: "failure",
      severity: "warning",
      message: "Cycle is not approved for bookkeeping credit creation.",
      metadata: { status: cycle.status },
    })
    return failure("cycle_not_approved", "Cycle must be approved before bookkeeping credits can be created.")
  }

  const { data: run, error: runError } = await getLatestVerifiedRun(supabase, cycle.id)
  if (runError) return failure("query_failed", runError.message)
  if (!run) return failure("verified_run_required", "A completed verified calculation run is required before credit creation.")
  if (run.verification_status !== "verified") {
    return failure("verified_run_required", "A verified calculation run is required before credit creation.")
  }
  if (!run.result_artifact_hash) {
    return failure("result_artifact_required", "A result artifact hash is required before credit creation.")
  }

  const [
    { data: resultRows, error: resultsError },
    { data: projectRows, error: projectRowsError },
    { data: assetFillRows, error: assetFillRowsError },
    { data: returnedPoolRows, error: returnedPoolRowsError },
  ] = await Promise.all([
    supabase
      .from("zkas_run_results")
      .select("id, monthly_cycle_id, run_id, zkas_user_id, allocation_usd, aggregate_score, app_count, project_count, eligibility, output_row_hash")
      .eq("monthly_cycle_id", cycle.id)
      .eq("run_id", run.id),
    supabase
      .from("monthly_cycle_allocation_project_results")
      .select("project_id, user_id, scoped_cubid_id, attribution_points, total_project_points, project_pool_usd, raw_usd")
      .eq("monthly_cycle_id", cycle.id)
      .eq("run_id", run.id),
    supabase
      .from("monthly_cycle_allocation_asset_fills")
      .select("user_id, pool_id, project_id, asset_type, asset_code, source_amount, usd_value, preference_rank, partial")
      .eq("monthly_cycle_id", cycle.id)
      .eq("run_id", run.id),
    supabase
      .from("monthly_cycle_allocation_returned_pools")
      .select("project_id, pool_id, asset_type, asset_code, source_amount, usd_value, reason_code")
      .eq("monthly_cycle_id", cycle.id)
      .eq("run_id", run.id),
  ])

  if (resultsError) return failure("query_failed", resultsError.message)
  if (projectRowsError) return failure("query_failed", projectRowsError.message)
  if (assetFillRowsError) return failure("query_failed", assetFillRowsError.message)
  if (returnedPoolRowsError) return failure("query_failed", returnedPoolRowsError.message)

  const results = asArray(resultRows as ResultRow[] | null).filter((result) => result.eligibility && numeric(result.allocation_usd) > 0)
  if (results.length === 0) {
    await insertCycleEvent(supabase, input, {
      cycleId: cycle.id,
      eventType: "bookkeeping_credits_create_failure",
      outcome: "failure",
      severity: "warning",
      message: "No positive verified user results exist for this cycle.",
    })
    return failure("verified_results_required", "Positive verified user results are required before bookkeeping credits can be created.")
  }

  const projectRowsByUser = indexByUser(asArray(projectRows as ProjectResultRow[] | null))
  const assetFillsByUser = indexByUser(asArray(assetFillRows as AssetFillRow[] | null))
  const returnedPools = asArray(returnedPoolRows as ReturnedPoolRow[] | null)
  const keys = results.map((result) => idempotencyKey(cycle.id, run.id, result.id))

  const { data: existingRows, error: existingError } = await supabase
    .from("monthly_cycle_bookkeeping_credits")
    .select("id, idempotency_key, usd_equivalent_amount")
    .eq("monthly_cycle_id", cycle.id)
    .in("idempotency_key", keys)

  if (existingError) return failure("query_failed", existingError.message)

  const existing = asArray(existingRows as ExistingCreditRow[] | null)
  const existingKeys = new Set(existing.map((credit) => credit.idempotency_key))
  const inserts = results
    .filter((result) => !existingKeys.has(idempotencyKey(cycle.id, run.id, result.id)))
    .map((result) => {
      const userId = result.zkas_user_id
      const userProjectRows = projectRowsByUser.get(userId) ?? []
      const userAssetFills = assetFillsByUser.get(userId) ?? []
      return {
        monthly_cycle_id: cycle.id,
        run_id: run.id,
        source_result_id: result.id,
        user_id: userId,
        status: "credited",
        payment_status: "not_paid",
        usd_equivalent_amount: numeric(result.allocation_usd),
        currency_code: "USD",
        asset_fills: buildAssetFillSnapshot(userAssetFills),
        source_breakdown: buildSourceBreakdownSnapshot(userProjectRows, userAssetFills),
        allocation_breakdown: buildAllocationBreakdownSnapshot(result, userProjectRows, userAssetFills),
        idempotency_key: idempotencyKey(cycle.id, run.id, result.id),
        credited_by_user_id: input.actorUserId,
        credited_at: now,
      }
    })

  if (inserts.length > 0) {
    const { error: insertError } = await supabase.from("monthly_cycle_bookkeeping_credits").insert(inserts)
    if (insertError) {
      await insertCycleEvent(supabase, input, {
        cycleId: cycle.id,
        eventType: "bookkeeping_credits_create_failure",
        outcome: "failure",
        severity: "error",
        message: insertError.message,
      })
      return failure("bookkeeping_credits_create_failed", insertError.message)
    }
  }

  const { data: updatedCycle, error: updateError } = await supabase
    .from("monthly_cycles")
    .update({
      status: "distribution",
      distribution_started_at: (cycle as CycleRow).distribution_started_at ?? now,
      status_note: "Bookkeeping earnings credits created. No payout transfers executed.",
      updated_by_user_id: input.actorUserId,
    })
    .eq("id", cycle.id)
    .in("status", ["approval", "distribution"])
    .select("id, distribution_started_at")
    .maybeSingle()

  if (updateError) return failure("cycle_update_failed", updateError.message)
  if (!updatedCycle) return failure("cycle_state_changed", "Cycle changed state before bookkeeping credits could be created.")

  const totalCreditedUsd = sumUsd(existing, "usd_equivalent_amount") + sumUsd(inserts, "usd_equivalent_amount")
  const returnedPoolUsd = returnedPools.reduce((sum, row) => sum + numeric(row.usd_value), 0)
  const assetFillCount = asArray(assetFillRows as AssetFillRow[] | null).length
  const sourceBreakdownCount = asArray(projectRows as ProjectResultRow[] | null).length

  const eventError = await insertCycleEvent(supabase, input, {
    cycleId: cycle.id,
    eventType: "bookkeeping_credits_create_success",
    outcome: "success",
    message: "Bookkeeping earnings credits created. No payout transfers executed.",
    metadata: {
      runId: run.id,
      createdCount: inserts.length,
      existingCount: existing.length,
      creditedCount: inserts.length + existing.length,
      totalCreditedUsd,
      returnedPoolUsd,
      assetFillCount,
      sourceBreakdownCount,
      noPayoutExecuted: true,
    },
  })
  if (eventError) return failure("query_failed", eventError.message)

  return success({
    cycleId: cycle.id,
    cycleKey: (cycle as CycleRow).cycle_key,
    status: "distribution",
    distributionStartedAt: updatedCycle.distribution_started_at ?? now,
    createdCount: inserts.length,
    existingCount: existing.length,
    creditedCount: inserts.length + existing.length,
    totalCreditedUsd,
    returnedPoolUsd,
    assetFillCount,
    sourceBreakdownCount,
    noPayoutExecuted: true,
  })
}

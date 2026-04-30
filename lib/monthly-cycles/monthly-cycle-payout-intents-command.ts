import type { SupabaseClient } from "@supabase/supabase-js"
import type { Database, Json } from "../../types/supabase.ts"

type ActorRole = "internal_admin" | "system"
type CommandResult<T> = { ok: true; data: T } | { ok: false; error: { code: string; message: string } }
type CommandDeps = { now?: () => Date }

export type MonthlyCyclePayoutIntentsCreateInput = {
  cycleKey: string
  attemptId: string
  actorUserId: string | null
  actorRole: ActorRole
}

export type MonthlyCyclePayoutIntentsCreateOutput = {
  cycleId: number
  cycleKey: string
  status: "distribution"
  distributionStartedAt: string
  createdCount: number
  existingCount: number
  readyCount: number
  draftCount: number
  totalAmountUsd: number
}

type CycleRow = Pick<
  Database["public"]["Tables"]["monthly_cycles"]["Row"],
  "id" | "cycle_key" | "status" | "distribution_started_at"
>

type PublishedResultRow = Pick<
  Database["public"]["Tables"]["zkas_published_user_results"]["Row"],
  "id" | "monthly_cycle_id" | "user_id" | "allocation_usd"
>

type PayoutRouteRow = Pick<
  Database["public"]["Tables"]["user_payout_routes"]["Row"],
  "id" | "user_id" | "rail" | "currency_code" | "status" | "is_default"
>

type ExistingIntentRow = Pick<
  Database["public"]["Tables"]["payout_intents"]["Row"],
  "id" | "idempotency_key" | "status" | "amount_usd"
>

function success<T>(data: T): CommandResult<T> {
  return { ok: true, data }
}

function failure(code: string, message: string): CommandResult<never> {
  return { ok: false, error: { code, message } }
}

async function insertCycleEvent(
  supabase: SupabaseClient<Database>,
  input: MonthlyCyclePayoutIntentsCreateInput,
  params: {
    cycleId: number | null
    eventType: "payout_intents_create_attempt" | "payout_intents_create_success" | "payout_intents_create_failure"
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

function idempotencyKey(cycleId: number, resultId: number) {
  return `monthly-cycle:${cycleId}:published-result:${resultId}:payout-intent:v1`
}

function indexDefaultRoutes(routes: PayoutRouteRow[]) {
  const byUser = new Map<string, PayoutRouteRow>()
  for (const route of routes) {
    if (route.status === "active" && route.is_default && !byUser.has(route.user_id)) {
      byUser.set(route.user_id, route)
    }
  }
  return byUser
}

function sumAmounts(rows: Array<{ amount_usd: number }>) {
  return rows.reduce((sum, row) => sum + Number(row.amount_usd ?? 0), 0)
}

export async function executeMonthlyCyclePayoutIntentsCreateCommand(
  supabase: SupabaseClient<Database>,
  input: MonthlyCyclePayoutIntentsCreateInput,
  deps: CommandDeps = {},
): Promise<CommandResult<MonthlyCyclePayoutIntentsCreateOutput>> {
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
    eventType: "payout_intents_create_attempt",
    outcome: "attempt",
    message: "Payout intent creation started.",
    metadata: { status: cycle.status },
  })
  if (attemptEventError) return failure("query_failed", attemptEventError.message)

  if (cycle.status !== "approval" && cycle.status !== "distribution") {
    await insertCycleEvent(supabase, input, {
      cycleId: cycle.id,
      eventType: "payout_intents_create_failure",
      outcome: "failure",
      severity: "warning",
      message: "Cycle is not approved for payout intent creation.",
      metadata: { status: cycle.status },
    })
    return failure("cycle_not_approved", "Cycle must be approved before payout intents can be created.")
  }

  const { data: resultRows, error: resultsError } = await supabase
    .from("zkas_published_user_results")
    .select("id, monthly_cycle_id, user_id, allocation_usd")
    .eq("monthly_cycle_id", cycle.id)

  if (resultsError) return failure("query_failed", resultsError.message)

  const results = ((resultRows ?? []) as PublishedResultRow[]).filter((result) => Number(result.allocation_usd ?? 0) > 0)
  if (results.length === 0) {
    await insertCycleEvent(supabase, input, {
      cycleId: cycle.id,
      eventType: "payout_intents_create_failure",
      outcome: "failure",
      severity: "warning",
      message: "No positive published user results exist for this cycle.",
    })
    return failure("published_results_required", "Positive published user results are required before payout intents can be created.")
  }

  const userIds = Array.from(new Set(results.map((result) => result.user_id)))
  const keys = results.map((result) => idempotencyKey(cycle.id, result.id))

  const [routesResponse, existingResponse] = await Promise.all([
    supabase
      .from("user_payout_routes")
      .select("id, user_id, rail, currency_code, status, is_default")
      .in("user_id", userIds)
      .eq("status", "active")
      .eq("is_default", true),
    supabase
      .from("payout_intents")
      .select("id, idempotency_key, status, amount_usd")
      .eq("monthly_cycle_id", cycle.id)
      .in("idempotency_key", keys),
  ])

  if (routesResponse.error) return failure("query_failed", routesResponse.error.message)
  if (existingResponse.error) return failure("query_failed", existingResponse.error.message)

  const routesByUser = indexDefaultRoutes((routesResponse.data ?? []) as PayoutRouteRow[])
  const existing = ((existingResponse.data ?? []) as ExistingIntentRow[])
  const existingKeys = new Set(existing.map((intent) => intent.idempotency_key))
  const inserts = results
    .filter((result) => !existingKeys.has(idempotencyKey(cycle.id, result.id)))
    .map((result) => {
      const route = routesByUser.get(result.user_id)
      const amountUsd = Number(result.allocation_usd)
      return {
        monthly_cycle_id: cycle.id,
        source_result_id: result.id,
        user_id: result.user_id,
        payout_route_id: route?.id ?? null,
        rail: route?.rail ?? null,
        currency_code: route?.currency_code ?? "USD",
        amount_usd: amountUsd,
        status: route ? ("ready" as const) : ("draft" as const),
        idempotency_key: idempotencyKey(cycle.id, result.id),
        status_reason: route ? null : "missing_default_payout_route",
        created_by_user_id: input.actorUserId,
        updated_by_user_id: input.actorUserId,
      }
    })

  if (inserts.length > 0) {
    const { error: insertError } = await supabase.from("payout_intents").insert(inserts)
    if (insertError) {
      await insertCycleEvent(supabase, input, {
        cycleId: cycle.id,
        eventType: "payout_intents_create_failure",
        outcome: "failure",
        severity: "error",
        message: insertError.message,
      })
      return failure("payout_intents_create_failed", insertError.message)
    }
  }

  const { data: updatedCycle, error: updateError } = await supabase
    .from("monthly_cycles")
    .update({
      status: "distribution",
      distribution_started_at: cycle.distribution_started_at ?? now,
      status_note: "Payout intents created from published user results.",
      updated_by_user_id: input.actorUserId,
    })
    .eq("id", cycle.id)
    .in("status", ["approval", "distribution"])
    .select("id, distribution_started_at")
    .maybeSingle()

  if (updateError) return failure("cycle_update_failed", updateError.message)
  if (!updatedCycle) return failure("cycle_state_changed", "Cycle changed state before payout intents could be created.")

  const createdReady = inserts.filter((intent) => intent.status === "ready")
  const createdDraft = inserts.filter((intent) => intent.status === "draft")
  const existingReady = existing.filter((intent) => intent.status === "ready")
  const existingDraft = existing.filter((intent) => intent.status === "draft")
  const totalAmountUsd = sumAmounts(existing) + sumAmounts(inserts)

  const eventError = await insertCycleEvent(supabase, input, {
    cycleId: cycle.id,
    eventType: "payout_intents_create_success",
    outcome: "success",
    message: "Payout intents are ready for payout batching.",
    metadata: {
      createdCount: inserts.length,
      existingCount: existing.length,
      readyCount: createdReady.length + existingReady.length,
      draftCount: createdDraft.length + existingDraft.length,
      totalAmountUsd,
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
    readyCount: createdReady.length + existingReady.length,
    draftCount: createdDraft.length + existingDraft.length,
    totalAmountUsd,
  })
}

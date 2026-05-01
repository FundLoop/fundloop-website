import "server-only"

import { getAdminSupabaseClient } from "@/lib/supabase-admin"
import type { Tables } from "@/types/supabase"

type MonthlyCycleEventRow = Tables<"monthly_cycle_events">

type CycleReference = Pick<Tables<"monthly_cycles">, "id" | "cycle_key" | "status">

export const monthlyCyclePipelineStages = [
  "lock",
  "prep",
  "calculation",
  "verification",
  "approval",
  "distribution",
  "reporting",
] as const

export type MonthlyCyclePipelineStage = (typeof monthlyCyclePipelineStages)[number]

export type MonthlyCycleEventListItem = MonthlyCycleEventRow & {
  stage: MonthlyCyclePipelineStage
  status: string | null
}

export type MonthlyCycleEventFilters = {
  cycleKey?: string
  stage?: MonthlyCyclePipelineStage
  outcome?: "attempt" | "success" | "failure"
  severity?: "info" | "warning" | "error"
  attemptId?: string
  days?: number
  limit?: number
}

export type MonthlyCyclePipelineSummary = {
  stage: MonthlyCyclePipelineStage
  attempts: number
  successes: number
  failures: number
  warnings: number
  latestEventAt: string | null
  latestFailureAt: string | null
}

export type MonthlyCycleObservabilityOverview = {
  summaries: MonthlyCyclePipelineSummary[]
  events: MonthlyCycleEventListItem[]
  attemptEvents: MonthlyCycleEventListItem[]
  totals: {
    eventCount: number
    failureCount: number
    warningCount: number
    affectedCycleCount: number
  }
}

function asArray<T>(value: T[] | null | undefined): T[] {
  return Array.isArray(value) ? value : []
}

function uniqueCount<T>(values: T[]) {
  return new Set(values).size
}

export function inferMonthlyCyclePipelineStage(eventType: string): MonthlyCyclePipelineStage {
  if (eventType.startsWith("lock_")) return "lock"
  if (eventType.startsWith("prep_")) return "prep"
  if (eventType.startsWith("calculation_")) return "calculation"
  if (eventType.startsWith("verification_")) return "verification"
  if (eventType.startsWith("approval_")) return "approval"
  if (eventType.startsWith("payout_")) return "distribution"
  if (eventType.startsWith("reporting_")) return "reporting"
  return "calculation"
}

export function formatMonthlyCycleEventType(value: string) {
  return value.replaceAll("_", " ")
}

function withCycleStatus(events: MonthlyCycleEventRow[], cycles: CycleReference[]): MonthlyCycleEventListItem[] {
  const statusByCycleKey = new Map(cycles.map((cycle) => [cycle.cycle_key, cycle.status]))

  return events.map((event) => ({
    ...event,
    stage: inferMonthlyCyclePipelineStage(event.event_type),
    status: statusByCycleKey.get(event.cycle_key) ?? null,
  }))
}

export function summarizeMonthlyCyclePipelineEvents(events: MonthlyCycleEventListItem[]): MonthlyCyclePipelineSummary[] {
  return monthlyCyclePipelineStages.map((stage) => {
    const stageEvents = events.filter((event) => event.stage === stage)
    const latestFailure = stageEvents.find((event) => event.outcome === "failure")

    return {
      stage,
      attempts: uniqueCount(stageEvents.filter((event) => event.outcome === "attempt").map((event) => event.attempt_id)),
      successes: uniqueCount(stageEvents.filter((event) => event.outcome === "success").map((event) => event.attempt_id)),
      failures: uniqueCount(stageEvents.filter((event) => event.outcome === "failure").map((event) => event.attempt_id)),
      warnings: stageEvents.filter((event) => event.severity === "warning").length,
      latestEventAt: stageEvents[0]?.created_at ?? null,
      latestFailureAt: latestFailure?.created_at ?? null,
    }
  })
}

export function buildMonthlyCycleObservabilityOverview(input: {
  events: MonthlyCycleEventRow[]
  cycles: CycleReference[]
  attemptEvents?: MonthlyCycleEventRow[]
}): MonthlyCycleObservabilityOverview {
  const events = withCycleStatus(input.events, input.cycles)
  const attemptEvents = withCycleStatus(input.attemptEvents ?? [], input.cycles)

  return {
    summaries: summarizeMonthlyCyclePipelineEvents(events),
    events,
    attemptEvents,
    totals: {
      eventCount: events.length,
      failureCount: events.filter((event) => event.outcome === "failure").length,
      warningCount: events.filter((event) => event.severity === "warning").length,
      affectedCycleCount: uniqueCount(events.map((event) => event.cycle_key)),
    },
  }
}

function eventTypesForStage(stage: MonthlyCyclePipelineStage) {
  if (stage === "lock") return ["lock_attempt", "lock_success", "lock_failure"]
  if (stage === "prep") return ["prep_review", "prep_exception"]
  if (stage === "calculation") {
    return ["calculation_package_attempt", "calculation_package_success", "calculation_package_failure"]
  }
  if (stage === "verification") return ["verification_review"]
  if (stage === "approval") return ["approval_review"]
  if (stage === "distribution") {
    return [
      "payout_intents_create_attempt",
      "payout_intents_create_success",
      "payout_intents_create_failure",
      "payout_execution_attempt",
      "payout_execution_success",
      "payout_execution_failure",
    ]
  }
  return ["reporting_publication_attempt", "reporting_publication_success", "reporting_publication_failure"]
}

async function listMonthlyCycleEvents(filters: MonthlyCycleEventFilters = {}) {
  const supabase = getAdminSupabaseClient()
  let query = supabase
    .from("monthly_cycle_events")
    .select("id, monthly_cycle_id, cycle_key, event_type, attempt_id, actor_user_id, actor_role, outcome, severity, message, metadata, created_at")
    .order("created_at", { ascending: false })
    .limit(filters.limit ?? 80)

  if (filters.cycleKey) {
    query = query.eq("cycle_key", filters.cycleKey)
  }

  if (filters.stage) {
    query = query.in("event_type", eventTypesForStage(filters.stage))
  }

  if (filters.outcome) {
    query = query.eq("outcome", filters.outcome)
  }

  if (filters.severity) {
    query = query.eq("severity", filters.severity)
  }

  if (filters.attemptId) {
    query = query.eq("attempt_id", filters.attemptId)
  }

  if (filters.days && Number.isFinite(filters.days)) {
    const cutoff = new Date(Date.now() - filters.days * 24 * 60 * 60 * 1000).toISOString()
    query = query.gte("created_at", cutoff)
  }

  const { data, error } = await query
  if (error) {
    throw error
  }

  return asArray(data as MonthlyCycleEventRow[] | null)
}

export async function loadMonthlyCycleObservabilityOverview(filters: MonthlyCycleEventFilters = {}) {
  const events = await listMonthlyCycleEvents(filters)
  const attemptEvents = filters.attemptId ? await listMonthlyCycleEvents({ attemptId: filters.attemptId, limit: 100 }) : []
  const cycleKeys = [...new Set([...events, ...attemptEvents].map((event) => event.cycle_key))]

  const supabase = getAdminSupabaseClient()
  const { data: cycles, error } =
    cycleKeys.length > 0
      ? await supabase.from("monthly_cycles").select("id, cycle_key, status").in("cycle_key", cycleKeys)
      : { data: [], error: null }

  if (error) {
    throw error
  }

  return buildMonthlyCycleObservabilityOverview({
    events,
    cycles: asArray(cycles as CycleReference[] | null),
    attemptEvents,
  })
}

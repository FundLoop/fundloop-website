import "server-only"

import type { NavigationContext } from "@/lib/navigation-context"
import { createServerSupabaseClient } from "@/lib/supabase-server"
import type { Database } from "@/types/supabase"

export type UserEarningsWarning = {
  scope: string
  message: string
}

export type UserEarningsPayoutRoute = {
  id: number
  label: string
  rail: Database["public"]["Enums"]["payout_rail"]
  currencyCode: string
  status: Database["public"]["Enums"]["payout_route_status"]
  isDefault: boolean
}

export type UserEarningsCycle = {
  key: string
  cycleStatus: Database["public"]["Enums"]["monthly_cycle_status"] | "unassigned"
  resultId: number
  allocationUsd: number
  aggregateScore: number
  publishedAt: string
  payoutIntentId: number | null
  payoutStatus: Database["public"]["Enums"]["payout_intent_status"] | "not_created"
  payoutAmountUsd: number | null
  currencyCode: string
  rail: Database["public"]["Enums"]["payout_rail"] | null
  routeLabel: string | null
  statusReason: string | null
  batchStatus: Database["public"]["Enums"]["payout_batch_status"] | null
  reconciliationStatus: Database["public"]["Enums"]["payout_reconciliation_status"] | null
}

export type UserEarningsWorkspace = {
  summary: {
    resultCount: number
    payoutIntentCount: number
    totalPublishedAllocationUsd: number
    totalPayoutIntentUsd: number
    pendingPayoutUsd: number
    paidPayoutUsd: number
    failedPayoutUsd: number
    draftIntentCount: number
    readyIntentCount: number
    activeRouteCount: number
    hasDefaultRoute: boolean
    nextAction: "add_payout_route" | "wait_for_distribution" | "review_history"
  }
  routes: {
    defaultRoute: UserEarningsPayoutRoute | null
    all: UserEarningsPayoutRoute[]
  }
  cycles: UserEarningsCycle[]
  pendingDistributions: UserEarningsCycle[]
  payoutHistory: UserEarningsCycle[]
  warnings: UserEarningsWarning[]
  rawResultsHref: "/workspace/reporting"
}

type SupabaseReadResult<T> = {
  data: T | null
  error: { message?: string } | null
}

type PublishedResultRow = Pick<
  Database["public"]["Tables"]["zkas_published_user_results"]["Row"],
  "id" | "monthly_cycle_id" | "allocation_usd" | "aggregate_score" | "published_at" | "run_id"
>

type CycleRow = Pick<Database["public"]["Tables"]["monthly_cycles"]["Row"], "id" | "cycle_key" | "status">

type RunRow = Pick<Database["public"]["Tables"]["zkas_runs"]["Row"], "id" | "month">

type RouteRow = Pick<
  Database["public"]["Tables"]["user_payout_routes"]["Row"],
  "id" | "label" | "rail" | "currency_code" | "status" | "is_default"
>

type IntentRow = Pick<
  Database["public"]["Tables"]["payout_intents"]["Row"],
  "id" | "monthly_cycle_id" | "source_result_id" | "payout_route_id" | "rail" | "amount_usd" | "currency_code" | "status" | "status_reason"
>

type BatchItemRow = Pick<
  Database["public"]["Tables"]["payout_batch_items"]["Row"],
  "payout_intent_id" | "payout_batch_id" | "status"
>

type BatchRow = Pick<Database["public"]["Tables"]["payout_batches"]["Row"], "id" | "status">

type ReconciliationRow = Pick<
  Database["public"]["Tables"]["payout_reconciliation_events"]["Row"],
  "payout_intent_id" | "status" | "created_at"
>

function warningFromError(scope: string, error: { message?: string } | null | undefined): UserEarningsWarning | null {
  if (!error) return null
  return {
    scope,
    message: error.message ?? "Earnings data could not be loaded.",
  }
}

async function readEarningsData<T>(
  scope: string,
  query: PromiseLike<SupabaseReadResult<T>>,
  warnings: UserEarningsWarning[],
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
      message: error instanceof Error ? error.message : "Earnings data could not be loaded.",
    })
    return fallback
  }
}

function numberValue(value: number | null | undefined) {
  return Number(value ?? 0)
}

function routeLabel(route: RouteRow | undefined | null) {
  if (!route) return null
  return route.label.trim().length > 0 ? route.label : route.rail
}

function mapRoute(route: RouteRow): UserEarningsPayoutRoute {
  return {
    id: route.id,
    label: route.label.trim().length > 0 ? route.label : route.rail,
    rail: route.rail,
    currencyCode: route.currency_code,
    status: route.status,
    isDefault: route.is_default,
  }
}

function resultCycleKey(result: PublishedResultRow, cycleById: Map<number, CycleRow>, runById: Map<number, RunRow>) {
  if (result.monthly_cycle_id && cycleById.has(result.monthly_cycle_id)) {
    return cycleById.get(result.monthly_cycle_id)?.cycle_key ?? "Unassigned"
  }
  return runById.get(result.run_id)?.month ?? `Run ${result.run_id}`
}

function buildLatestReconciliationStatusByIntent(reconciliationRows: ReconciliationRow[]) {
  const latestByIntent = new Map<number, Database["public"]["Enums"]["payout_reconciliation_status"]>()
  const sortedRows = [...reconciliationRows].sort((left, right) => new Date(right.created_at).getTime() - new Date(left.created_at).getTime())

  for (const row of sortedRows) {
    if (row.payout_intent_id && !latestByIntent.has(row.payout_intent_id)) {
      latestByIntent.set(row.payout_intent_id, row.status)
    }
  }

  return latestByIntent
}

function isPendingPayout(status: UserEarningsCycle["payoutStatus"]) {
  return status === "draft" || status === "ready" || status === "batched" || status === "processing"
}

function isHistoricalPayout(status: UserEarningsCycle["payoutStatus"]) {
  return status === "paid" || status === "failed" || status === "cancelled"
}

export function buildUserEarningsWorkspace({
  publishedResults,
  cycles,
  runs,
  payoutRoutes,
  payoutIntents,
  batchItems,
  batches,
  reconciliationEvents,
  warnings,
}: {
  publishedResults: PublishedResultRow[]
  cycles: CycleRow[]
  runs: RunRow[]
  payoutRoutes: RouteRow[]
  payoutIntents: IntentRow[]
  batchItems: BatchItemRow[]
  batches: BatchRow[]
  reconciliationEvents: ReconciliationRow[]
  warnings: UserEarningsWarning[]
}): UserEarningsWorkspace {
  const cycleById = new Map(cycles.map((cycle) => [cycle.id, cycle]))
  const runById = new Map(runs.map((run) => [run.id, run]))
  const routeById = new Map(payoutRoutes.map((route) => [route.id, route]))
  const intentByResultId = new Map(payoutIntents.filter((intent) => intent.source_result_id).map((intent) => [intent.source_result_id as number, intent]))
  const batchById = new Map(batches.map((batch) => [batch.id, batch]))
  const batchItemByIntentId = new Map(batchItems.map((item) => [item.payout_intent_id, item]))
  const latestReconciliationStatusByIntent = buildLatestReconciliationStatusByIntent(reconciliationEvents)
  const mappedRoutes = payoutRoutes.map(mapRoute)
  const defaultRoute = mappedRoutes.find((route) => route.status === "active" && route.isDefault) ?? null

  const cyclesWithResults = publishedResults
    .map((result): UserEarningsCycle => {
      const intent = intentByResultId.get(result.id) ?? null
      const route = intent?.payout_route_id ? routeById.get(intent.payout_route_id) : null
      const batchItem = intent ? batchItemByIntentId.get(intent.id) : null
      const batch = batchItem ? batchById.get(batchItem.payout_batch_id) : null

      return {
        key: resultCycleKey(result, cycleById, runById),
        cycleStatus: result.monthly_cycle_id ? (cycleById.get(result.monthly_cycle_id)?.status ?? "unassigned") : "unassigned",
        resultId: result.id,
        allocationUsd: numberValue(result.allocation_usd),
        aggregateScore: numberValue(result.aggregate_score),
        publishedAt: result.published_at,
        payoutIntentId: intent?.id ?? null,
        payoutStatus: intent?.status ?? "not_created",
        payoutAmountUsd: intent ? numberValue(intent.amount_usd) : null,
        currencyCode: intent?.currency_code ?? "USD",
        rail: intent?.rail ?? route?.rail ?? null,
        routeLabel: routeLabel(route),
        statusReason: intent?.status_reason ?? null,
        batchStatus: batch?.status ?? null,
        reconciliationStatus: intent ? (latestReconciliationStatusByIntent.get(intent.id) ?? null) : null,
      }
    })
    .sort((left, right) => new Date(right.publishedAt).getTime() - new Date(left.publishedAt).getTime())

  const pendingDistributions = cyclesWithResults.filter((cycle) => isPendingPayout(cycle.payoutStatus))
  const payoutHistory = cyclesWithResults.filter((cycle) => isHistoricalPayout(cycle.payoutStatus))
  const hasDefaultRoute = Boolean(defaultRoute)
  const activeRouteCount = mappedRoutes.filter((route) => route.status === "active").length
  const totalPayoutIntentUsd = payoutIntents.reduce((sum, intent) => sum + numberValue(intent.amount_usd), 0)
  const paidPayoutUsd = payoutIntents
    .filter((intent) => intent.status === "paid")
    .reduce((sum, intent) => sum + numberValue(intent.amount_usd), 0)
  const failedPayoutUsd = payoutIntents
    .filter((intent) => intent.status === "failed")
    .reduce((sum, intent) => sum + numberValue(intent.amount_usd), 0)
  const pendingPayoutUsd = payoutIntents
    .filter((intent) => isPendingPayout(intent.status))
    .reduce((sum, intent) => sum + numberValue(intent.amount_usd), 0)
  const draftIntentCount = payoutIntents.filter((intent) => intent.status === "draft").length
  const readyIntentCount = payoutIntents.filter((intent) => intent.status === "ready").length

  return {
    summary: {
      resultCount: publishedResults.length,
      payoutIntentCount: payoutIntents.length,
      totalPublishedAllocationUsd: publishedResults.reduce((sum, result) => sum + numberValue(result.allocation_usd), 0),
      totalPayoutIntentUsd,
      pendingPayoutUsd,
      paidPayoutUsd,
      failedPayoutUsd,
      draftIntentCount,
      readyIntentCount,
      activeRouteCount,
      hasDefaultRoute,
      nextAction: !hasDefaultRoute ? "add_payout_route" : pendingDistributions.length > 0 ? "wait_for_distribution" : "review_history",
    },
    routes: {
      defaultRoute,
      all: mappedRoutes.sort((left, right) => Number(right.isDefault) - Number(left.isDefault) || left.label.localeCompare(right.label)),
    },
    cycles: cyclesWithResults,
    pendingDistributions,
    payoutHistory,
    warnings,
    rawResultsHref: "/workspace/reporting",
  }
}

export async function getUserEarningsWorkspace(navigationContext: NavigationContext): Promise<UserEarningsWorkspace> {
  const warnings: UserEarningsWarning[] = []
  const user = navigationContext.user

  if (!user) {
    return buildUserEarningsWorkspace({
      publishedResults: [],
      cycles: [],
      runs: [],
      payoutRoutes: [],
      payoutIntents: [],
      batchItems: [],
      batches: [],
      reconciliationEvents: [],
      warnings,
    })
  }

  const supabase = await createServerSupabaseClient()
  const [publishedResults, payoutRoutes, payoutIntents] = await Promise.all([
    readEarningsData<PublishedResultRow[]>(
      "published-results",
      supabase
        .from("zkas_published_user_results")
        .select("id, monthly_cycle_id, allocation_usd, aggregate_score, published_at, run_id")
        .eq("user_id", user.id)
        .order("published_at", { ascending: false }),
      warnings,
      [],
    ),
    readEarningsData<RouteRow[]>(
      "payout-routes",
      supabase
        .from("user_payout_routes")
        .select("id, label, rail, currency_code, status, is_default")
        .eq("user_id", user.id)
        .order("is_default", { ascending: false })
        .order("created_at", { ascending: false }),
      warnings,
      [],
    ),
    readEarningsData<IntentRow[]>(
      "payout-intents",
      supabase
        .from("payout_intents")
        .select("id, monthly_cycle_id, source_result_id, payout_route_id, rail, amount_usd, currency_code, status, status_reason")
        .eq("user_id", user.id)
        .order("updated_at", { ascending: false }),
      warnings,
      [],
    ),
  ])

  const cycleIds = Array.from(
    new Set([
      ...publishedResults.map((result) => result.monthly_cycle_id).filter((id): id is number => typeof id === "number"),
      ...payoutIntents.map((intent) => intent.monthly_cycle_id),
    ]),
  )
  const runIds = Array.from(new Set(publishedResults.map((result) => result.run_id)))
  const intentIds = payoutIntents.map((intent) => intent.id)

  const [cycles, runs, batchItems, reconciliationEvents] = await Promise.all([
    cycleIds.length > 0
      ? readEarningsData<CycleRow[]>(
          "monthly-cycles",
          supabase.from("monthly_cycles").select("id, cycle_key, status").in("id", cycleIds),
          warnings,
          [],
        )
      : Promise.resolve([]),
    runIds.length > 0
      ? readEarningsData<RunRow[]>("result-runs", supabase.from("zkas_runs").select("id, month").in("id", runIds), warnings, [])
      : Promise.resolve([]),
    intentIds.length > 0
      ? readEarningsData<BatchItemRow[]>(
          "payout-batch-items",
          supabase.from("payout_batch_items").select("payout_intent_id, payout_batch_id, status").in("payout_intent_id", intentIds),
          warnings,
          [],
        )
      : Promise.resolve([]),
    intentIds.length > 0
      ? readEarningsData<ReconciliationRow[]>(
          "payout-reconciliation",
          supabase
            .from("payout_reconciliation_events")
            .select("payout_intent_id, status, created_at")
            .in("payout_intent_id", intentIds)
            .order("created_at", { ascending: false }),
          warnings,
          [],
        )
      : Promise.resolve([]),
  ])

  const batchIds = Array.from(new Set(batchItems.map((item) => item.payout_batch_id)))
  const batches =
    batchIds.length > 0
      ? await readEarningsData<BatchRow[]>(
          "payout-batches",
          supabase.from("payout_batches").select("id, status").in("id", batchIds),
          warnings,
          [],
        )
      : []

  return buildUserEarningsWorkspace({
    publishedResults,
    cycles,
    runs,
    payoutRoutes,
    payoutIntents,
    batchItems,
    batches,
    reconciliationEvents,
    warnings,
  })
}

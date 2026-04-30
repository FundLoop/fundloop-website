import "server-only"

import { getAdminSupabaseClient } from "@/lib/supabase-admin"
import type { Database } from "@/types/supabase"
import { monthlyCycleStatusLabels, type MonthlyCycleStatus, type MonthlyCycleWarning } from "."

type CycleRow = Pick<
  Database["public"]["Tables"]["monthly_cycles"]["Row"],
  "id" | "cycle_key" | "period_start" | "period_end" | "status" | "approval_started_at" | "distribution_started_at" | "status_note"
>

type PayoutIntentRow = Pick<
  Database["public"]["Tables"]["payout_intents"]["Row"],
  "id" | "monthly_cycle_id" | "user_id" | "payout_route_id" | "rail" | "amount_usd" | "currency_code" | "status" | "status_reason"
>

type PayoutBatchRow = Pick<
  Database["public"]["Tables"]["payout_batches"]["Row"],
  "id" | "monthly_cycle_id" | "rail" | "status" | "total_amount_usd" | "intent_count"
>

type ReconciliationRow = Pick<
  Database["public"]["Tables"]["payout_reconciliation_events"]["Row"],
  "id" | "status" | "payout_intent_id" | "payout_batch_id"
>

type PublishedResultRow = Pick<Database["public"]["Tables"]["zkas_published_user_results"]["Row"], "id" | "allocation_usd">

export type MonthlyCyclePayoutOverview = {
  cycle: {
    id: number
    cycleKey: string
    periodStart: string
    periodEnd: string
    status: MonthlyCycleStatus
    statusLabel: string
    approvalStartedAt: string | null
    distributionStartedAt: string | null
    statusNote: string | null
  }
  publishedResults: {
    count: number
    totalAmountUsd: number
  }
  intents: {
    count: number
    readyCount: number
    draftCount: number
    batchedCount: number
    processingCount: number
    paidCount: number
    failedCount: number
    totalAmountUsd: number
    missingRouteCount: number
    rows: PayoutIntentRow[]
  }
  batches: {
    count: number
    readyCount: number
    processingCount: number
    completedCount: number
    totalAmountUsd: number
    intentCount: number
    rows: PayoutBatchRow[]
  }
  reconciliation: {
    eventCount: number
    pendingCount: number
    mismatchCount: number
    manualReviewCount: number
    resolvedCount: number
  }
  canCreateIntents: boolean
  warnings: MonthlyCycleWarning[]
}

function sum<T>(rows: T[], selector: (row: T) => number) {
  return rows.reduce((total, row) => total + selector(row), 0)
}

function count<T>(rows: T[], predicate: (row: T) => boolean) {
  return rows.reduce((total, row) => (predicate(row) ? total + 1 : total), 0)
}

export function buildMonthlyCyclePayoutOverview(input: {
  cycle: CycleRow
  publishedResults: PublishedResultRow[]
  intents: PayoutIntentRow[]
  batches: PayoutBatchRow[]
  reconciliationEvents: ReconciliationRow[]
  warnings: MonthlyCycleWarning[]
}): MonthlyCyclePayoutOverview {
  return {
    cycle: {
      id: input.cycle.id,
      cycleKey: input.cycle.cycle_key,
      periodStart: input.cycle.period_start,
      periodEnd: input.cycle.period_end,
      status: input.cycle.status,
      statusLabel: monthlyCycleStatusLabels[input.cycle.status],
      approvalStartedAt: input.cycle.approval_started_at,
      distributionStartedAt: input.cycle.distribution_started_at,
      statusNote: input.cycle.status_note,
    },
    publishedResults: {
      count: input.publishedResults.length,
      totalAmountUsd: sum(input.publishedResults, (result) => Number(result.allocation_usd ?? 0)),
    },
    intents: {
      count: input.intents.length,
      readyCount: count(input.intents, (intent) => intent.status === "ready"),
      draftCount: count(input.intents, (intent) => intent.status === "draft"),
      batchedCount: count(input.intents, (intent) => intent.status === "batched"),
      processingCount: count(input.intents, (intent) => intent.status === "processing"),
      paidCount: count(input.intents, (intent) => intent.status === "paid"),
      failedCount: count(input.intents, (intent) => intent.status === "failed"),
      totalAmountUsd: sum(input.intents, (intent) => Number(intent.amount_usd ?? 0)),
      missingRouteCount: count(input.intents, (intent) => intent.status_reason === "missing_default_payout_route"),
      rows: input.intents,
    },
    batches: {
      count: input.batches.length,
      readyCount: count(input.batches, (batch) => batch.status === "ready"),
      processingCount: count(input.batches, (batch) => batch.status === "processing"),
      completedCount: count(input.batches, (batch) => batch.status === "completed"),
      totalAmountUsd: sum(input.batches, (batch) => Number(batch.total_amount_usd ?? 0)),
      intentCount: sum(input.batches, (batch) => Number(batch.intent_count ?? 0)),
      rows: input.batches,
    },
    reconciliation: {
      eventCount: input.reconciliationEvents.length,
      pendingCount: count(input.reconciliationEvents, (event) => event.status === "pending"),
      mismatchCount: count(input.reconciliationEvents, (event) => event.status === "mismatch"),
      manualReviewCount: count(input.reconciliationEvents, (event) => event.status === "manual_review"),
      resolvedCount: count(input.reconciliationEvents, (event) => event.status === "resolved" || event.status === "matched"),
    },
    canCreateIntents: input.cycle.status === "approval" || input.cycle.status === "distribution",
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

export async function loadMonthlyCyclePayoutOverview(cycleKey: string): Promise<MonthlyCyclePayoutOverview | null> {
  const supabase = getAdminSupabaseClient()
  const warnings: MonthlyCycleWarning[] = []
  const { data: cycle, error: cycleError } = await supabase
    .from("monthly_cycles")
    .select("id, cycle_key, period_start, period_end, status, approval_started_at, distribution_started_at, status_note")
    .eq("cycle_key", cycleKey)
    .maybeSingle()

  if (cycleError) throw new Error(cycleError.message)
  if (!cycle) return null

  const [publishedResults, intents, batches] = await Promise.all([
    softRead<PublishedResultRow>(
      "zkas_published_user_results",
      () => supabase.from("zkas_published_user_results").select("id, allocation_usd").eq("monthly_cycle_id", cycle.id),
      warnings,
    ),
    softRead<PayoutIntentRow>(
      "payout_intents",
      () =>
        supabase
          .from("payout_intents")
          .select("id, monthly_cycle_id, user_id, payout_route_id, rail, amount_usd, currency_code, status, status_reason")
          .eq("monthly_cycle_id", cycle.id)
          .order("amount_usd", { ascending: false }),
      warnings,
    ),
    softRead<PayoutBatchRow>(
      "payout_batches",
      () =>
        supabase
          .from("payout_batches")
          .select("id, monthly_cycle_id, rail, status, total_amount_usd, intent_count")
          .eq("monthly_cycle_id", cycle.id)
          .order("created_at", { ascending: false }),
      warnings,
    ),
  ])

  const intentIds = intents.map((intent) => intent.id)
  const batchIds = batches.map((batch) => batch.id)
  const reconciliationFilters = [
    intentIds.length > 0 ? `payout_intent_id.in.(${intentIds.join(",")})` : null,
    batchIds.length > 0 ? `payout_batch_id.in.(${batchIds.join(",")})` : null,
  ].filter(Boolean)
  const reconciliationEvents =
    reconciliationFilters.length > 0
      ? await softRead<ReconciliationRow>(
          "payout_reconciliation_events",
          () =>
            supabase
              .from("payout_reconciliation_events")
              .select("id, status, payout_intent_id, payout_batch_id")
              .or(reconciliationFilters.join(",")),
          warnings,
        )
      : []

  return buildMonthlyCyclePayoutOverview({
    cycle,
    publishedResults,
    intents,
    batches,
    reconciliationEvents,
    warnings,
  })
}

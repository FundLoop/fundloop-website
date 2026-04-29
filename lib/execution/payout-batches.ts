import type { Json } from "@/types/supabase"
import {
  executionFailure,
  executionSuccess,
  type ExecutionCommandResult,
  type PayoutBatchCreateInput,
  type PayoutBatchDraft,
} from "./types"

function roundUsd(value: number) {
  return Math.round((value + Number.EPSILON) * 1_000_000) / 1_000_000
}

function stableDestination(value: Json) {
  if (!value || typeof value !== "object" || Array.isArray(value)) return {}
  return value
}

export function buildPayoutBatchDraft(input: PayoutBatchCreateInput): ExecutionCommandResult<PayoutBatchDraft> {
  if (input.intents.length === 0) {
    return executionFailure("no_payout_intents", "At least one ready payout intent is required.", { rail: input.rail })
  }

  const invalidIntent = input.intents.find((intent) => {
    return (
      intent.rail !== input.rail ||
      intent.currencyCode !== input.currencyCode ||
      intent.routeId <= 0 ||
      !Number.isFinite(intent.amountUsd) ||
      intent.amountUsd <= 0
    )
  })

  if (invalidIntent) {
    return executionFailure(
      "invalid_payout_intent",
      "Every payout intent in a batch must share the requested rail/currency, have a route, and have a positive amount.",
      { rail: input.rail },
    )
  }

  const sortedIntents = [...input.intents].sort((left, right) => left.userId.localeCompare(right.userId) || left.intentId - right.intentId)
  const totalAmountUsd = roundUsd(sortedIntents.reduce((total, intent) => total + intent.amountUsd, 0))

  return executionSuccess({
    monthlyCycleId: input.monthlyCycleId,
    cycleKey: input.cycleKey,
    rail: input.rail,
    currencyCode: input.currencyCode,
    totalAmountUsd,
    intentCount: sortedIntents.length,
    executionPayload: {
      version: "fundloop-payout-batch.v1",
      cycleKey: input.cycleKey,
      rail: input.rail,
      currencyCode: input.currencyCode,
      totalAmountUsd,
      intents: sortedIntents.map((intent, index) => ({
        position: index,
        intentId: intent.intentId,
        userId: intent.userId,
        routeId: intent.routeId,
        amountUsd: roundUsd(intent.amountUsd),
        destination: stableDestination(intent.destination),
      })),
    },
    items: sortedIntents.map((intent, index) => ({
      intentId: intent.intentId,
      amountUsd: roundUsd(intent.amountUsd),
      position: index,
    })),
  })
}

import type { Json } from "../../types/supabase.ts"
import {
  executionFailure,
  executionSuccess,
  type ExecutionCommandResult,
  type PayoutBatchCreateInput,
  type PayoutBatchDraft,
} from "./types.ts"

function roundUsd(value: number) {
  return Math.round((value + Number.EPSILON) * 1_000_000) / 1_000_000
}

function stableDestination(value: Json): Json {
  if (!value || typeof value !== "object" || Array.isArray(value)) return {}
  return Object.fromEntries(
    Object.entries(value)
      .sort(([left], [right]) => left.localeCompare(right))
      .map(([key, child]) => [key, stableDestinationValue(child)]),
  )
}

function stableDestinationValue(value: Json | undefined): Json {
  if (value === undefined) return null
  if (Array.isArray(value)) return value.map((child) => stableDestinationValue(child))
  if (value && typeof value === "object") return stableDestination(value)
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
  const roundedIntents = sortedIntents.map((intent) => ({
    ...intent,
    amountUsd: roundUsd(intent.amountUsd),
  }))
  const totalAmountUsd = roundUsd(roundedIntents.reduce((total, intent) => total + intent.amountUsd, 0))

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
      intents: roundedIntents.map((intent, index) => ({
        position: index,
        intentId: intent.intentId,
        userId: intent.userId,
        routeId: intent.routeId,
        amountUsd: intent.amountUsd,
        destination: stableDestination(intent.destination),
      })),
    },
    items: roundedIntents.map((intent, index) => ({
      intentId: intent.intentId,
      amountUsd: intent.amountUsd,
      position: index,
    })),
  })
}

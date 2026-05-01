import { createScaffoldAdapter } from "../adapter-utils.ts"
import { buildPayoutBatchDraft } from "../payout-batches.ts"
import {
  executionFailure,
  executionSuccess,
  type DepositIntent,
  type DepositIntentCreateInput,
  type DepositReceiptVerification,
  type DepositReceiptVerificationInput,
  type ExecutionCommandResult,
  type PayoutBatchCreateInput,
  type PayoutBatchDraft,
} from "../types.ts"
import type { Json } from "../../../types/supabase.ts"

function isPlainRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value)
}

function mergeMetadata(metadata: Json | undefined, next: Record<string, unknown>): Json {
  return {
    ...(isPlainRecord(metadata) ? metadata : {}),
    ...next,
  } as Json
}

function isNonEmptyString(value: string | null): value is string {
  return value !== null
}

function readDestinationField(destination: Json, field: string) {
  if (!isPlainRecord(destination)) {
    return null
  }

  const value = destination[field]
  return typeof value === "string" && value.trim().length > 0 ? value.trim() : null
}

async function createFiatDepositIntent(input: DepositIntentCreateInput): Promise<ExecutionCommandResult<DepositIntent>> {
  if (input.rail !== "fiat_stub") {
    return executionFailure("invalid_rail", "Fiat deposit intents must use the fiat_stub execution rail.", {
      rail: "fiat_stub",
      retryable: false,
    })
  }

  return executionSuccess({
    rail: "fiat_stub",
    projectId: input.projectId,
    paymentId: input.paymentId,
    paymentMethodId: input.paymentMethodId,
    reference: input.reference,
    money: input.money,
    destination: {
      kind: "external",
      networkKey: "fiat_stub",
      address: null,
      tokenAddress: null,
    },
    instructions: [
      "Fiat inbound funding is planned but not connected to a live provider yet.",
      "Use this intent only for product workflow previews and provider integration planning.",
      "Do not treat this intent as a payable invoice or settled contribution.",
    ],
    metadata: mergeMetadata(input.metadata, {
      source: "execution-interface.v1",
      rail: "fiat_stub",
      execution_mode: "provider_not_configured",
      provider: "unconfigured",
    }),
  })
}

async function verifyFiatDepositReceipt(
  input: DepositReceiptVerificationInput,
): Promise<ExecutionCommandResult<DepositReceiptVerification>> {
  if (input.rail !== "fiat_stub") {
    return executionFailure("invalid_rail", "Fiat receipt verification must use the fiat_stub execution rail.", {
      rail: "fiat_stub",
      retryable: false,
    })
  }

  return executionFailure(
    "fiat_provider_not_configured",
    "Fiat receipt verification is not connected to a live payment provider yet.",
    { rail: "fiat_stub", retryable: false },
  )
}

function createFiatPayoutBatch(input: PayoutBatchCreateInput): ExecutionCommandResult<PayoutBatchDraft> {
  if (input.rail !== "fiat_stub") {
    return executionFailure("invalid_rail", "Fiat payout batches must use the fiat_stub execution rail.", {
      rail: "fiat_stub",
      retryable: false,
    })
  }

  const invalidDestination = input.intents.find((intent) => {
    return !readDestinationField(intent.destination, "method") && !readDestinationField(intent.destination, "accountReference")
  })

  if (invalidDestination) {
    return executionFailure(
      "invalid_payout_destination",
      "Fiat payout intents require a placeholder method or account reference before they can be batched.",
      { rail: "fiat_stub", retryable: false },
    )
  }

  const draft = buildPayoutBatchDraft(input)
  if (!draft.ok) {
    return draft
  }

  const payload = isPlainRecord(draft.data.executionPayload) ? draft.data.executionPayload : {}
  return executionSuccess({
    ...draft.data,
    executionPayload: {
      ...payload,
      version: "fundloop-fiat-payout-batch.v1",
      execution_mode: "provider_not_configured",
      rail: "fiat_stub",
      provider: "unconfigured",
      currency_codes: Array.from(new Set(input.intents.map((intent) => intent.currencyCode))).sort(),
      destination_methods: Array.from(
        new Set(input.intents.map((intent) => readDestinationField(intent.destination, "method")).filter(isNonEmptyString)),
      ).sort(),
    } as Json,
  })
}

export const fiatStubExecutionAdapter = createScaffoldAdapter({
  rail: "fiat_stub",
  createDepositIntent: createFiatDepositIntent,
  verifyDepositReceipt: verifyFiatDepositReceipt,
  createPayoutBatch: createFiatPayoutBatch,
})

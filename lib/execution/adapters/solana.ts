import { createScaffoldAdapter } from "../adapter-utils.ts"
import {
  executionFailure,
  executionSuccess,
  type DepositIntent,
  type DepositIntentCreateInput,
  type DepositReceiptVerification,
  type DepositReceiptVerificationInput,
  type ExecutionCommandResult,
} from "../types.ts"
import type { Json } from "../../../types/supabase.ts"

function isPlainRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value)
}

function normalizeText(value: string | null | undefined) {
  const next = value?.trim()
  return next && next.length > 0 ? next : null
}

function mergeMetadata(metadata: Json | undefined, next: Record<string, unknown>): Json {
  return {
    ...(isPlainRecord(metadata) ? metadata : {}),
    ...next,
  } as Json
}

function readReceiptSignature(receipt: Json) {
  if (!isPlainRecord(receipt)) {
    return null
  }

  const signature = typeof receipt.signature === "string" ? receipt.signature.trim() : null
  const transactionHash = typeof receipt.transactionHash === "string" ? receipt.transactionHash.trim() : null
  const txHash = typeof receipt.txHash === "string" ? receipt.txHash.trim() : null

  return signature || transactionHash || txHash || null
}

async function createSolanaDepositIntent(
  input: DepositIntentCreateInput,
): Promise<ExecutionCommandResult<DepositIntent>> {
  if (input.rail !== "solana") {
    return executionFailure("invalid_rail", "Solana deposit intents must use the solana execution rail.", {
      rail: "solana",
      retryable: false,
    })
  }

  const networkKey = normalizeText(input.route.chainNetworkKey)
  const depositAddress = normalizeText(input.route.treasuryAddress) ?? normalizeText(input.route.contractAddress)

  if (!networkKey) {
    return executionFailure("missing_network", "Solana deposit intents require a configured network key.", {
      rail: "solana",
      retryable: false,
    })
  }

  if (!depositAddress) {
    return executionFailure("missing_deposit_address", "Solana deposit intents require a configured deposit address.", {
      rail: "solana",
      retryable: false,
    })
  }

  return executionSuccess({
    rail: "solana",
    projectId: input.projectId,
    paymentId: input.paymentId,
    paymentMethodId: input.paymentMethodId,
    reference: input.reference,
    money: input.money,
    destination: {
      kind: "address",
      networkKey,
      address: depositAddress,
      tokenAddress: normalizeText(input.route.tokenAddress),
    },
    instructions: [
      "Submit a Solana transfer to the configured FundLoop deposit address.",
      "Use the configured SOL or SPL token mint and exact payment amount.",
      "Return the Solana transaction signature to FundLoop for verification.",
    ],
    metadata: mergeMetadata(input.metadata, {
      source: "execution-interface.v1",
      rail: "solana",
      verification_mode: "signature_scaffold",
      chain_id: input.route.chainId ?? null,
      chain_asset_id: input.route.chainAssetId ?? null,
      intake_contract_id: input.route.intakeContractId ?? null,
      is_native_asset: input.route.isNativeAsset ?? null,
    }),
  })
}

async function verifySolanaDepositReceipt(
  input: DepositReceiptVerificationInput,
): Promise<ExecutionCommandResult<DepositReceiptVerification>> {
  if (input.rail !== "solana") {
    return executionFailure("invalid_rail", "Solana receipt verification must use the solana execution rail.", {
      rail: "solana",
      retryable: false,
    })
  }

  const submittedSignature = normalizeText(input.submittedTxHash)
  if (!submittedSignature) {
    return executionFailure("missing_signature", "A Solana transaction signature is required.", {
      rail: "solana",
      retryable: false,
    })
  }

  if (Math.abs(input.expectedAmountUsd - input.submittedAmountUsd) > 0.000001) {
    return executionFailure("amount_mismatch", "Submitted Solana amount does not match the expected payment amount.", {
      rail: "solana",
      retryable: false,
    })
  }

  const receiptSignature = readReceiptSignature(input.receipt)
  if (receiptSignature && receiptSignature !== submittedSignature) {
    return executionFailure("signature_mismatch", "Receipt signature does not match the submitted Solana signature.", {
      rail: "solana",
      retryable: false,
    })
  }

  return executionSuccess({
    rail: "solana",
    paymentId: input.paymentId,
    verified: true,
    externalReference: receiptSignature ?? submittedSignature,
    observedAmountUsd: input.submittedAmountUsd,
    status: "submitted",
    metadata: mergeMetadata(input.metadata, {
      source: "execution-interface.v1",
      rail: "solana",
      verification_mode: "signature_scaffold",
      deposit_intent_reference: input.depositIntentReference,
    }),
  })
}

export const solanaExecutionAdapter = createScaffoldAdapter({
  rail: "solana",
  createDepositIntent: createSolanaDepositIntent,
  verifyDepositReceipt: verifySolanaDepositReceipt,
})

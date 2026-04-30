import { createScaffoldAdapter } from "../adapter-utils"
import { executionFailure, executionSuccess, type DepositIntentCreateInput, type DepositReceiptVerificationInput } from "../types"

function metadataRecord(metadata: DepositIntentCreateInput["metadata"] | DepositReceiptVerificationInput["metadata"]) {
  if (!metadata || typeof metadata !== "object" || Array.isArray(metadata)) return {}
  return metadata
}

function createEvmDepositIntent(input: DepositIntentCreateInput) {
  if (input.rail !== "evm") {
    return Promise.resolve(executionFailure("invalid_rail", "The EVM adapter can only create EVM deposit intents.", { rail: "evm" }))
  }

  const destinationAddress = input.route.contractAddress ?? input.route.treasuryAddress ?? null
  if (!input.route.chainNetworkKey || !destinationAddress) {
    return Promise.resolve(
      executionFailure("missing_evm_route", "An EVM deposit intent requires a network key and contract or treasury address.", {
        rail: "evm",
      }),
    )
  }

  return Promise.resolve(
    executionSuccess({
      rail: "evm" as const,
      projectId: input.projectId,
      paymentId: input.paymentId,
      paymentMethodId: input.paymentMethodId,
      reference: input.reference,
      money: input.money,
      destination: {
        kind: input.route.contractAddress ? ("contract" as const) : ("address" as const),
        networkKey: input.route.chainNetworkKey,
        address: destinationAddress,
        tokenAddress: input.route.tokenAddress ?? null,
      },
      instructions: [
        "Connect a supported EVM wallet.",
        "Submit the exact payment amount through the configured FundLoop intake route.",
        "Return the transaction receipt to FundLoop for verification.",
      ],
      metadata: {
        ...metadataRecord(input.metadata),
        chainId: input.route.chainId ?? null,
        chainAssetId: input.route.chainAssetId ?? null,
        intakeContractId: input.route.intakeContractId ?? null,
        isNativeAsset: input.route.isNativeAsset ?? null,
        source: "execution-interface.v1",
      },
    }),
  )
}

function readReceiptTransactionHash(receipt: unknown) {
  if (!receipt || typeof receipt !== "object" || Array.isArray(receipt)) return null
  const candidate = (receipt as { transactionHash?: unknown }).transactionHash
  return typeof candidate === "string" && candidate.trim() ? candidate.trim() : null
}

function verifyEvmDepositReceipt(input: DepositReceiptVerificationInput) {
  if (input.rail !== "evm") {
    return Promise.resolve(executionFailure("invalid_rail", "The EVM adapter can only verify EVM deposit receipts.", { rail: "evm" }))
  }

  if (!input.submittedTxHash.trim()) {
    return Promise.resolve(executionFailure("missing_tx_hash", "An EVM receipt requires a transaction hash.", { rail: "evm" }))
  }

  if (!Number.isFinite(input.submittedAmountUsd) || input.submittedAmountUsd <= 0) {
    return Promise.resolve(executionFailure("invalid_amount", "Submitted amount must be positive.", { rail: "evm" }))
  }

  if (!Number.isFinite(input.expectedAmountUsd) || input.expectedAmountUsd <= 0) {
    return Promise.resolve(executionFailure("invalid_expected_amount", "Expected amount must be positive.", { rail: "evm" }))
  }

  if (Math.abs(input.submittedAmountUsd - input.expectedAmountUsd) > 0.000001) {
    return Promise.resolve(executionFailure("amount_mismatch", "Submitted amount does not match the deposit intent amount.", { rail: "evm" }))
  }

  const receiptTransactionHash = readReceiptTransactionHash(input.receipt)
  if (receiptTransactionHash && receiptTransactionHash !== input.submittedTxHash) {
    return Promise.resolve(
      executionFailure("tx_hash_mismatch", "Receipt transaction hash does not match the submitted transaction hash.", { rail: "evm" }),
    )
  }

  return Promise.resolve(
    executionSuccess({
      rail: "evm" as const,
      paymentId: input.paymentId,
      verified: true,
      externalReference: receiptTransactionHash ?? input.submittedTxHash,
      observedAmountUsd: input.submittedAmountUsd,
      status: "submitted" as const,
      metadata: {
        ...metadataRecord(input.metadata),
        source: "execution-interface.v1",
        depositIntentReference: input.depositIntentReference,
      },
    }),
  )
}

export const evmExecutionAdapter = createScaffoldAdapter({
  rail: "evm",
  createDepositIntent: createEvmDepositIntent,
  verifyDepositReceipt: verifyEvmDepositReceipt,
})

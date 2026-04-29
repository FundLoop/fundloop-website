import { createScaffoldAdapter } from "../adapter-utils"
import { executionFailure, executionSuccess, type DepositIntentCreateInput } from "../types"

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
        chainId: input.route.chainId ?? null,
        chainAssetId: input.route.chainAssetId ?? null,
        intakeContractId: input.route.intakeContractId ?? null,
        isNativeAsset: input.route.isNativeAsset ?? null,
        source: "execution-interface.v1",
      },
    }),
  )
}

export const evmExecutionAdapter = createScaffoldAdapter({
  rail: "evm",
  createDepositIntent: createEvmDepositIntent,
})

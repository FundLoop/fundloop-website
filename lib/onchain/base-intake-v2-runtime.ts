import manifestJson from "../../contracts/deployments/base-intake-v2.manifest.json"

export const BASE_INTAKE_V2_VERSION = "fundloop-base-intake-v2"
export const BASE_INTAKE_V2_SYMBOLS = ["USDC", "USDT", "PYUSD"] as const
export type BaseIntakeV2Symbol = (typeof BASE_INTAKE_V2_SYMBOLS)[number]

export type BaseIntakeV2Manifest = {
  version: string
  environment: string
  chainId: number
  enabled: boolean
  contractAddress: string
  platformTreasuryAddress: string
  epochTreasuryAddress: string
  tokens: Record<BaseIntakeV2Symbol, string>
}

export const trackedBaseIntakeV2Manifest = manifestJson as BaseIntakeV2Manifest

export function auditBaseIntakeV2Deployment(input: {
  environment: string
  chainId: number
  version: string
  enabled: boolean
  contractAddress: string
  platformTreasuryAddress: string
  epochTreasuryAddress: string
  tokens: Record<BaseIntakeV2Symbol, string>
}) {
  const manifest = trackedBaseIntakeV2Manifest
  if (input.environment === "production" || !manifest.enabled) {
    return { available: false, status: "disabled" as const, reason: "Base intake V2 has no enabled reviewed deployment manifest." }
  }
  const matches = input.environment === manifest.environment && input.chainId === manifest.chainId &&
    input.version === BASE_INTAKE_V2_VERSION && input.version === manifest.version &&
    input.contractAddress.toLowerCase() === manifest.contractAddress.toLowerCase() &&
    input.platformTreasuryAddress.toLowerCase() === manifest.platformTreasuryAddress.toLowerCase() &&
    input.epochTreasuryAddress.toLowerCase() === manifest.epochTreasuryAddress.toLowerCase() &&
    BASE_INTAKE_V2_SYMBOLS.every((symbol) => input.tokens[symbol].toLowerCase() === manifest.tokens[symbol].toLowerCase())
  return matches
    ? { available: true, status: "healthy" as const, reason: null }
    : { available: false, status: "mismatch" as const, reason: "Database deployment does not match the reviewed Base intake V2 manifest." }
}

export function evaluateBaseIntakeV2Receipt(input: {
  receiptBlockNumber: bigint
  currentBlockNumber: bigint
  minimumConfirmationDepth: number
  receiptBlockHash: string
  observedBlockHash: string
  receiptTxHash: string
  observedTxHash: string
  replacementTxHash?: string
  expectedPlatformAmount: bigint
  expectedEpochAmount: bigint
  observedPlatformAmount: bigint
  observedEpochAmount: bigint
}) {
  const confirmations = Number(input.currentBlockNumber - input.receiptBlockNumber + BigInt(1))
  if (input.observedBlockHash.toLowerCase() !== input.receiptBlockHash.toLowerCase()) return { status: "reorged" as const, confirmations: Math.max(0, confirmations) }
  if (input.replacementTxHash && input.replacementTxHash.toLowerCase() !== input.receiptTxHash.toLowerCase()) return { status: "replaced" as const, confirmations: Math.max(0, confirmations) }
  if (input.observedTxHash.toLowerCase() !== input.receiptTxHash.toLowerCase()) return { status: "mismatch" as const, confirmations: Math.max(0, confirmations) }
  if (confirmations < input.minimumConfirmationDepth) return { status: "confirming" as const, confirmations: Math.max(0, confirmations) }
  return {
    status: input.observedPlatformAmount === input.expectedPlatformAmount && input.observedEpochAmount === input.expectedEpochAmount ? "exact" as const : "mismatch" as const,
    confirmations: Math.max(0, confirmations),
  }
}

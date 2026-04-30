import type { Json } from "@/types/supabase"

export const fundLoopExecutionRails = ["evm", "solana", "fiat_stub"] as const

export type FundLoopExecutionRail = (typeof fundLoopExecutionRails)[number]

export type ExecutionCommandError = {
  code: string
  message: string
  rail: FundLoopExecutionRail | null
  retryable?: boolean
}

export type ExecutionCommandResult<T> = { ok: true; data: T } | { ok: false; error: ExecutionCommandError }

export type ExecutionMoney = {
  amountUsd: number
  currencyCode: string
}

export type ExecutionActor = {
  actorUserId: string | null
  actorRole: "project_admin" | "internal_admin" | "system"
}

export type DepositIntentCreateInput = {
  projectId: number
  projectSlug: string
  paymentId: number
  paymentMethodId: number
  rail: FundLoopExecutionRail
  money: ExecutionMoney
  reference: string
  route: {
    chainId?: number | null
    chainNetworkKey?: string | null
    chainAssetId?: number | null
    intakeContractId?: number | null
    contractAddress?: string | null
    treasuryAddress?: string | null
    tokenAddress?: string | null
    isNativeAsset?: boolean | null
  }
  metadata?: Json
}

export type DepositIntent = {
  rail: FundLoopExecutionRail
  projectId: number
  paymentId: number
  paymentMethodId: number
  reference: string
  money: ExecutionMoney
  destination: {
    kind: "contract" | "address" | "external"
    networkKey: string | null
    address: string | null
    tokenAddress: string | null
  }
  instructions: string[]
  metadata: Json
}

export type DepositReceiptVerificationInput = {
  rail: FundLoopExecutionRail
  paymentId: number
  depositIntentReference: string
  submittedTxHash: string
  receipt: Json
  expectedAmountUsd: number
  submittedAmountUsd: number
  metadata?: Json
}

export type DepositReceiptVerification = {
  rail: FundLoopExecutionRail
  paymentId: number
  verified: boolean
  externalReference: string | null
  observedAmountUsd: number | null
  status: "submitted" | "confirming" | "confirmed" | "failed"
  metadata: Json
}

export type PayoutBatchIntent = {
  intentId: number
  userId: string
  routeId: number
  rail: FundLoopExecutionRail
  currencyCode: string
  amountUsd: number
  destination: Json
}

export type PayoutBatchCreateInput = {
  monthlyCycleId: number
  cycleKey: string
  rail: FundLoopExecutionRail
  currencyCode: string
  intents: PayoutBatchIntent[]
  actor: ExecutionActor
}

export type PayoutBatchDraft = {
  monthlyCycleId: number
  cycleKey: string
  rail: FundLoopExecutionRail
  currencyCode: string
  totalAmountUsd: number
  intentCount: number
  executionPayload: Json
  items: Array<{
    intentId: number
    amountUsd: number
    position: number
  }>
}

export type PayoutBatchExecutionInput = {
  batchId: number
  rail: FundLoopExecutionRail
  currencyCode: string
  totalAmountUsd: number
  intentCount: number
  executionPayload: Json
  actor: ExecutionActor
}

export type PayoutBatchExecution = {
  batchId: number
  rail: FundLoopExecutionRail
  status: "processing" | "completed" | "failed"
  executionReference: string | null
  metadata: Json
}

export type PayoutReconciliationInput = {
  batchId: number
  rail: FundLoopExecutionRail
  executionReference: string | null
  metadata?: Json
}

export type PayoutReconciliation = {
  batchId: number
  rail: FundLoopExecutionRail
  status: "pending" | "matched" | "mismatch" | "manual_review" | "resolved"
  matchedIntentCount: number
  mismatchCount: number
  metadata: Json
}

export type FundLoopExecutionAdapter = {
  rail: FundLoopExecutionRail
  capabilities: {
    createDepositIntent: boolean
    verifyDepositReceipt: boolean
    createPayoutBatch: boolean
    executePayoutBatch: boolean
    reconcilePayoutStatus: boolean
  }
  createDepositIntent(input: DepositIntentCreateInput): Promise<ExecutionCommandResult<DepositIntent>>
  verifyDepositReceipt(input: DepositReceiptVerificationInput): Promise<ExecutionCommandResult<DepositReceiptVerification>>
  createPayoutBatch(input: PayoutBatchCreateInput): Promise<ExecutionCommandResult<PayoutBatchDraft>>
  executePayoutBatch(input: PayoutBatchExecutionInput): Promise<ExecutionCommandResult<PayoutBatchExecution>>
  reconcilePayoutStatus(input: PayoutReconciliationInput): Promise<ExecutionCommandResult<PayoutReconciliation>>
}

export function executionSuccess<T>(data: T): ExecutionCommandResult<T> {
  return { ok: true, data }
}

export function executionFailure(
  code: string,
  message: string,
  options: { rail?: FundLoopExecutionRail | null; retryable?: boolean } = {},
): ExecutionCommandResult<never> {
  return {
    ok: false,
    error: {
      code,
      message,
      rail: options.rail ?? null,
      retryable: options.retryable,
    },
  }
}

export function isExecutionRail(value: string): value is FundLoopExecutionRail {
  return fundLoopExecutionRails.includes(value as FundLoopExecutionRail)
}

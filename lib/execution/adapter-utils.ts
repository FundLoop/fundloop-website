import {
  buildPayoutBatchDraft,
} from "./payout-batches"
import {
  executionFailure,
  type DepositIntent,
  type DepositIntentCreateInput,
  type DepositReceiptVerification,
  type DepositReceiptVerificationInput,
  type ExecutionCommandResult,
  type FundLoopExecutionAdapter,
  type FundLoopExecutionRail,
  type PayoutBatchCreateInput,
  type PayoutBatchDraft,
  type PayoutBatchExecution,
  type PayoutBatchExecutionInput,
  type PayoutReconciliation,
  type PayoutReconciliationInput,
} from "./types"

export function unsupported<T>(rail: FundLoopExecutionRail, capability: string): ExecutionCommandResult<T> {
  return executionFailure("capability_not_implemented", `${capability} is not implemented for the ${rail} adapter yet.`, {
    rail,
    retryable: false,
  })
}

export function createScaffoldAdapter(config: {
  rail: FundLoopExecutionRail
  createPayoutBatch?: (input: PayoutBatchCreateInput) => ExecutionCommandResult<PayoutBatchDraft>
  createDepositIntent?: (input: DepositIntentCreateInput) => Promise<ExecutionCommandResult<DepositIntent>>
  verifyDepositReceipt?: (input: DepositReceiptVerificationInput) => Promise<ExecutionCommandResult<DepositReceiptVerification>>
}): FundLoopExecutionAdapter {
  return {
    rail: config.rail,
    capabilities: {
      createDepositIntent: Boolean(config.createDepositIntent),
      verifyDepositReceipt: Boolean(config.verifyDepositReceipt),
      createPayoutBatch: true,
      executePayoutBatch: false,
      reconcilePayoutStatus: false,
    },
    createDepositIntent(input) {
      return config.createDepositIntent?.(input) ?? Promise.resolve(unsupported(config.rail, "Deposit intent creation"))
    },
    verifyDepositReceipt(input) {
      return config.verifyDepositReceipt?.(input) ?? Promise.resolve(unsupported(config.rail, "Deposit receipt verification"))
    },
    createPayoutBatch(input) {
      return Promise.resolve(config.createPayoutBatch?.(input) ?? buildPayoutBatchDraft(input))
    },
    executePayoutBatch(_input: PayoutBatchExecutionInput) {
      return Promise.resolve(unsupported<PayoutBatchExecution>(config.rail, "Payout batch execution"))
    },
    reconcilePayoutStatus(_input: PayoutReconciliationInput) {
      return Promise.resolve(unsupported<PayoutReconciliation>(config.rail, "Payout reconciliation"))
    },
  }
}

import { validateProjectOnchainPaymentSubmissionRecordInput } from "../../../lib/edge-functions/project-payment-operations-contract.ts"
import { executeProjectOnchainPaymentSubmissionRecordCommand } from "../../../lib/payments/project-payment-operations-command.ts"
import { serveProjectPaymentOperation } from "../_shared/project-payment-operations.ts"

const handleRequest = serveProjectPaymentOperation({
  validate: validateProjectOnchainPaymentSubmissionRecordInput,
  execute: executeProjectOnchainPaymentSubmissionRecordCommand,
})

export { handleRequest }

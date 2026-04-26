import { validateAdminOnchainPaymentReconciliationRunInput } from "../../../lib/edge-functions/admin-payment-operations-contract.ts"
import { executeAdminOnchainPaymentReconciliationRunCommand } from "../../../lib/payments/admin-payment-operations-command.ts"
import { serveAdminPaymentOperation } from "../_shared/admin-payment-operations.ts"

const handleRequest = serveAdminPaymentOperation({
  allowInternalSecret: true,
  validate: validateAdminOnchainPaymentReconciliationRunInput,
  execute: executeAdminOnchainPaymentReconciliationRunCommand,
  buildCommandInput(input, context) {
    return {
      attemptId: input.attemptId ?? crypto.randomUUID(),
      actorUserId: context.actorUserId,
      actorRole: context.actorRole,
      source: context.source,
      limit: input.limit,
      paymentId: input.paymentId,
      submissionId: input.submissionId,
    }
  },
})

export { handleRequest }

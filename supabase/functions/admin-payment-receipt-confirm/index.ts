import { validateAdminPaymentReceiptConfirmInput } from "../../../lib/edge-functions/admin-payment-operations-contract.ts"
import { executeAdminPaymentReceiptConfirmCommand } from "../../../lib/payments/admin-payment-operations-command.ts"
import { serveAdminPaymentOperation } from "../_shared/admin-payment-operations.ts"

const handleRequest = serveAdminPaymentOperation({
  validate: validateAdminPaymentReceiptConfirmInput,
  execute: executeAdminPaymentReceiptConfirmCommand,
  buildCommandInput(input, context) {
    return {
      paymentId: input.paymentId,
      attemptId: input.attemptId ?? crypto.randomUUID(),
      actorUserId: context.actorUserId,
      actorRole: context.actorRole,
    }
  },
})

export { handleRequest }

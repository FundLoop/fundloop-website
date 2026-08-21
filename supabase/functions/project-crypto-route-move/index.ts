import { validateProjectCryptoRouteMoveInput } from "../../../lib/edge-functions/project-payment-operations-contract.ts"
import { executeProjectCryptoRouteMoveCommand } from "../../../lib/payments/project-payment-operations-command.ts"
import { serveProjectPaymentOperation } from "../_shared/project-payment-operations.ts"

const handleRequest = serveProjectPaymentOperation({
  validate: validateProjectCryptoRouteMoveInput,
  execute: executeProjectCryptoRouteMoveCommand,
})

export { handleRequest }

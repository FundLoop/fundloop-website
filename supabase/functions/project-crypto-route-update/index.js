import { validateProjectCryptoRouteUpdateInput } from "../../../lib/edge-functions/project-payment-operations-contract.ts"
import { executeProjectCryptoRouteUpdateCommand } from "../../../lib/payments/project-payment-operations-command.ts"
import { serveProjectPaymentOperation } from "../_shared/project-payment-operations.js"

const handleRequest = serveProjectPaymentOperation({
  validate: validateProjectCryptoRouteUpdateInput,
  execute: executeProjectCryptoRouteUpdateCommand,
})

export { handleRequest }

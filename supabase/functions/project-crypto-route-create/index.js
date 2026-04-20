import { validateProjectCryptoRouteCreateInput } from "../../../lib/edge-functions/project-payment-operations-contract.ts"
import { executeProjectCryptoRouteCreateCommand } from "../../../lib/payments/project-payment-operations-command.ts"
import { serveProjectPaymentOperation } from "../_shared/project-payment-operations.js"

const handleRequest = serveProjectPaymentOperation({
  validate: validateProjectCryptoRouteCreateInput,
  execute: executeProjectCryptoRouteCreateCommand,
})

export { handleRequest }

import { validateProjectCryptoRouteEnabledSetInput } from "../../../lib/edge-functions/project-payment-operations-contract.ts"
import { executeProjectCryptoRouteEnabledSetCommand } from "../../../lib/payments/project-payment-operations-command.ts"
import { serveProjectPaymentOperation } from "../_shared/project-payment-operations.js"

const handleRequest = serveProjectPaymentOperation({
  validate: validateProjectCryptoRouteEnabledSetInput,
  execute: executeProjectCryptoRouteEnabledSetCommand,
})

export { handleRequest }

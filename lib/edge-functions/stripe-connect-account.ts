import { invokeBrowserEdgeCommand } from "./invoke"
import { STRIPE_CONNECT_ACCOUNT_FUNCTION, type StripeConnectAccountInput } from "./stripe-connect-contract"

export function invokeStripeConnectAccount(input: StripeConnectAccountInput) {
  return invokeBrowserEdgeCommand<StripeConnectAccountInput, Record<string, unknown>>(STRIPE_CONNECT_ACCOUNT_FUNCTION, input)
}

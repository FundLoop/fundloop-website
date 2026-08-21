import { invokeBrowserEdgeCommand } from "./invoke"
import { STRIPE_CONNECT_PAYOUT_FUNCTION, type StripeConnectPayoutInput } from "./stripe-connect-contract"

export function invokeStripeConnectPayout(input: StripeConnectPayoutInput) {
  return invokeBrowserEdgeCommand<StripeConnectPayoutInput, Record<string, unknown>>(STRIPE_CONNECT_PAYOUT_FUNCTION, input)
}

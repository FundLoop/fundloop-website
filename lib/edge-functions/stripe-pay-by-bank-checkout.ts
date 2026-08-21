import { invokeBrowserEdgeCommand } from "./invoke"
import { edgeCommandFailure, edgeCommandSuccess, type EdgeCommandResult } from "./result"
import { isStripePayByBankCheckoutCreateOutput, type StripePayByBankCheckoutCreateInput,
  type StripePayByBankCheckoutCreateOutput } from "../stripe/stripe-pay-by-bank-contract"

export const STRIPE_PAY_BY_BANK_CHECKOUT_FUNCTION = "stripe-pay-by-bank-checkout-create"

export async function invokeStripePayByBankCheckoutBrowser(input: StripePayByBankCheckoutCreateInput) {
  const result = await invokeBrowserEdgeCommand<StripePayByBankCheckoutCreateInput, unknown>(STRIPE_PAY_BY_BANK_CHECKOUT_FUNCTION, input)
  if (!result.ok) return result
  return isStripePayByBankCheckoutCreateOutput(result.data) ? edgeCommandSuccess(result.data) :
    edgeCommandFailure("invalid_edge_response", "Pay by Bank Checkout response was invalid.") as EdgeCommandResult<StripePayByBankCheckoutCreateOutput>
}

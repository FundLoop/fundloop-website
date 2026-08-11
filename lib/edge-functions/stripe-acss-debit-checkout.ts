import { invokeBrowserEdgeCommand } from "./invoke"
import { edgeCommandFailure, edgeCommandSuccess, type EdgeCommandResult } from "./result"
import { isStripeAcssDebitCheckoutCreateOutput, type StripeAcssDebitCheckoutCreateInput,
  type StripeAcssDebitCheckoutCreateOutput } from "../stripe/stripe-acss-debit-contract"

export const STRIPE_ACSS_DEBIT_CHECKOUT_FUNCTION = "stripe-acss-debit-checkout-create"

export async function invokeStripeAcssDebitCheckoutBrowser(input: StripeAcssDebitCheckoutCreateInput) {
  const result = await invokeBrowserEdgeCommand<StripeAcssDebitCheckoutCreateInput, unknown>(STRIPE_ACSS_DEBIT_CHECKOUT_FUNCTION, input)
  if (!result.ok) return result
  return isStripeAcssDebitCheckoutCreateOutput(result.data) ? edgeCommandSuccess(result.data) :
    edgeCommandFailure("invalid_edge_response", "PAD Checkout response was invalid.") as EdgeCommandResult<StripeAcssDebitCheckoutCreateOutput>
}

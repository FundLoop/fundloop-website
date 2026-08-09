import { invokeBrowserEdgeCommand } from "./invoke"
import { isStripeBankTransferIntentCreateOutput, type StripeBankTransferIntentCreateInput,
  type StripeBankTransferIntentCreateOutput } from "../stripe/stripe-bank-transfer-contract"
import { edgeCommandFailure, edgeCommandSuccess, type EdgeCommandResult } from "./result"

export const STRIPE_BANK_TRANSFER_INTENT_CREATE_FUNCTION = "stripe-bank-transfer-intent-create"

export async function invokeStripeBankTransferIntentCreateBrowser(input: StripeBankTransferIntentCreateInput) {
  const result = await invokeBrowserEdgeCommand<StripeBankTransferIntentCreateInput,unknown>(STRIPE_BANK_TRANSFER_INTENT_CREATE_FUNCTION,input)
  if (!result.ok) return result
  return isStripeBankTransferIntentCreateOutput(result.data)
    ? edgeCommandSuccess(result.data)
    : edgeCommandFailure("invalid_edge_response","Stripe bank-transfer intent response was invalid.") as EdgeCommandResult<StripeBankTransferIntentCreateOutput>
}

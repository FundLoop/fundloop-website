import { invokeBrowserEdgeCommand } from "./invoke"
import { edgeCommandFailure, edgeCommandSuccess } from "./result"
import type { StripePayByBankStatus } from "../stripe/stripe-pay-by-bank-contract"

const valid = (value: unknown): value is StripePayByBankStatus[] => Array.isArray(value) && value.every((row) => Boolean(row) && typeof row === "object" && typeof (row as StripePayByBankStatus).commandId === "string")
export async function invokeStripePayByBankStatusBrowser(projectSlug: string) {
  const result = await invokeBrowserEdgeCommand<{projectSlug: string}, unknown>("stripe-pay-by-bank-status-read", {projectSlug})
  if (!result.ok) return result
  return valid(result.data) ? edgeCommandSuccess(result.data) : edgeCommandFailure("invalid_edge_response", "Pay by Bank status response was invalid.")
}

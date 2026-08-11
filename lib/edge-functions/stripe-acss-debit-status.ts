import { invokeBrowserEdgeCommand } from "./invoke"
import { edgeCommandFailure, edgeCommandSuccess } from "./result"
import type { StripeAcssDebitStatus } from "../stripe/stripe-acss-debit-contract"

const valid = (value: unknown): value is StripeAcssDebitStatus[] => Array.isArray(value) && value.every((row) => Boolean(row) && typeof row === "object" && typeof (row as StripeAcssDebitStatus).commandId === "string")
export async function invokeStripeAcssDebitStatusBrowser(projectSlug: string) {
  const result = await invokeBrowserEdgeCommand<{projectSlug: string}, unknown>("stripe-acss-debit-status-read", {projectSlug})
  if (!result.ok) return result
  return valid(result.data) ? edgeCommandSuccess(result.data) : edgeCommandFailure("invalid_edge_response", "PAD status response was invalid.")
}

import { invokeBrowserEdgeCommand } from "./invoke"
import type { StripeBankTransferStatus } from "../stripe/stripe-bank-transfer-contract"
import { edgeCommandFailure,edgeCommandSuccess } from "./result"
export const STRIPE_BANK_TRANSFER_STATUS_READ_FUNCTION="stripe-bank-transfer-status-read"
function valid(value:unknown):value is StripeBankTransferStatus[] { return Array.isArray(value)&&value.every(row=>Boolean(row)&&typeof row==="object"&&Number.isInteger((row as StripeBankTransferStatus).intentId)&&typeof (row as StripeBankTransferStatus).status==="string") }
export async function invokeStripeBankTransferStatusBrowser(projectSlug:string) {
  const result=await invokeBrowserEdgeCommand<{projectSlug:string},unknown>(STRIPE_BANK_TRANSFER_STATUS_READ_FUNCTION,{projectSlug})
  if(!result.ok)return result
  return valid(result.data)?edgeCommandSuccess(result.data):edgeCommandFailure("invalid_edge_response","Stripe status response was invalid.")
}

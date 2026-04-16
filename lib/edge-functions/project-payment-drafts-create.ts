import { invokeBrowserEdgeCommand, invokeServerEdgeCommand } from "./invoke"
import {
  isProjectPaymentDraftsCreateOutput,
  PROJECT_PAYMENT_DRAFTS_CREATE_FUNCTION,
  type ProjectPaymentDraftsCreateInput,
  type ProjectPaymentDraftsCreateOutput,
} from "./project-payment-drafts-create-contract"
import { edgeCommandFailure, type EdgeCommandResult } from "./result"

function normalizeProjectPaymentDraftsCreateResult(
  result: EdgeCommandResult<unknown>,
): EdgeCommandResult<ProjectPaymentDraftsCreateOutput> {
  if (!result.ok) {
    return result
  }

  if (!isProjectPaymentDraftsCreateOutput(result.data)) {
    return edgeCommandFailure(
      "invalid_edge_response",
      `Edge Function ${PROJECT_PAYMENT_DRAFTS_CREATE_FUNCTION} returned an invalid payment summary payload.`,
    )
  }

  return result
}

export async function invokeProjectPaymentDraftsCreateBrowser(input: ProjectPaymentDraftsCreateInput) {
  return normalizeProjectPaymentDraftsCreateResult(
    await invokeBrowserEdgeCommand<ProjectPaymentDraftsCreateInput, unknown>(PROJECT_PAYMENT_DRAFTS_CREATE_FUNCTION, input),
  )
}

export async function invokeProjectPaymentDraftsCreateServer(input: ProjectPaymentDraftsCreateInput) {
  return normalizeProjectPaymentDraftsCreateResult(
    await invokeServerEdgeCommand<ProjectPaymentDraftsCreateInput, unknown>(PROJECT_PAYMENT_DRAFTS_CREATE_FUNCTION, input),
  )
}

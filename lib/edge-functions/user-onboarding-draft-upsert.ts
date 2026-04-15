import { invokeBrowserEdgeCommand } from "./invoke"
import {
  isUserOnboardingDraftUpsertOutput,
  USER_ONBOARDING_DRAFT_UPSERT_FUNCTION,
  type UserOnboardingDraftUpsertInput,
  type UserOnboardingDraftUpsertOutput,
} from "./user-onboarding-draft-upsert-contract"
import { edgeCommandFailure, edgeCommandSuccess, type EdgeCommandResult } from "./result"

function normalizeUserOnboardingDraftUpsertResult(
  result: EdgeCommandResult<unknown>,
): EdgeCommandResult<UserOnboardingDraftUpsertOutput> {
  if (!result.ok) {
    return result
  }

  if (!isUserOnboardingDraftUpsertOutput(result.data)) {
    return edgeCommandFailure(
      "invalid_edge_response",
      `Edge Function ${USER_ONBOARDING_DRAFT_UPSERT_FUNCTION} returned an invalid user draft payload.`,
    )
  }

  return edgeCommandSuccess(result.data)
}

export async function invokeUserOnboardingDraftUpsertBrowser(input: UserOnboardingDraftUpsertInput) {
  return normalizeUserOnboardingDraftUpsertResult(
    await invokeBrowserEdgeCommand<UserOnboardingDraftUpsertInput, unknown>(USER_ONBOARDING_DRAFT_UPSERT_FUNCTION, input),
  )
}

export { normalizeUserOnboardingDraftUpsertResult }

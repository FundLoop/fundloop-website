import { invokeBrowserEdgeCommand } from "./invoke"
import { USER_ONBOARDING_DRAFT_CLEAR_FUNCTION, type UserOnboardingDraftClearInput } from "./user-onboarding-draft-clear-contract"
import { edgeCommandFailure, edgeCommandSuccess, type EdgeCommandResult } from "./result"

function normalizeUserOnboardingDraftClearResult(result: EdgeCommandResult<unknown>): EdgeCommandResult<undefined> {
  if (!result.ok) {
    return result
  }

  if (result.data !== undefined && result.data !== null) {
    return edgeCommandFailure(
      "invalid_edge_response",
      `Edge Function ${USER_ONBOARDING_DRAFT_CLEAR_FUNCTION} returned an invalid clear response.`,
    )
  }

  return edgeCommandSuccess(undefined)
}

export async function invokeUserOnboardingDraftClearBrowser(input: UserOnboardingDraftClearInput = {}) {
  return normalizeUserOnboardingDraftClearResult(
    await invokeBrowserEdgeCommand<UserOnboardingDraftClearInput, unknown>(USER_ONBOARDING_DRAFT_CLEAR_FUNCTION, input),
  )
}

export { normalizeUserOnboardingDraftClearResult }

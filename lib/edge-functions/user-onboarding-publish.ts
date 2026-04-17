import { invokeBrowserEdgeCommand } from "./invoke"
import {
  isUserOnboardingPublishOutput,
  USER_ONBOARDING_PUBLISH_FUNCTION,
  type UserOnboardingPublishInput,
  type UserOnboardingPublishOutput,
} from "./user-onboarding-publish-contract"
import { edgeCommandFailure, edgeCommandSuccess, type EdgeCommandResult } from "./result"

function normalizeUserOnboardingPublishResult(
  result: EdgeCommandResult<unknown>,
): EdgeCommandResult<UserOnboardingPublishOutput> {
  if (!result.ok) {
    return result
  }

  if (!isUserOnboardingPublishOutput(result.data)) {
    return edgeCommandFailure(
      "invalid_edge_response",
      `Edge Function ${USER_ONBOARDING_PUBLISH_FUNCTION} returned an invalid publish payload.`,
    )
  }

  return edgeCommandSuccess(result.data)
}

export async function invokeUserOnboardingPublishBrowser(input: UserOnboardingPublishInput = {}) {
  return normalizeUserOnboardingPublishResult(
    await invokeBrowserEdgeCommand<UserOnboardingPublishInput, unknown>(USER_ONBOARDING_PUBLISH_FUNCTION, input),
  )
}

export { normalizeUserOnboardingPublishResult }

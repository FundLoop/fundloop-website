import { invokeBrowserEdgeCommand } from "./invoke"
import {
  isProjectOnboardingPublishOutput,
  PROJECT_ONBOARDING_PUBLISH_FUNCTION,
  type ProjectOnboardingPublishInput,
  type ProjectOnboardingPublishOutput,
} from "./project-onboarding-publish-contract"
import { edgeCommandFailure, edgeCommandSuccess, type EdgeCommandResult } from "./result"

function normalizeProjectOnboardingPublishResult(
  result: EdgeCommandResult<unknown>,
): EdgeCommandResult<ProjectOnboardingPublishOutput> {
  if (!result.ok) {
    return result
  }

  if (!isProjectOnboardingPublishOutput(result.data)) {
    return edgeCommandFailure(
      "invalid_edge_response",
      `Edge Function ${PROJECT_ONBOARDING_PUBLISH_FUNCTION} returned an invalid publish payload.`,
    )
  }

  return edgeCommandSuccess(result.data)
}

export async function invokeProjectOnboardingPublishBrowser(input: ProjectOnboardingPublishInput = {}) {
  return normalizeProjectOnboardingPublishResult(
    await invokeBrowserEdgeCommand<ProjectOnboardingPublishInput, unknown>(PROJECT_ONBOARDING_PUBLISH_FUNCTION, input),
  )
}

export { normalizeProjectOnboardingPublishResult }

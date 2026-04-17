import { invokeBrowserEdgeCommand } from "./invoke"
import {
  PROJECT_ONBOARDING_DRAFT_CLEAR_FUNCTION,
  type ProjectOnboardingDraftClearInput,
} from "./project-onboarding-draft-clear-contract"
import { edgeCommandFailure, edgeCommandSuccess, type EdgeCommandResult } from "./result"

function normalizeProjectOnboardingDraftClearResult(result: EdgeCommandResult<unknown>): EdgeCommandResult<undefined> {
  if (!result.ok) {
    return result
  }

  if (result.data !== undefined && result.data !== null) {
    return edgeCommandFailure(
      "invalid_edge_response",
      `Edge Function ${PROJECT_ONBOARDING_DRAFT_CLEAR_FUNCTION} returned an invalid clear response.`,
    )
  }

  return edgeCommandSuccess(undefined)
}

export async function invokeProjectOnboardingDraftClearBrowser(input: ProjectOnboardingDraftClearInput = {}) {
  return normalizeProjectOnboardingDraftClearResult(
    await invokeBrowserEdgeCommand<ProjectOnboardingDraftClearInput, unknown>(PROJECT_ONBOARDING_DRAFT_CLEAR_FUNCTION, input),
  )
}

export { normalizeProjectOnboardingDraftClearResult }

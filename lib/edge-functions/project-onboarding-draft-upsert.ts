import { invokeBrowserEdgeCommand } from "./invoke"
import {
  isProjectOnboardingDraftUpsertOutput,
  PROJECT_ONBOARDING_DRAFT_UPSERT_FUNCTION,
  type ProjectOnboardingDraftUpsertInput,
  type ProjectOnboardingDraftUpsertOutput,
} from "./project-onboarding-draft-upsert-contract"
import { edgeCommandFailure, edgeCommandSuccess, type EdgeCommandResult } from "./result"

function normalizeProjectOnboardingDraftUpsertResult(
  result: EdgeCommandResult<unknown>,
): EdgeCommandResult<ProjectOnboardingDraftUpsertOutput> {
  if (!result.ok) {
    return result
  }

  if (!isProjectOnboardingDraftUpsertOutput(result.data)) {
    return edgeCommandFailure(
      "invalid_edge_response",
      `Edge Function ${PROJECT_ONBOARDING_DRAFT_UPSERT_FUNCTION} returned an invalid project draft payload.`,
    )
  }

  return edgeCommandSuccess(result.data)
}

export async function invokeProjectOnboardingDraftUpsertBrowser(input: ProjectOnboardingDraftUpsertInput) {
  return normalizeProjectOnboardingDraftUpsertResult(
    await invokeBrowserEdgeCommand<ProjectOnboardingDraftUpsertInput, unknown>(PROJECT_ONBOARDING_DRAFT_UPSERT_FUNCTION, input),
  )
}

export { normalizeProjectOnboardingDraftUpsertResult }

import { edgeCommandSuccess, type EdgeCommandResult } from "./result"

export const PROJECT_ONBOARDING_DRAFT_CLEAR_FUNCTION = "project-onboarding-draft-clear"

export type ProjectOnboardingDraftClearInput = Record<string, never>
export type ProjectOnboardingDraftClearOutput = undefined

export function validateProjectOnboardingDraftClearInput(): EdgeCommandResult<ProjectOnboardingDraftClearInput> {
  return edgeCommandSuccess({})
}

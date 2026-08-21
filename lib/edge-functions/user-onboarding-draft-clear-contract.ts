import { edgeCommandSuccess, type EdgeCommandResult } from "./result.ts"

export const USER_ONBOARDING_DRAFT_CLEAR_FUNCTION = "user-onboarding-draft-clear"

export type UserOnboardingDraftClearInput = Record<string, never>
export type UserOnboardingDraftClearOutput = undefined

export function validateUserOnboardingDraftClearInput(): EdgeCommandResult<UserOnboardingDraftClearInput> {
  return edgeCommandSuccess({})
}

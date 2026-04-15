import {
  PROJECT_ONBOARDING_SCREENS,
  mergeProjectOnboardingPayload,
  sanitizeProjectOnboardingPayload,
  type ProjectOnboardingPayload,
  type ProjectOnboardingScreen,
} from "../onboarding"
import type { Tables } from "../../types/supabase"
import { edgeCommandFailure, edgeCommandSuccess, type EdgeCommandResult } from "./result"
import { isPlainObject, isProjectOnboardingDraftRow } from "./onboarding-contract-utils"

export const PROJECT_ONBOARDING_DRAFT_UPSERT_FUNCTION = "project-onboarding-draft-upsert"

export type ProjectOnboardingDraftUpsertInput = {
  currentScreen: ProjectOnboardingScreen
  payload: ProjectOnboardingPayload
}

export type ProjectOnboardingDraftUpsertValidatedInput = ProjectOnboardingDraftUpsertInput
export type ProjectOnboardingDraftUpsertOutput = Tables<"project_onboarding_drafts">

export function validateProjectOnboardingDraftUpsertInput(
  input: unknown,
): EdgeCommandResult<ProjectOnboardingDraftUpsertValidatedInput> {
  if (!isPlainObject(input)) {
    return edgeCommandFailure("invalid_payload", "Request body must be a JSON object.")
  }

  if (
    typeof input.currentScreen !== "string" ||
    !PROJECT_ONBOARDING_SCREENS.includes(input.currentScreen as ProjectOnboardingScreen)
  ) {
    return edgeCommandFailure("invalid_payload", "currentScreen must be a valid project onboarding screen.")
  }

  if (!isPlainObject(input.payload)) {
    return edgeCommandFailure("invalid_payload", "payload must be a JSON object.")
  }

  return edgeCommandSuccess({
    currentScreen: input.currentScreen as ProjectOnboardingScreen,
    payload: mergeProjectOnboardingPayload(sanitizeProjectOnboardingPayload(input.payload)),
  })
}

export function isProjectOnboardingDraftUpsertOutput(value: unknown): value is ProjectOnboardingDraftUpsertOutput {
  return isProjectOnboardingDraftRow(value)
}

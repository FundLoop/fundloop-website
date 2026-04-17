import {
  USER_ONBOARDING_SCREENS,
  mergeUserOnboardingPayload,
  sanitizeUserOnboardingPayload,
  type UserOnboardingPayload,
  type UserOnboardingScreen,
} from "../onboarding"
import type { Tables } from "../../types/supabase"
import { edgeCommandFailure, edgeCommandSuccess, type EdgeCommandResult } from "./result"
import { isPlainObject, isUserOnboardingDraftRow } from "./onboarding-contract-utils"

export const USER_ONBOARDING_DRAFT_UPSERT_FUNCTION = "user-onboarding-draft-upsert"

export type UserOnboardingDraftUpsertInput = {
  currentScreen: UserOnboardingScreen
  payload: UserOnboardingPayload
}

export type UserOnboardingDraftUpsertValidatedInput = UserOnboardingDraftUpsertInput
export type UserOnboardingDraftUpsertOutput = Tables<"user_onboarding_drafts">

export function validateUserOnboardingDraftUpsertInput(
  input: unknown,
): EdgeCommandResult<UserOnboardingDraftUpsertValidatedInput> {
  if (!isPlainObject(input)) {
    return edgeCommandFailure("invalid_payload", "Request body must be a JSON object.")
  }

  if (typeof input.currentScreen !== "string" || !USER_ONBOARDING_SCREENS.includes(input.currentScreen as UserOnboardingScreen)) {
    return edgeCommandFailure("invalid_payload", "currentScreen must be a valid user onboarding screen.")
  }

  if (!isPlainObject(input.payload)) {
    return edgeCommandFailure("invalid_payload", "payload must be a JSON object.")
  }

  return edgeCommandSuccess({
    currentScreen: input.currentScreen as UserOnboardingScreen,
    payload: mergeUserOnboardingPayload(sanitizeUserOnboardingPayload(input.payload)),
  })
}

export function isUserOnboardingDraftUpsertOutput(value: unknown): value is UserOnboardingDraftUpsertOutput {
  return isUserOnboardingDraftRow(value)
}

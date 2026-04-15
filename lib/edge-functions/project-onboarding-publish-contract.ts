import { edgeCommandFailure, edgeCommandSuccess, type EdgeCommandResult } from "./result"
import { isPlainObject, isNullableString } from "./onboarding-contract-utils"

export const PROJECT_ONBOARDING_PUBLISH_FUNCTION = "project-onboarding-publish"

export type ProjectOnboardingPublishInput = {
  attemptId?: string
}

export type ProjectOnboardingPublishValidatedInput = ProjectOnboardingPublishInput
export type ProjectOnboardingPublishOutput = {
  projectSlug: string | null
}

export function validateProjectOnboardingPublishInput(
  input: unknown,
): EdgeCommandResult<ProjectOnboardingPublishValidatedInput> {
  if (input === undefined) {
    return edgeCommandSuccess({})
  }

  if (!isPlainObject(input)) {
    return edgeCommandFailure("invalid_payload", "Request body must be a JSON object.")
  }

  if (input.attemptId !== undefined && typeof input.attemptId !== "string") {
    return edgeCommandFailure("invalid_payload", "attemptId must be a string when provided.")
  }

  return edgeCommandSuccess({
    attemptId: typeof input.attemptId === "string" && input.attemptId.trim() ? input.attemptId.trim() : undefined,
  })
}

export function isProjectOnboardingPublishOutput(value: unknown): value is ProjectOnboardingPublishOutput {
  return isPlainObject(value) && isNullableString(value.projectSlug)
}

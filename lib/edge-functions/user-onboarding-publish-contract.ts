import type { RelationshipChoice } from "../onboarding.ts"
import { edgeCommandFailure, edgeCommandSuccess, type EdgeCommandResult } from "./result.ts"
import { isPlainObject } from "./onboarding-contract-utils.ts"

export const USER_ONBOARDING_PUBLISH_FUNCTION = "user-onboarding-publish"

export type UserOnboardingPublishInput = {
  attemptId?: string
}

export type UserOnboardingPublishValidatedInput = UserOnboardingPublishInput
export type UserOnboardingPublishOutput = {
  nextFlow: "project" | null
  relationshipChoice: RelationshipChoice
}

export function validateUserOnboardingPublishInput(input: unknown): EdgeCommandResult<UserOnboardingPublishValidatedInput> {
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

export function isUserOnboardingPublishOutput(value: unknown): value is UserOnboardingPublishOutput {
  return (
    isPlainObject(value) &&
    (value.nextFlow === null || value.nextFlow === "project") &&
    (value.relationshipChoice === "individual" ||
      value.relationshipChoice === "team_member" ||
      value.relationshipChoice === "create_project")
  )
}

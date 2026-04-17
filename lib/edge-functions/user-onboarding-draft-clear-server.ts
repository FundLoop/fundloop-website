import "server-only"

import { invokeServerEdgeCommand } from "./invoke-server"
import { USER_ONBOARDING_DRAFT_CLEAR_FUNCTION, type UserOnboardingDraftClearInput } from "./user-onboarding-draft-clear-contract"
import { normalizeUserOnboardingDraftClearResult } from "./user-onboarding-draft-clear"

export async function invokeUserOnboardingDraftClearServer(input: UserOnboardingDraftClearInput = {}) {
  return normalizeUserOnboardingDraftClearResult(
    await invokeServerEdgeCommand<UserOnboardingDraftClearInput, unknown>(USER_ONBOARDING_DRAFT_CLEAR_FUNCTION, input),
  )
}

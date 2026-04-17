import "server-only"

import { invokeServerEdgeCommand } from "./invoke-server"
import {
  USER_ONBOARDING_DRAFT_UPSERT_FUNCTION,
  type UserOnboardingDraftUpsertInput,
} from "./user-onboarding-draft-upsert-contract"
import { normalizeUserOnboardingDraftUpsertResult } from "./user-onboarding-draft-upsert"

export async function invokeUserOnboardingDraftUpsertServer(input: UserOnboardingDraftUpsertInput) {
  return normalizeUserOnboardingDraftUpsertResult(
    await invokeServerEdgeCommand<UserOnboardingDraftUpsertInput, unknown>(USER_ONBOARDING_DRAFT_UPSERT_FUNCTION, input),
  )
}

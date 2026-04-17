import "server-only"

import { invokeServerEdgeCommand } from "./invoke-server"
import { USER_ONBOARDING_PUBLISH_FUNCTION, type UserOnboardingPublishInput } from "./user-onboarding-publish-contract"
import { normalizeUserOnboardingPublishResult } from "./user-onboarding-publish"

export async function invokeUserOnboardingPublishServer(input: UserOnboardingPublishInput = {}) {
  return normalizeUserOnboardingPublishResult(
    await invokeServerEdgeCommand<UserOnboardingPublishInput, unknown>(USER_ONBOARDING_PUBLISH_FUNCTION, input),
  )
}

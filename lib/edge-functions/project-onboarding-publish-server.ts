import "server-only"

import { invokeServerEdgeCommand } from "./invoke-server"
import { PROJECT_ONBOARDING_PUBLISH_FUNCTION, type ProjectOnboardingPublishInput } from "./project-onboarding-publish-contract"
import { normalizeProjectOnboardingPublishResult } from "./project-onboarding-publish"

export async function invokeProjectOnboardingPublishServer(input: ProjectOnboardingPublishInput = {}) {
  return normalizeProjectOnboardingPublishResult(
    await invokeServerEdgeCommand<ProjectOnboardingPublishInput, unknown>(PROJECT_ONBOARDING_PUBLISH_FUNCTION, input),
  )
}

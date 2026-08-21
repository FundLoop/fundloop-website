import "server-only"

import { invokeServerEdgeCommand } from "./invoke-server"
import {
  PROJECT_ONBOARDING_DRAFT_CLEAR_FUNCTION,
  type ProjectOnboardingDraftClearInput,
} from "./project-onboarding-draft-clear-contract"
import { normalizeProjectOnboardingDraftClearResult } from "./project-onboarding-draft-clear"

export async function invokeProjectOnboardingDraftClearServer(input: ProjectOnboardingDraftClearInput = {}) {
  return normalizeProjectOnboardingDraftClearResult(
    await invokeServerEdgeCommand<ProjectOnboardingDraftClearInput, unknown>(PROJECT_ONBOARDING_DRAFT_CLEAR_FUNCTION, input),
  )
}

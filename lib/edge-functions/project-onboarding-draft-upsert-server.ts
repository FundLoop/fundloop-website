import "server-only"

import { invokeServerEdgeCommand } from "./invoke-server"
import {
  PROJECT_ONBOARDING_DRAFT_UPSERT_FUNCTION,
  type ProjectOnboardingDraftUpsertInput,
} from "./project-onboarding-draft-upsert-contract"
import { normalizeProjectOnboardingDraftUpsertResult } from "./project-onboarding-draft-upsert"

export async function invokeProjectOnboardingDraftUpsertServer(input: ProjectOnboardingDraftUpsertInput) {
  return normalizeProjectOnboardingDraftUpsertResult(
    await invokeServerEdgeCommand<ProjectOnboardingDraftUpsertInput, unknown>(PROJECT_ONBOARDING_DRAFT_UPSERT_FUNCTION, input),
  )
}

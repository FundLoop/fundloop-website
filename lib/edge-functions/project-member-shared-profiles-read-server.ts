import "server-only"

import { invokeServerEdgeCommand } from "./invoke-server"
import {
  normalizeProjectMemberSharedProfilesReadResult,
  PROJECT_MEMBER_SHARED_PROFILES_READ_FUNCTION,
  type ProjectMemberSharedProfilesReadInput,
} from "./project-member-shared-profiles-contract"

export async function invokeProjectMemberSharedProfilesReadServer(input: ProjectMemberSharedProfilesReadInput) {
  return normalizeProjectMemberSharedProfilesReadResult(
    await invokeServerEdgeCommand<ProjectMemberSharedProfilesReadInput, unknown>(PROJECT_MEMBER_SHARED_PROFILES_READ_FUNCTION, input),
  )
}

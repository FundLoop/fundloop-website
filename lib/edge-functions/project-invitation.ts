import { invokeBrowserEdgeCommand } from "./invoke"
import {
  normalizeProjectInvitationAcceptResult,
  normalizeProjectInvitationCreateResult,
  PROJECT_INVITATION_ACCEPT_FUNCTION,
  PROJECT_INVITATION_CREATE_FUNCTION,
  type ProjectInvitationAcceptInput,
  type ProjectInvitationCreateInput,
} from "./project-invitation-contract"

export async function invokeProjectInvitationCreate(input: ProjectInvitationCreateInput) {
  return normalizeProjectInvitationCreateResult(
    await invokeBrowserEdgeCommand<ProjectInvitationCreateInput, unknown>(PROJECT_INVITATION_CREATE_FUNCTION, input),
  )
}

export async function invokeProjectInvitationAccept(input: ProjectInvitationAcceptInput) {
  return normalizeProjectInvitationAcceptResult(
    await invokeBrowserEdgeCommand<ProjectInvitationAcceptInput, unknown>(PROJECT_INVITATION_ACCEPT_FUNCTION, input),
  )
}

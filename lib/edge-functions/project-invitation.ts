import { invokeBrowserEdgeCommand } from "./invoke"
import {
  normalizeProjectInvitationAcceptResult,
  normalizeProjectInvitationCreateResult,
  PROJECT_INVITATION_ACCEPT_FUNCTION,
  PROJECT_INVITATION_CREATE_FUNCTION,
  PROJECT_INVITATION_LIST_FUNCTION,
  type ProjectInvitationAcceptInput,
  type ProjectInvitationCreateInput,
  type ProjectInvitationListInput,
  normalizeProjectInvitationListResult,
} from "./project-invitation-contract"

export async function invokeProjectInvitationCreate(input: ProjectInvitationCreateInput) {
  return normalizeProjectInvitationCreateResult(
    await invokeBrowserEdgeCommand<ProjectInvitationCreateInput, unknown>(PROJECT_INVITATION_CREATE_FUNCTION, input),
  )
}

export async function invokeProjectInvitationList(input: ProjectInvitationListInput) {
  return normalizeProjectInvitationListResult(
    await invokeBrowserEdgeCommand<ProjectInvitationListInput, unknown>(PROJECT_INVITATION_LIST_FUNCTION, input),
  )
}

export async function invokeProjectInvitationAccept(input: ProjectInvitationAcceptInput) {
  return normalizeProjectInvitationAcceptResult(
    await invokeBrowserEdgeCommand<ProjectInvitationAcceptInput, unknown>(PROJECT_INVITATION_ACCEPT_FUNCTION, input),
  )
}

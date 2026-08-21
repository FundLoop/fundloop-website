import { invokeBrowserEdgeCommand } from "./invoke"
import {
  normalizeProjectInvitationAcceptResult,
  normalizeProjectInvitationCreateResult,
  normalizeProjectInvitationDeclineResult,
  normalizeProjectInvitationInspectResult,
  normalizeProjectInvitationRevokeResult,
  PROJECT_INVITATION_ACCEPT_FUNCTION,
  PROJECT_INVITATION_CREATE_FUNCTION,
  PROJECT_INVITATION_DECLINE_FUNCTION,
  PROJECT_INVITATION_INSPECT_FUNCTION,
  PROJECT_INVITATION_LIST_FUNCTION,
  PROJECT_INVITATION_REVOKE_FUNCTION,
  type ProjectInvitationAcceptInput,
  type ProjectInvitationCreateInput,
  type ProjectInvitationDeclineInput,
  type ProjectInvitationInspectInput,
  type ProjectInvitationListInput,
  type ProjectInvitationRevokeInput,
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

export async function invokeProjectInvitationInspect(input: ProjectInvitationInspectInput) {
  return normalizeProjectInvitationInspectResult(
    await invokeBrowserEdgeCommand<ProjectInvitationInspectInput, unknown>(PROJECT_INVITATION_INSPECT_FUNCTION, input),
  )
}

export async function invokeProjectInvitationDecline(input: ProjectInvitationDeclineInput) {
  return normalizeProjectInvitationDeclineResult(
    await invokeBrowserEdgeCommand<ProjectInvitationDeclineInput, unknown>(PROJECT_INVITATION_DECLINE_FUNCTION, input),
  )
}

export async function invokeProjectInvitationRevoke(input: ProjectInvitationRevokeInput) {
  return normalizeProjectInvitationRevokeResult(
    await invokeBrowserEdgeCommand<ProjectInvitationRevokeInput, unknown>(PROJECT_INVITATION_REVOKE_FUNCTION, input),
  )
}

import { PROJECT_INVITATION_APPROVED_PROFILE_FIELDS, type ProjectInvitationProfileField } from "./project-invitation-contract.ts"
import { edgeCommandFailure, edgeCommandSuccess, type EdgeCommandResult } from "./result.ts"

export const PROJECT_MEMBER_SHARED_PROFILES_READ_FUNCTION = "project-member-shared-profiles-read"

export type ProjectMemberSharedProfilesReadInput = { projectId: number }
export type ProjectMemberSharedProfile = {
  userId: string
  displayName: string | null
  avatarUrl: string | null
  profileHeadline: string | null
  bio: string | null
  occupationName: string | null
  locationName: string | null
  isAdmin: boolean
  sharedProfileFields: ProjectInvitationProfileField[]
}

function record(value: unknown): Record<string, unknown> | null {
  return value && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : null
}

export function validateProjectMemberSharedProfilesReadInput(input: unknown): EdgeCommandResult<ProjectMemberSharedProfilesReadInput> {
  const value = record(input)
  return value && Number.isSafeInteger(value.projectId) && Number(value.projectId) > 0
    ? edgeCommandSuccess({ projectId: Number(value.projectId) })
    : edgeCommandFailure("invalid_payload", "A valid projectId is required.")
}

export function normalizeProjectMemberSharedProfilesReadResult(result: EdgeCommandResult<unknown>): EdgeCommandResult<ProjectMemberSharedProfile[]> {
  if (!result.ok) return result
  if (!Array.isArray(result.data)) return edgeCommandFailure("invalid_edge_response", "Project member sharing returned an invalid response.")
  const valid = result.data.every((item) => {
    const value = record(item)
    return value && typeof value.userId === "string" && (value.displayName === null || typeof value.displayName === "string") &&
      (value.avatarUrl === null || typeof value.avatarUrl === "string") &&
      (value.profileHeadline === null || typeof value.profileHeadline === "string") &&
      (value.bio === null || typeof value.bio === "string") &&
      (value.occupationName === null || typeof value.occupationName === "string") &&
      (value.locationName === null || typeof value.locationName === "string") && typeof value.isAdmin === "boolean" &&
      Array.isArray(value.sharedProfileFields) && value.sharedProfileFields.length > 0 &&
      value.sharedProfileFields.every((field) => typeof field === "string" && PROJECT_INVITATION_APPROVED_PROFILE_FIELDS.includes(field as ProjectInvitationProfileField))
  })
  return valid ? edgeCommandSuccess(result.data as ProjectMemberSharedProfile[])
    : edgeCommandFailure("invalid_edge_response", "Project member sharing returned unsafe rows.")
}

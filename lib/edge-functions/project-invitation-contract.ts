import { edgeCommandFailure, edgeCommandSuccess, type EdgeCommandResult } from "./result.ts"

export const PROJECT_INVITATION_CREATE_FUNCTION = "project-invitation-create"
export const PROJECT_INVITATION_INSPECT_FUNCTION = "project-invitation-inspect"
export const PROJECT_INVITATION_ACCEPT_FUNCTION = "project-invitation-accept"
export const PROJECT_INVITATION_DECLINE_FUNCTION = "project-invitation-decline"
export const PROJECT_INVITATION_REVOKE_FUNCTION = "project-invitation-revoke"
export const PROJECT_INVITATION_LIST_FUNCTION = "project-invitation-list"

export const PROJECT_INVITATION_APPROVED_PROFILE_FIELDS = [
  "display_name", "avatar", "profile_headline", "bio", "occupation", "location",
] as const
export type ProjectInvitationProfileField = (typeof PROJECT_INVITATION_APPROVED_PROFILE_FIELDS)[number]

export type ProjectInvitationCreateInput = {
  projectSlug: string
  email: string
  role: "member" | "admin"
  idempotencyKey: string
  sharedProfileFields: ProjectInvitationProfileField[]
}

export type ProjectInvitationCreateResult = {
  invitationId: string
  projectId: number
  projectSlug: string
  projectName: string
  email: string
  role: "member" | "admin"
  status: "pending"
  expiresAt: string
  token: string
  sharedProfileFields: ProjectInvitationProfileField[]
  policyStatus: "review"
  policyDocumentId: string
}

export type ProjectInvitationInspectInput = { token: string }
export type ProjectInvitationInspectResult = {
  invitationId: string
  projectId: number
  projectSlug: string
  projectName: string
  role: "member" | "admin"
  status: "pending" | "accepted" | "declined" | "expired" | "revoked"
  expiresAt: string
  sharedProfileFields: ProjectInvitationProfileField[]
  policyDocumentId: string
  policyContentHash: string
  policyLocale: string
  policyStatus: "review"
}

export type ProjectInvitationAcceptInput = ProjectInvitationInspectInput & {
  acknowledged: boolean
  policyDocumentId: string
  policyContentHash: string
  policyLocale: string
  sharedProfileFields: ProjectInvitationProfileField[]
}

export type ProjectInvitationAcceptResult = {
  invitationId: string
  projectId: number
  projectSlug: string
  projectName: string
  organizationId: number
  role: "member" | "admin"
  status: "accepted"
  acceptedAt: string
  evidenceId: string
  policyStatus: "review"
  sharedProfileFields: ProjectInvitationProfileField[]
}

export type ProjectInvitationDeclineInput = { token: string }
export type ProjectInvitationDeclineResult = { invitationId: string; status: "declined"; recordedAt: string }
export type ProjectInvitationRevokeInput = { projectSlug: string; invitationId: string }
export type ProjectInvitationRevokeResult = { invitationId: string; status: "revoked"; recordedAt: string }

export type ProjectInvitationListInput = { projectSlug: string }
export type ProjectInvitationListItem = {
  invitationId: string
  email: string
  role: "member" | "admin"
  status: "pending" | "accepted" | "declined" | "expired" | "revoked"
  expiresAt: string
  createdAt: string
  sharedProfileFields: ProjectInvitationProfileField[]
  policyStatus: "review"
  policyDocumentId: string
}

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
const TOKEN_PATTERN = /^[A-Za-z0-9_-]{32,256}$/

function record(value: unknown): Record<string, unknown> | null {
  return value && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : null
}

function profileFields(value: unknown): ProjectInvitationProfileField[] | null {
  if (!Array.isArray(value) || value.length === 0) return null
  const unique = [...new Set(value)]
  return unique.every((field) => typeof field === "string" && PROJECT_INVITATION_APPROVED_PROFILE_FIELDS.includes(field as ProjectInvitationProfileField))
    ? unique as ProjectInvitationProfileField[] : null
}

export function validateProjectInvitationCreateInput(input: unknown): EdgeCommandResult<ProjectInvitationCreateInput> {
  const value = record(input)
  if (!value) return edgeCommandFailure("invalid_payload", "Request body must be a JSON object.")
  const projectSlug = typeof value.projectSlug === "string" ? value.projectSlug.trim() : ""
  const email = typeof value.email === "string" ? value.email.trim().toLowerCase() : ""
  const role = value.role === "admin" ? "admin" : value.role === "member" ? "member" : null
  const idempotencyKey = typeof value.idempotencyKey === "string" ? value.idempotencyKey.trim() : ""
  const sharedProfileFields = value.sharedProfileFields === undefined
    ? [...PROJECT_INVITATION_APPROVED_PROFILE_FIELDS]
    : profileFields(value.sharedProfileFields)
  if (!projectSlug) return edgeCommandFailure("invalid_payload", "projectSlug is required.")
  if (!EMAIL_PATTERN.test(email) || email.length > 320) return edgeCommandFailure("invalid_payload", "A valid email is required.")
  if (!role) return edgeCommandFailure("invalid_payload", "role must be member or admin.")
  if (idempotencyKey.length < 8 || idempotencyKey.length > 128) {
    return edgeCommandFailure("invalid_payload", "idempotencyKey must be 8-128 characters.")
  }
  if (!sharedProfileFields) return edgeCommandFailure("invalid_payload", "At least one approved profile field is required.")
  return edgeCommandSuccess({ projectSlug, email, role, idempotencyKey, sharedProfileFields })
}

export function validateProjectInvitationInspectInput(input: unknown): EdgeCommandResult<ProjectInvitationInspectInput> {
  const value = record(input)
  const token = value && typeof value.token === "string" ? value.token.trim() : ""
  return TOKEN_PATTERN.test(token)
    ? edgeCommandSuccess({ token })
    : edgeCommandFailure("invalid_payload", "A valid invitation token is required.")
}

export function validateProjectInvitationAcceptInput(input: unknown): EdgeCommandResult<ProjectInvitationAcceptInput> {
  const value = record(input)
  const tokenResult = validateProjectInvitationInspectInput(input)
  if (!tokenResult.ok) return tokenResult
  const sharedProfileFields = profileFields(value?.sharedProfileFields)
  const policyDocumentId = typeof value?.policyDocumentId === "string" ? value.policyDocumentId.trim() : ""
  const policyContentHash = typeof value?.policyContentHash === "string" ? value.policyContentHash.trim() : ""
  const policyLocale = typeof value?.policyLocale === "string" ? value.policyLocale.trim() : ""
  if (value?.acknowledged !== true || !sharedProfileFields || !policyDocumentId || !/^[0-9a-f]{64}$/.test(policyContentHash) || !policyLocale) {
    return edgeCommandFailure("invitation_disclosure_required", "Acknowledge the exact current sharing disclosure before accepting.")
  }
  return edgeCommandSuccess({ token: tokenResult.data.token, acknowledged: true, policyDocumentId, policyContentHash, policyLocale, sharedProfileFields })
}

export const validateProjectInvitationDeclineInput = validateProjectInvitationInspectInput

export function validateProjectInvitationRevokeInput(input: unknown): EdgeCommandResult<ProjectInvitationRevokeInput> {
  const value = record(input)
  const projectSlug = typeof value?.projectSlug === "string" ? value.projectSlug.trim() : ""
  const invitationId = typeof value?.invitationId === "string" ? value.invitationId.trim() : ""
  return projectSlug && /^[0-9a-f-]{36}$/.test(invitationId)
    ? edgeCommandSuccess({ projectSlug, invitationId })
    : edgeCommandFailure("invalid_payload", "projectSlug and invitationId are required.")
}

export function validateProjectInvitationListInput(input: unknown): EdgeCommandResult<ProjectInvitationListInput> {
  const value = record(input)
  const projectSlug = value && typeof value.projectSlug === "string" ? value.projectSlug.trim() : ""
  return projectSlug ? edgeCommandSuccess({ projectSlug }) : edgeCommandFailure("invalid_payload", "projectSlug is required.")
}

export function normalizeProjectInvitationCreateResult(result: EdgeCommandResult<unknown>): EdgeCommandResult<ProjectInvitationCreateResult> {
  if (!result.ok) return result
  const value = record(result.data)
  if (!value || typeof value.invitationId !== "string" || typeof value.projectId !== "number" ||
    typeof value.projectSlug !== "string" || typeof value.projectName !== "string" || typeof value.email !== "string" ||
    (value.role !== "member" && value.role !== "admin") || value.status !== "pending" ||
    typeof value.expiresAt !== "string" || typeof value.token !== "string" || !profileFields(value.sharedProfileFields) ||
    value.policyStatus !== "review" || typeof value.policyDocumentId !== "string") {
    return edgeCommandFailure("invalid_edge_response", "Invitation creation returned an invalid response.")
  }
  return edgeCommandSuccess(value as ProjectInvitationCreateResult)
}

export function normalizeProjectInvitationInspectResult(result: EdgeCommandResult<unknown>): EdgeCommandResult<ProjectInvitationInspectResult> {
  if (!result.ok) return result
  const value = record(result.data)
  if (!value || typeof value.invitationId !== "string" || typeof value.projectId !== "number" ||
    typeof value.projectSlug !== "string" || typeof value.projectName !== "string" ||
    (value.role !== "member" && value.role !== "admin") ||
    !["pending", "accepted", "declined", "expired", "revoked"].includes(String(value.status)) ||
    typeof value.expiresAt !== "string" || !profileFields(value.sharedProfileFields) ||
    typeof value.policyDocumentId !== "string" || typeof value.policyContentHash !== "string" ||
    typeof value.policyLocale !== "string" || value.policyStatus !== "review") {
    return edgeCommandFailure("invalid_edge_response", "Invitation inspection returned an invalid response.")
  }
  return edgeCommandSuccess(value as ProjectInvitationInspectResult)
}

export function normalizeProjectInvitationAcceptResult(result: EdgeCommandResult<unknown>): EdgeCommandResult<ProjectInvitationAcceptResult> {
  if (!result.ok) return result
  const value = record(result.data)
  if (!value || typeof value.invitationId !== "string" || typeof value.projectId !== "number" ||
    typeof value.projectSlug !== "string" || typeof value.projectName !== "string" || typeof value.organizationId !== "number" ||
    (value.role !== "member" && value.role !== "admin") || value.status !== "accepted" || typeof value.acceptedAt !== "string" ||
    typeof value.evidenceId !== "string" || value.policyStatus !== "review" || !profileFields(value.sharedProfileFields)) {
    return edgeCommandFailure("invalid_edge_response", "Invitation acceptance returned an invalid response.")
  }
  return edgeCommandSuccess(value as ProjectInvitationAcceptResult)
}

function normalizeDispositionResult<TStatus extends "declined" | "revoked">(
  result: EdgeCommandResult<unknown>, status: TStatus,
): EdgeCommandResult<{ invitationId: string; status: TStatus; recordedAt: string }> {
  if (!result.ok) return result
  const value = record(result.data)
  return value && typeof value.invitationId === "string" && value.status === status && typeof value.recordedAt === "string"
    ? edgeCommandSuccess(value as { invitationId: string; status: TStatus; recordedAt: string })
    : edgeCommandFailure("invalid_edge_response", `Invitation ${status} returned an invalid response.`)
}

export const normalizeProjectInvitationDeclineResult = (result: EdgeCommandResult<unknown>) => normalizeDispositionResult(result, "declined")
export const normalizeProjectInvitationRevokeResult = (result: EdgeCommandResult<unknown>) => normalizeDispositionResult(result, "revoked")

export function normalizeProjectInvitationListResult(result: EdgeCommandResult<unknown>): EdgeCommandResult<ProjectInvitationListItem[]> {
  if (!result.ok) return result
  if (!Array.isArray(result.data)) return edgeCommandFailure("invalid_edge_response", "Invitation list returned an invalid response.")
  const valid = result.data.every((item) => {
    const value = record(item)
    return value && typeof value.invitationId === "string" && typeof value.email === "string" &&
      (value.role === "member" || value.role === "admin") && ["pending", "accepted", "declined", "expired", "revoked"].includes(String(value.status)) &&
      typeof value.expiresAt === "string" && typeof value.createdAt === "string" && profileFields(value.sharedProfileFields) !== null &&
      value.policyStatus === "review" && typeof value.policyDocumentId === "string" && !("token" in value) && !("tokenDigest" in value)
  })
  return valid ? edgeCommandSuccess(result.data as ProjectInvitationListItem[]) : edgeCommandFailure("invalid_edge_response", "Invitation list returned unsafe or invalid rows.")
}

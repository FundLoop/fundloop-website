import { edgeCommandFailure, edgeCommandSuccess, type EdgeCommandResult } from "./result.ts"

export const PROJECT_INVITATION_CREATE_FUNCTION = "project-invitation-create"
export const PROJECT_INVITATION_ACCEPT_FUNCTION = "project-invitation-accept"
export const PROJECT_INVITATION_LIST_FUNCTION = "project-invitation-list"

export type ProjectInvitationCreateInput = {
  projectSlug: string
  email: string
  role: "member" | "admin"
  idempotencyKey: string
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
}

export type ProjectInvitationAcceptInput = { token: string }

export type ProjectInvitationAcceptResult = {
  invitationId: string
  projectId: number
  projectSlug: string
  projectName: string
  organizationId: number
  role: "member" | "admin"
  status: "accepted"
  acceptedAt: string
}

export type ProjectInvitationListInput = { projectSlug: string }
export type ProjectInvitationListItem = {
  invitationId: string
  email: string
  role: "member" | "admin"
  status: "pending" | "accepted" | "expired" | "revoked"
  expiresAt: string
  createdAt: string
}

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
const TOKEN_PATTERN = /^[A-Za-z0-9_-]{32,256}$/

function record(value: unknown): Record<string, unknown> | null {
  return value && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : null
}

export function validateProjectInvitationCreateInput(input: unknown): EdgeCommandResult<ProjectInvitationCreateInput> {
  const value = record(input)
  if (!value) return edgeCommandFailure("invalid_payload", "Request body must be a JSON object.")
  const projectSlug = typeof value.projectSlug === "string" ? value.projectSlug.trim() : ""
  const email = typeof value.email === "string" ? value.email.trim().toLowerCase() : ""
  const role = value.role === "admin" ? "admin" : value.role === "member" ? "member" : null
  const idempotencyKey = typeof value.idempotencyKey === "string" ? value.idempotencyKey.trim() : ""
  if (!projectSlug) return edgeCommandFailure("invalid_payload", "projectSlug is required.")
  if (!EMAIL_PATTERN.test(email) || email.length > 320) return edgeCommandFailure("invalid_payload", "A valid email is required.")
  if (!role) return edgeCommandFailure("invalid_payload", "role must be member or admin.")
  if (idempotencyKey.length < 8 || idempotencyKey.length > 128) {
    return edgeCommandFailure("invalid_payload", "idempotencyKey must be 8-128 characters.")
  }
  return edgeCommandSuccess({ projectSlug, email, role, idempotencyKey })
}

export function validateProjectInvitationAcceptInput(input: unknown): EdgeCommandResult<ProjectInvitationAcceptInput> {
  const value = record(input)
  const token = value && typeof value.token === "string" ? value.token.trim() : ""
  return TOKEN_PATTERN.test(token)
    ? edgeCommandSuccess({ token })
    : edgeCommandFailure("invalid_payload", "A valid invitation token is required.")
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
    typeof value.expiresAt !== "string" || typeof value.token !== "string") {
    return edgeCommandFailure("invalid_edge_response", "Invitation creation returned an invalid response.")
  }
  return edgeCommandSuccess(value as ProjectInvitationCreateResult)
}

export function normalizeProjectInvitationAcceptResult(result: EdgeCommandResult<unknown>): EdgeCommandResult<ProjectInvitationAcceptResult> {
  if (!result.ok) return result
  const value = record(result.data)
  if (!value || typeof value.invitationId !== "string" || typeof value.projectId !== "number" ||
    typeof value.projectSlug !== "string" || typeof value.projectName !== "string" || typeof value.organizationId !== "number" ||
    (value.role !== "member" && value.role !== "admin") || value.status !== "accepted" || typeof value.acceptedAt !== "string") {
    return edgeCommandFailure("invalid_edge_response", "Invitation acceptance returned an invalid response.")
  }
  return edgeCommandSuccess(value as ProjectInvitationAcceptResult)
}

export function normalizeProjectInvitationListResult(result: EdgeCommandResult<unknown>): EdgeCommandResult<ProjectInvitationListItem[]> {
  if (!result.ok) return result
  if (!Array.isArray(result.data)) return edgeCommandFailure("invalid_edge_response", "Invitation list returned an invalid response.")
  const valid = result.data.every((item) => {
    const value = record(item)
    return value && typeof value.invitationId === "string" && typeof value.email === "string" &&
      (value.role === "member" || value.role === "admin") && ["pending", "accepted", "expired", "revoked"].includes(String(value.status)) &&
      typeof value.expiresAt === "string" && typeof value.createdAt === "string" && !("token" in value) && !("tokenDigest" in value)
  })
  return valid ? edgeCommandSuccess(result.data as ProjectInvitationListItem[]) : edgeCommandFailure("invalid_edge_response", "Invitation list returned unsafe or invalid rows.")
}

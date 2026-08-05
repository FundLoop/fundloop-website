import { edgeCommandFailure, edgeCommandSuccess, type EdgeCommandResult } from "./result.ts"

export const PROJECT_INVITATION_CREATE_FUNCTION = "project-invitation-create"
export const PROJECT_INVITATION_ACCEPT_FUNCTION = "project-invitation-accept"

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

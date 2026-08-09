import type { SupabaseClient } from "@supabase/supabase-js"
import type { Database } from "../../types/supabase.ts"
import type {
  ProjectInvitationAcceptInput, ProjectInvitationAcceptResult, ProjectInvitationCreateInput,
  ProjectInvitationCreateResult, ProjectInvitationDeclineResult, ProjectInvitationInspectResult,
  ProjectInvitationListItem, ProjectInvitationRevokeResult,
  ProjectInvitationProfileField,
} from "../edge-functions/project-invitation-contract.ts"
import { privacyReviewDocument } from "../policies/review-policy.ts"

type Failure = { ok: false; error: { code: string; message: string } }
type Success<T> = { ok: true; data: T }
type ProjectAccess = { id: number; organization_id: number | null }

function failure(code: string, message: string): Failure { return { ok: false, error: { code, message } } }

function storedProfileFields(value: unknown) {
  return value as ProjectInvitationProfileField[]
}

async function sha256(value: string) {
  const bytes = new TextEncoder().encode(value)
  const digest = await crypto.subtle.digest("SHA-256", bytes)
  return Array.from(new Uint8Array(digest)).map((byte) => byte.toString(16).padStart(2, "0")).join("")
}

function token() {
  const bytes = crypto.getRandomValues(new Uint8Array(32))
  return btoa(String.fromCharCode(...bytes)).replaceAll("+", "-").replaceAll("/", "_").replaceAll("=", "")
}

async function assertInvitationAdminAccess(
  supabase: SupabaseClient<Database>,
  project: ProjectAccess,
  actorUserId: string,
): Promise<{ ok: true } | Failure> {
  const { data: participant, error: participantError } = await supabase.from("participants").select("id")
    .eq("project_id", project.id).eq("user_id", actorUserId).eq("is_admin", true).maybeSingle()
  if (participantError) return failure("reference_data_unavailable", participantError.message)
  if (participant) return { ok: true }

  const { data: roles, error: rolesError } = await supabase.from("ref_roles").select("id").in("name", ["Founder", "Admin"])
  if (rolesError) return failure("reference_data_unavailable", rolesError.message)
  const roleIds = (roles ?? []).map((role) => role.id)

  if (project.organization_id && roleIds.length > 0) {
    const { data: membership, error: membershipError } = await supabase.from("organization_members").select("id")
      .eq("organization_id", project.organization_id).eq("user_id", actorUserId).eq("status", "active")
      .in("role_id", roleIds).maybeSingle()
    if (membershipError) return failure("reference_data_unavailable", membershipError.message)
    if (membership) return { ok: true }
  }

  return failure("permission_denied", "Only project administrators can manage invitations.")
}

async function expirePendingInvitations(
  supabase: SupabaseClient<Database>,
  projectId: number,
  inviteeEmail?: string,
) {
  const { error } = await supabase.rpc("expire_project_invitations_review", {
    p_project_id: projectId,
    p_invitee_email: inviteeEmail ?? undefined,
  })
  return { error }
}

function invitationUniqueConstraint(error: { message?: string; details?: string; hint?: string } | null) {
  const text = [error?.message, error?.details, error?.hint].filter(Boolean).join(" ")
  if (text.includes("project_invitations_creator_idempotency_unique")) return "idempotency"
  if (text.includes("project_invitations_one_pending_email")) return "pending_email"
  if (text.includes("project_invitations_token_digest_key")) return "token_digest"
  return null
}

export async function executeProjectInvitationCreate(
  supabase: SupabaseClient<Database>,
  input: ProjectInvitationCreateInput & { actorUserId: string },
): Promise<Success<ProjectInvitationCreateResult> | Failure> {
  const { data: project, error: projectError } = await supabase.from("projects")
    .select("id, slug, name, organization_id").eq("slug", input.projectSlug).maybeSingle()
  if (projectError || !project?.organization_id) return failure("project_not_found", projectError?.message ?? "Project not found.")

  const access = await assertInvitationAdminAccess(supabase, project, input.actorUserId)
  if (!access.ok) return access

  const { error: expirationError } = await expirePendingInvitations(supabase, project.id, input.email)
  if (expirationError) return failure("invitation_create_failed", "Expired invitations could not be refreshed.")

  const { data: existing } = await supabase.from("project_invitations").select("id, expires_at")
    .eq("created_by_user_id", input.actorUserId).eq("idempotency_key", input.idempotencyKey).maybeSingle()
  if (existing) return failure("idempotency_replay_requires_original_token", "This invitation request was already recorded. Use a new request key to generate another link.")

  const rawToken = token()
  const tokenDigest = await sha256(rawToken)
  const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString()
  const { data: document, error: documentError } = await supabase.from("legal_document_versions")
    .select("id, document_identifier, content_hash, locale, status")
    .eq("document_identifier", privacyReviewDocument.documentId)
    .eq("content_hash", privacyReviewDocument.contentHash).eq("locale", privacyReviewDocument.locale)
    .eq("status", "review").maybeSingle()
  if (documentError || !document) return failure("review_document_unavailable", "The current sharing disclosure is unavailable.")
  const { data: invitation, error } = await supabase.from("project_invitations").insert({
    project_id: project.id,
    organization_id: project.organization_id,
    invitee_email: input.email,
    invited_role: input.role,
    token_digest: tokenDigest,
    idempotency_key: input.idempotencyKey,
    created_by_user_id: input.actorUserId,
    expires_at: expiresAt,
    shared_profile_fields: input.sharedProfileFields,
    policy_document_version_id: document.id,
    policy_document_identifier: document.document_identifier,
    policy_content_hash: document.content_hash,
    policy_locale: document.locale,
    policy_status: document.status,
  }).select("id, expires_at").single()
  if (error || !invitation) {
    const constraint = error?.code === "23505" ? invitationUniqueConstraint(error) : null
    if (constraint === "idempotency") {
      return failure("idempotency_replay_requires_original_token", "This invitation request was already recorded. Use a new request key to generate another link.")
    }
    if (constraint === "pending_email") {
      return failure("invitation_already_pending", "A pending invitation already exists for this email and project.")
    }
    return failure("invitation_create_failed", "Invitation could not be created.")
  }
  return { ok: true, data: { invitationId: invitation.id, projectId: project.id, projectSlug: project.slug ?? input.projectSlug,
    projectName: project.name, email: input.email, role: input.role, status: "pending", expiresAt: invitation.expires_at, token: rawToken,
    sharedProfileFields: input.sharedProfileFields, policyStatus: "review", policyDocumentId: document.document_identifier } }
}

function invitationRpcFailure(error: { message: string }, fallback: string): Failure {
  const known: Record<string, string> = {
    invitation_not_found: "This invitation link is invalid.", invitation_not_pending: "This invitation is no longer pending.",
    invitation_expired: "This invitation has expired. Ask a project administrator for a new link.",
    invitation_email_mismatch: "Sign in with the email address that was invited.",
    current_invitation_disclosure_required: "The invitation sharing disclosure changed. Review it again before accepting.",
    invitation_admin_required: "Only project administrators can revoke invitations.",
    invitation_not_revocable: "This invitation can no longer be revoked.",
  }
  const code = Object.keys(known).find((candidate) => error.message.includes(candidate)) ?? fallback
  return failure(code, known[code] ?? "This invitation request could not be completed.")
}

export async function executeProjectInvitationInspect(
  supabase: SupabaseClient<Database>, input: { token: string; actorUserId: string; actorEmail: string },
): Promise<Success<ProjectInvitationInspectResult> | Failure> {
  const { data, error } = await supabase.rpc("inspect_project_invitation_review", {
    p_token_digest: await sha256(input.token), p_actor_user_id: input.actorUserId, p_actor_email: input.actorEmail,
  })
  if (error) return invitationRpcFailure(error, "invitation_inspect_failed")
  const row = Array.isArray(data) ? data[0] : null
  if (!row) return failure("invitation_inspect_failed", "Invitation inspection returned no result.")
  return { ok: true, data: {
    invitationId: row.invitation_id, projectId: row.project_id, projectSlug: row.project_slug, projectName: row.project_name,
    role: row.invited_role === "admin" ? "admin" : "member", status: row.status as ProjectInvitationInspectResult["status"],
    expiresAt: row.expires_at, sharedProfileFields: storedProfileFields(row.shared_profile_fields),
    policyDocumentId: row.policy_document_identifier, policyContentHash: row.policy_content_hash,
    policyLocale: row.policy_locale, policyStatus: "review",
  } }
}

export async function executeProjectInvitationAccept(
  supabase: SupabaseClient<Database>, input: ProjectInvitationAcceptInput & { actorUserId: string; actorEmail: string; reviewRuntimeEnabled: boolean },
): Promise<Success<ProjectInvitationAcceptResult> | Failure> {
  if (!input.reviewRuntimeEnabled) return failure("review_preview_disabled", "Invitation acceptance is unavailable in this environment.")
  const digest = await sha256(input.token)
  const { data, error } = await supabase.rpc("accept_project_invitation_review", {
    p_token_digest: digest, p_actor_user_id: input.actorUserId, p_actor_email: input.actorEmail,
    p_document_identifier: input.policyDocumentId, p_content_hash: input.policyContentHash,
    p_locale: input.policyLocale, p_shared_profile_fields: input.sharedProfileFields,
  })
  if (error) return invitationRpcFailure(error, "invitation_accept_failed")
  const row = Array.isArray(data) ? data[0] : null
  if (!row) return failure("invitation_accept_failed", "Invitation acceptance returned no result.")
  return { ok: true, data: { invitationId: row.invitation_id, projectId: row.project_id, projectSlug: row.project_slug,
    projectName: row.project_name, organizationId: row.organization_id, role: row.invited_role === "admin" ? "admin" : "member", status: "accepted",
    acceptedAt: row.accepted_at, evidenceId: row.evidence_id, policyStatus: "review", sharedProfileFields: storedProfileFields(row.shared_profile_fields) } }
}

export async function executeProjectInvitationDecline(
  supabase: SupabaseClient<Database>, input: { token: string; actorUserId: string; actorEmail: string; reviewRuntimeEnabled: boolean },
): Promise<Success<ProjectInvitationDeclineResult> | Failure> {
  if (!input.reviewRuntimeEnabled) return failure("review_preview_disabled", "Invitation responses are unavailable in this environment.")
  const { data, error } = await supabase.rpc("decline_project_invitation_review", {
    p_token_digest: await sha256(input.token), p_actor_user_id: input.actorUserId, p_actor_email: input.actorEmail,
  })
  if (error) return invitationRpcFailure(error, "invitation_decline_failed")
  const row = Array.isArray(data) ? data[0] : null
  return row ? { ok: true, data: { invitationId: row.invitation_id, status: "declined", recordedAt: row.recorded_at } }
    : failure("invitation_decline_failed", "Invitation decline returned no result.")
}

export async function executeProjectInvitationRevoke(
  supabase: SupabaseClient<Database>, input: { invitationId: string; actorUserId: string; reviewRuntimeEnabled: boolean },
): Promise<Success<ProjectInvitationRevokeResult> | Failure> {
  if (!input.reviewRuntimeEnabled) return failure("review_preview_disabled", "Invitation revocation is unavailable in this environment.")
  const { data, error } = await supabase.rpc("revoke_project_invitation_review", {
    p_invitation_id: input.invitationId, p_actor_user_id: input.actorUserId,
  })
  if (error) return invitationRpcFailure(error, "invitation_revoke_failed")
  const row = Array.isArray(data) ? data[0] : null
  return row ? { ok: true, data: { invitationId: row.invitation_id, status: "revoked", recordedAt: row.recorded_at } }
    : failure("invitation_revoke_failed", "Invitation revocation returned no result.")
}

export async function executeProjectInvitationList(
  supabase: SupabaseClient<Database>, input: { projectSlug: string; actorUserId: string },
): Promise<Success<ProjectInvitationListItem[]> | Failure> {
  const { data: project, error: projectError } = await supabase.from("projects").select("id, organization_id").eq("slug", input.projectSlug).maybeSingle()
  if (projectError || !project) return failure("project_not_found", projectError?.message ?? "Project not found.")
  const access = await assertInvitationAdminAccess(supabase, project, input.actorUserId)
  if (!access.ok) return access
  const { error: expirationError } = await expirePendingInvitations(supabase, project.id)
  if (expirationError) return failure("invitation_list_failed", "Expired invitations could not be refreshed.")
  const { data, error } = await supabase.from("project_invitations")
    .select("id, invitee_email, invited_role, status, expires_at, created_at, shared_profile_fields, policy_status, policy_document_identifier")
    .eq("project_id", project.id).order("created_at", { ascending: false })
  if (error) return failure("invitation_list_failed", error.message)
  return { ok: true, data: (data ?? []).map((row) => ({ invitationId: row.id, email: row.invitee_email,
    role: row.invited_role === "admin" ? "admin" : "member", status: row.status as ProjectInvitationListItem["status"],
    expiresAt: row.expires_at, createdAt: row.created_at, sharedProfileFields: storedProfileFields(row.shared_profile_fields),
    policyStatus: "review", policyDocumentId: row.policy_document_identifier })) }
}

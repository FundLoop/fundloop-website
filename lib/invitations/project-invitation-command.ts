import type { SupabaseClient } from "@supabase/supabase-js"
import type { Database } from "../../types/supabase.ts"
import type { ProjectInvitationCreateInput, ProjectInvitationCreateResult, ProjectInvitationAcceptResult } from "../edge-functions/project-invitation-contract.ts"
import type { ProjectInvitationListItem } from "../edge-functions/project-invitation-contract.ts"

type Failure = { ok: false; error: { code: string; message: string } }
type Success<T> = { ok: true; data: T }
type ProjectAccess = { id: number; organization_id: number | null }

function failure(code: string, message: string): Failure { return { ok: false, error: { code, message } } }

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
  let expiration = supabase.from("project_invitations").update({ status: "expired" })
    .eq("project_id", projectId).eq("status", "pending").lte("expires_at", new Date().toISOString())
  if (inviteeEmail) expiration = expiration.eq("invitee_email", inviteeEmail)
  return expiration
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
  const { data: invitation, error } = await supabase.from("project_invitations").insert({
    project_id: project.id,
    organization_id: project.organization_id,
    invitee_email: input.email,
    invited_role: input.role,
    token_digest: tokenDigest,
    idempotency_key: input.idempotencyKey,
    created_by_user_id: input.actorUserId,
    expires_at: expiresAt,
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
    projectName: project.name, email: input.email, role: input.role, status: "pending", expiresAt: invitation.expires_at, token: rawToken } }
}

export async function executeProjectInvitationAccept(
  supabase: SupabaseClient<Database>, input: { token: string; actorUserId: string; actorEmail: string },
): Promise<Success<ProjectInvitationAcceptResult> | Failure> {
  const digest = await sha256(input.token)
  const { data, error } = await supabase.rpc("accept_project_invitation", {
    p_token_digest: digest, p_actor_user_id: input.actorUserId, p_actor_email: input.actorEmail,
  })
  if (error) {
    const codes: Record<string, string> = { invitation_not_found: "invitation_not_found", invitation_not_pending: "invitation_not_pending",
      invitation_expired: "invitation_expired", invitation_email_mismatch: "invitation_email_mismatch" }
    const code = Object.entries(codes).find(([message]) => error.message.includes(message))?.[1] ?? "invitation_accept_failed"
    const messages: Record<string, string> = {
      invitation_email_mismatch: "Sign in with the email address that was invited.",
      invitation_not_found: "This invitation link is invalid.",
      invitation_expired: "This invitation has expired. Ask a project administrator for a new link.",
      invitation_not_pending: "This invitation is no longer pending and cannot be accepted.",
    }
    return failure(code, messages[code] ?? "This invitation cannot be accepted.")
  }
  const row = Array.isArray(data) ? data[0] : null
  if (!row) return failure("invitation_accept_failed", "Invitation acceptance returned no result.")
  return { ok: true, data: { invitationId: row.invitation_id, projectId: row.project_id, projectSlug: row.project_slug,
    projectName: row.project_name, organizationId: row.organization_id, role: row.invited_role === "admin" ? "admin" : "member", status: "accepted", acceptedAt: row.accepted_at } }
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
    .select("id, invitee_email, invited_role, status, expires_at, created_at")
    .eq("project_id", project.id).order("created_at", { ascending: false })
  if (error) return failure("invitation_list_failed", error.message)
  return { ok: true, data: (data ?? []).map((row) => ({ invitationId: row.id, email: row.invitee_email,
    role: row.invited_role === "admin" ? "admin" : "member", status: row.status as ProjectInvitationListItem["status"],
    expiresAt: row.expires_at, createdAt: row.created_at })) }
}

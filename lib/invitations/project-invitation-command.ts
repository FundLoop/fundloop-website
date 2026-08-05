import type { SupabaseClient } from "@supabase/supabase-js"
import type { Database } from "../../types/supabase.ts"
import type { ProjectInvitationCreateInput, ProjectInvitationCreateResult, ProjectInvitationAcceptResult } from "../edge-functions/project-invitation-contract.ts"
import type { ProjectInvitationListItem } from "../edge-functions/project-invitation-contract.ts"

type Failure = { ok: false; error: { code: string; message: string } }
type Success<T> = { ok: true; data: T }

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

export async function executeProjectInvitationCreate(
  supabase: SupabaseClient<Database>,
  input: ProjectInvitationCreateInput & { actorUserId: string },
): Promise<Success<ProjectInvitationCreateResult> | Failure> {
  const { data: project, error: projectError } = await supabase.from("projects")
    .select("id, slug, name, organization_id").eq("slug", input.projectSlug).maybeSingle()
  if (projectError || !project?.organization_id) return failure("project_not_found", projectError?.message ?? "Project not found.")

  const { data: participant, error: accessError } = await supabase.from("participants").select("id")
    .eq("project_id", project.id).eq("user_id", input.actorUserId).eq("is_admin", true).maybeSingle()
  if (accessError) return failure("reference_data_unavailable", accessError.message)
  if (!participant) return failure("permission_denied", "Only project administrators can create invitations.")

  const { data: existing } = await supabase.from("project_invitations").select("id, expires_at, token_digest")
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
    const duplicate = error?.code === "23505"
    return failure(duplicate ? "invitation_already_pending" : "invitation_create_failed", duplicate ? "A pending invitation already exists for this email and project." : error?.message ?? "Invitation could not be created.")
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
    return failure(code, code === "invitation_email_mismatch" ? "Sign in with the email address that was invited." : "This invitation cannot be accepted.")
  }
  const row = Array.isArray(data) ? data[0] : null
  if (!row) return failure("invitation_accept_failed", "Invitation acceptance returned no result.")
  return { ok: true, data: { invitationId: row.invitation_id, projectId: row.project_id, projectSlug: row.project_slug,
    projectName: row.project_name, organizationId: row.organization_id, role: row.invited_role === "admin" ? "admin" : "member", status: "accepted", acceptedAt: row.accepted_at } }
}

export async function executeProjectInvitationList(
  supabase: SupabaseClient<Database>, input: { projectSlug: string; actorUserId: string },
): Promise<Success<ProjectInvitationListItem[]> | Failure> {
  const { data: project, error: projectError } = await supabase.from("projects").select("id").eq("slug", input.projectSlug).maybeSingle()
  if (projectError || !project) return failure("project_not_found", projectError?.message ?? "Project not found.")
  const { data: participant, error: accessError } = await supabase.from("participants").select("id")
    .eq("project_id", project.id).eq("user_id", input.actorUserId).eq("is_admin", true).maybeSingle()
  if (accessError) return failure("reference_data_unavailable", accessError.message)
  if (!participant) return failure("permission_denied", "Only project administrators can view invitations.")
  const { data, error } = await supabase.from("project_invitations")
    .select("id, invitee_email, invited_role, status, expires_at, created_at")
    .eq("project_id", project.id).order("created_at", { ascending: false })
  if (error) return failure("invitation_list_failed", error.message)
  return { ok: true, data: (data ?? []).map((row) => ({ invitationId: row.id, email: row.invitee_email,
    role: row.invited_role === "admin" ? "admin" : "member", status: row.status as ProjectInvitationListItem["status"],
    expiresAt: row.expires_at, createdAt: row.created_at })) }
}

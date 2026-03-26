import "server-only"

import { cache } from "react"
import { createServerSupabaseClient } from "@/lib/supabase-server"
import { getAdminSupabaseClient } from "@/lib/supabase-admin"
import { ZKAS_ACCESS_ROLE_NAME } from "@/lib/zkas/constants"

type AuthenticatedActor = {
  userId: string
  email: string | null
}

type ProjectMembership = {
  participantId: number
  projectId: number
  projectSlug: string | null
  isProjectAdmin: boolean
  hasZkasAccess: boolean
}

function parseEmailAllowlist() {
  return new Set(
    (process.env.FUNDLOOP_INTERNAL_ADMIN_EMAILS ?? "")
      .split(",")
      .map((value) => value.trim().toLowerCase())
      .filter(Boolean),
  )
}

function parseSuperadminAllowlist() {
  return new Set(
    (process.env.FUNDLOOP_ZKAS_SUPERADMIN_EMAILS ?? "")
      .split(",")
      .map((value) => value.trim().toLowerCase())
      .filter(Boolean),
  )
}

export const getCachedZkasRoleId = cache(async () => {
  const supabase = getAdminSupabaseClient()
  const { data, error } = await supabase.from("ref_roles").select("id").eq("name", ZKAS_ACCESS_ROLE_NAME).single()

  if (error || !data) {
    throw new Error(error?.message ?? "zkAS role is not configured")
  }

  return data.id
})

export async function getAuthenticatedActor(): Promise<AuthenticatedActor> {
  const supabase = await createServerSupabaseClient()
  const {
    data: { user },
    error,
  } = await supabase.auth.getUser()

  if (error || !user) {
    throw new Error("User not authenticated")
  }

  return {
    userId: user.id,
    email: user.email ?? null,
  }
}

export function isInternalAdminEmail(email: string | null) {
  if (!email) {
    return false
  }

  return parseEmailAllowlist().has(email.toLowerCase())
}

export function isZkasSuperadminEmail(email: string | null) {
  if (!email) {
    return false
  }

  return parseSuperadminAllowlist().has(email.toLowerCase())
}

export async function requireInternalZkasOperator() {
  const actor = await getAuthenticatedActor()
  if (!isInternalAdminEmail(actor.email)) {
    throw new Error("You do not have internal zkAS operator access.")
  }

  return actor
}

export async function requireZkasSuperadmin() {
  const actor = await getAuthenticatedActor()
  if (!isZkasSuperadminEmail(actor.email)) {
    throw new Error("You do not have zkAS superadmin access.")
  }

  return actor
}

export const requireInternalAdminActor = requireInternalZkasOperator

export async function getProjectMembershipForActor(projectSlug: string, userId: string): Promise<ProjectMembership | null> {
  const supabase = getAdminSupabaseClient()
  const zkasRoleId = await getCachedZkasRoleId()
  const { data: project, error: projectError } = await supabase
    .from("projects")
    .select("id, slug")
    .eq("slug", projectSlug)
    .single()

  if (projectError || !project) {
    return null
  }

  const { data: participant, error: participantError } = await supabase
    .from("participants")
    .select("id, project_id, is_admin")
    .eq("project_id", project.id)
    .eq("user_id", userId)
    .maybeSingle()

  if (participantError || !participant) {
    return null
  }

  const { data: roleRow } = await supabase
    .from("participant_roles")
    .select("participant_id")
    .eq("participant_id", participant.id)
    .eq("role_id", zkasRoleId)
    .maybeSingle()

  return {
    participantId: participant.id,
    projectId: participant.project_id,
    projectSlug: project.slug,
    isProjectAdmin: Boolean(participant.is_admin),
    hasZkasAccess: Boolean(roleRow),
  }
}

export async function requireProjectAdmin(projectSlug: string) {
  const actor = await getAuthenticatedActor()
  const membership = await getProjectMembershipForActor(projectSlug, actor.userId)

  if (!membership?.isProjectAdmin) {
    throw new Error("You do not have project admin access.")
  }

  return {
    actor,
    membership,
  }
}

export async function requireProjectZkasManager(projectSlug: string) {
  const { actor, membership } = await requireProjectAdmin(projectSlug)

  if (!membership.hasZkasAccess && !isInternalAdminEmail(actor.email)) {
    throw new Error("You do not have zkAS access for this project.")
  }

  return {
    actor,
    membership,
  }
}

export const requireProjectZkasAccess = requireProjectZkasManager

export async function getProjectAdmins(projectSlug: string) {
  const supabase = getAdminSupabaseClient()
  const zkasRoleId = await getCachedZkasRoleId()
  const { data: project, error: projectError } = await supabase
    .from("projects")
    .select("id, slug, name")
    .eq("slug", projectSlug)
    .single()

  if (projectError || !project) {
    throw new Error(projectError?.message ?? "Project not found")
  }

  const { data: admins, error } = await supabase
    .from("participants")
    .select("id, user_id, is_admin")
    .eq("project_id", project.id)
    .eq("is_admin", true)

  if (error) {
    throw new Error(error.message)
  }

  const userIds = admins?.map((participant) => participant.user_id) ?? []
  const participantIds = admins?.map((participant) => participant.id) ?? []

  const [{ data: users }, { data: participantRoles }] = await Promise.all([
    userIds.length > 0
      ? supabase.from("users").select("user_id, full_name, email").in("user_id", userIds)
      : Promise.resolve({ data: [], error: null }),
    participantIds.length > 0
      ? supabase.from("participant_roles").select("participant_id").in("participant_id", participantIds).eq("role_id", zkasRoleId)
      : Promise.resolve({ data: [], error: null }),
  ])

  const allowedParticipants = new Set((participantRoles ?? []).map((entry) => entry.participant_id))
  const userById = new Map((users ?? []).map((user) => [user.user_id, user]))

  return {
    project,
    admins:
      admins?.map((participant) => {
        const user = userById.get(participant.user_id)
        return {
          participantId: participant.id,
          userId: participant.user_id,
          name: user?.full_name ?? user?.email ?? participant.user_id,
          email: user?.email ?? null,
          hasZkasAccess: allowedParticipants.has(participant.id),
        }
      }) ?? [],
  }
}

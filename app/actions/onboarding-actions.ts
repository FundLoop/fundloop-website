"use server"

import { revalidatePath } from "next/cache"
import { createServerSupabaseClient } from "@/lib/supabase-server"
import { invokeProjectOnboardingDraftClearServer } from "@/lib/edge-functions/project-onboarding-draft-clear-server"
import { invokeProjectOnboardingPublishServer } from "@/lib/edge-functions/project-onboarding-publish-server"
import type { ProjectOnboardingDraftUpsertInput } from "@/lib/edge-functions/project-onboarding-draft-upsert-contract"
import { invokeProjectOnboardingDraftUpsertServer } from "@/lib/edge-functions/project-onboarding-draft-upsert-server"
import { invokeUserOnboardingDraftClearServer } from "@/lib/edge-functions/user-onboarding-draft-clear-server"
import { invokeUserOnboardingPublishServer } from "@/lib/edge-functions/user-onboarding-publish-server"
import { invokeUserOnboardingDraftUpsertServer } from "@/lib/edge-functions/user-onboarding-draft-upsert-server"
import type { UserOnboardingDraftUpsertInput } from "@/lib/edge-functions/user-onboarding-draft-upsert-contract"
import {
  type TeamMemberContact,
  type TeamMemberProjectMatch,
} from "@/lib/onboarding"
import type { Tables } from "@/types/supabase"

type OnboardingResult<T = undefined> =
  | { ok: true; data: T }
  | { ok: false; error: string }

type OnboardingState = {
  authUserId: string | null
  authEmail: string | null
  profile:
    | (Pick<Tables<"users">, "user_id" | "status" | "full_name" | "display_name" | "avatar_url"> & {
        profile_headline?: string | null
      })
    | null
  userDraft: Tables<"user_onboarding_drafts"> | null
  projectDraft: Tables<"project_onboarding_drafts"> | null
}

async function getAuthenticatedContext() {
  const supabase = await createServerSupabaseClient()
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser()

  if (authError || !user) {
    return {
      ok: false as const,
      error: "User not authenticated",
      supabase,
    }
  }

  return {
    ok: true as const,
    supabase,
    user,
  }
}

export async function getOnboardingState(): Promise<OnboardingState> {
  const context = await getAuthenticatedContext()

  if (!context.ok) {
    return {
      authUserId: null,
      authEmail: null,
      profile: null,
      userDraft: null,
      projectDraft: null,
    }
  }

  const { supabase, user } = context

  const [{ data: profile }, { data: userDraft }, { data: projectDraft }] = await Promise.all([
    supabase
      .from("users")
      .select("user_id, status, full_name, display_name, avatar_url")
      .eq("user_id", user.id)
      .single(),
    supabase.from("user_onboarding_drafts").select("*").eq("user_id", user.id).maybeSingle(),
    supabase.from("project_onboarding_drafts").select("*").eq("user_id", user.id).maybeSingle(),
  ])

  return {
    authUserId: user.id,
    authEmail: user.email ?? null,
    profile,
    userDraft,
    projectDraft,
  }
}

export async function upsertUserOnboardingDraft(
  input: UserOnboardingDraftUpsertInput,
): Promise<OnboardingResult<Tables<"user_onboarding_drafts">>> {
  const result = await invokeUserOnboardingDraftUpsertServer(input)
  if (!result.ok) {
    return { ok: false, error: result.error.message }
  }

  return { ok: true, data: result.data }
}

export async function clearUserOnboardingDraft(): Promise<OnboardingResult> {
  const result = await invokeUserOnboardingDraftClearServer()
  if (!result.ok) {
    return { ok: false, error: result.error.message }
  }

  return { ok: true, data: undefined }
}

export async function publishUserOnboardingDraft(): Promise<
  OnboardingResult<{ nextFlow: "project" | null; relationshipChoice: "individual" | "team_member" | "create_project" }>
> {
  const result = await invokeUserOnboardingPublishServer()
  if (!result.ok) {
    return { ok: false, error: result.error.message }
  }

  revalidatePath("/")
  revalidatePath("/workspace")
  revalidatePath("/users")

  return { ok: true, data: result.data }
}

export async function upsertProjectOnboardingDraft(
  input: ProjectOnboardingDraftUpsertInput,
): Promise<OnboardingResult<Tables<"project_onboarding_drafts">>> {
  const result = await invokeProjectOnboardingDraftUpsertServer(input)
  if (!result.ok) {
    return { ok: false, error: result.error.message }
  }

  return { ok: true, data: result.data }
}

export async function clearProjectOnboardingDraft(): Promise<OnboardingResult> {
  const result = await invokeProjectOnboardingDraftClearServer()
  if (!result.ok) {
    return { ok: false, error: result.error.message }
  }

  return { ok: true, data: undefined }
}

export async function publishProjectOnboardingDraft(): Promise<OnboardingResult<{ projectSlug: string | null }>> {
  const result = await invokeProjectOnboardingPublishServer()
  if (!result.ok) {
    return { ok: false, error: result.error.message }
  }

  revalidatePath("/")
  revalidatePath("/founder")
  revalidatePath("/projects")

  return { ok: true, data: result.data }
}

export async function searchProjectsForTeamMember(query: string): Promise<OnboardingResult<TeamMemberProjectMatch[]>> {
  const context = await getAuthenticatedContext()
  if (!context.ok) {
    return { ok: false, error: context.error }
  }

  const { supabase } = context
  const normalized = query.trim()
  if (normalized.length < 2) {
    return { ok: true, data: [] }
  }

  const escaped = normalized.replace(/[%_]/g, "")
  const { data: projects, error } = await supabase
    .from("projects")
    .select("id, name, slug, description, website, email, organization_id")
    .is("deleted_at", null)
    .eq("status", "active")
    .or(`name.ilike.%${escaped}%,slug.ilike.%${escaped}%`)
    .limit(6)

  if (error || !projects) {
    return { ok: false, error: error?.message ?? "Failed to search projects" }
  }

  const organizationIds = Array.from(new Set(projects.map((project) => project.organization_id).filter(Boolean))) as number[]
  const projectIds = projects.map((project) => project.id)

  const [{ data: organizationMembers }, { data: participantRows }, { data: roles }] = await Promise.all([
    organizationIds.length > 0
      ? supabase
          .from("organization_members")
          .select("organization_id, role_id, user_id")
          .in("organization_id", organizationIds)
          .eq("status", "active")
      : Promise.resolve({ data: [] as Tables<"organization_members">[], error: null }),
    projectIds.length > 0
      ? supabase.from("participants").select("project_id, user_id, is_admin").in("project_id", projectIds)
      : Promise.resolve({ data: [] as Tables<"participants">[], error: null }),
    supabase.from("ref_roles").select("id, name"),
  ])

  const relevantUserIds = Array.from(
    new Set([
      ...(organizationMembers ?? []).map((member) => member.user_id).filter((userId): userId is string => Boolean(userId)),
      ...(participantRows ?? []).map((participant) => participant.user_id).filter((userId): userId is string => Boolean(userId)),
    ]),
  )

  const { data: users } =
    relevantUserIds.length > 0
      ? await supabase.from("users").select("user_id, full_name, email").in("user_id", relevantUserIds)
      : { data: [] as Pick<Tables<"users">, "user_id" | "full_name" | "email">[] }

  const roleMap = new Map((roles ?? []).map((role) => [role.id, role.name]))
  const userMap = new Map((users ?? []).map((entry) => [entry.user_id, entry]))
  const orgContacts = new Map<number, TeamMemberContact[]>()
  const participantContacts = new Map<number, TeamMemberContact[]>()

  ;(organizationMembers ?? []).forEach((member) => {
    const roleName = roleMap.get(member.role_id) ?? "Team member"
    if (!["Founder", "Admin"].includes(roleName)) {
      return
    }

    const profile = userMap.get(member.user_id ?? "")
    const list = orgContacts.get(member.organization_id) ?? []
    list.push({
      name: profile?.full_name ?? "Project admin",
      role: roleName,
      email: profile?.email ?? null,
    })
    orgContacts.set(member.organization_id, list)
  })

  ;(participantRows ?? []).forEach((participant) => {
    if (!participant.is_admin) {
      return
    }

    const profile = userMap.get(participant.user_id ?? "")
    const list = participantContacts.get(participant.project_id) ?? []
    list.push({
      name: profile?.full_name ?? "Project admin",
      role: "Project admin",
      email: profile?.email ?? null,
    })
    participantContacts.set(participant.project_id, list)
  })

  const matches = projects.map<TeamMemberProjectMatch>((project) => {
    const contacts = [
      ...(project.organization_id ? orgContacts.get(project.organization_id) ?? [] : []),
      ...(participantContacts.get(project.id) ?? []),
    ]

    return {
      id: project.id,
      name: project.name,
      slug: project.slug,
      description: project.description,
      website: project.website,
      contactEmail: project.email,
      contacts,
      fallbackMessage:
        project.email ?? project.website
          ? "Reach out through the public contact details for this project."
          : "This project does not yet have a visible contact path. FundLoop support can help route you.",
    }
  })

  return { ok: true, data: matches }
}

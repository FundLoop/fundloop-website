"use server"

import { revalidatePath } from "next/cache"
import { createServerSupabaseClient } from "@/lib/supabase-server"
import {
  type ProjectOnboardingPayload,
  type ProjectOnboardingScreen,
  type TeamMemberContact,
  type TeamMemberProjectMatch,
  type UserOnboardingPayload,
  type UserOnboardingScreen,
  mergeProjectOnboardingPayload,
  mergeUserOnboardingPayload,
} from "@/lib/onboarding"
import type { Json, Tables } from "@/types/supabase"

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

type UpsertDraftInput<Screen extends string, Payload> = {
  currentScreen: Screen
  payload: Payload
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

function parseNumber(value: string) {
  const parsed = Number.parseInt(value, 10)
  return Number.isFinite(parsed) ? parsed : null
}

function parseDecimal(value: string) {
  const parsed = Number.parseFloat(value)
  return Number.isFinite(parsed) ? parsed : null
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
  input: UpsertDraftInput<UserOnboardingScreen, UserOnboardingPayload>,
): Promise<OnboardingResult<Tables<"user_onboarding_drafts">>> {
  const context = await getAuthenticatedContext()
  if (!context.ok) {
    return { ok: false, error: context.error }
  }

  const { supabase, user } = context

  const payload = mergeUserOnboardingPayload(input.payload)
  const { data, error } = await supabase
    .from("user_onboarding_drafts")
    .upsert(
      {
        user_id: user.id,
        current_screen: input.currentScreen,
        payload,
        completed_at: null,
      },
      { onConflict: "user_id" },
    )
    .select()
    .single()

  if (error || !data) {
    return { ok: false, error: error?.message ?? "Failed to save user draft" }
  }

  return { ok: true, data }
}

export async function clearUserOnboardingDraft(): Promise<OnboardingResult> {
  const context = await getAuthenticatedContext()
  if (!context.ok) {
    return { ok: false, error: context.error }
  }

  const { supabase, user } = context
  const { error } = await supabase.from("user_onboarding_drafts").delete().eq("user_id", user.id)

  if (error) {
    return { ok: false, error: error.message }
  }

  return { ok: true, data: undefined }
}

export async function publishUserOnboardingDraft(): Promise<
  OnboardingResult<{ nextFlow: "project" | null; relationshipChoice: UserOnboardingPayload["relationshipChoice"] }>
> {
  const context = await getAuthenticatedContext()
  if (!context.ok) {
    return { ok: false, error: context.error }
  }

  const { supabase, user } = context
  const { data: draft, error: draftError } = await supabase
    .from("user_onboarding_drafts")
    .select("*")
    .eq("user_id", user.id)
    .single()

  if (draftError || !draft) {
    return { ok: false, error: draftError?.message ?? "User draft not found" }
  }

  const payload = mergeUserOnboardingPayload(draft.payload as Partial<UserOnboardingPayload>)
  const occupationId = parseNumber(payload.occupationId)
  const locationId = parseNumber(payload.locationId)
  const genderId = parseNumber(payload.genderId)
  const { data: existingProfile } = await supabase
    .from("users")
    .select("invited_by_code")
    .eq("user_id", user.id)
    .single()

  const { error: updateError } = await supabase
    .from("users")
    .update({
      full_name: payload.fullName.trim() || null,
      display_name: payload.displayName.trim() || payload.fullName.trim() || null,
      avatar_url: payload.avatarUrl.trim() || null,
      bio: payload.bio.trim() || null,
      occupation_id: occupationId,
      location_id: locationId,
      gender_id: genderId,
      profile_headline: payload.profileHeadline.trim() || null,
      email: user.email ?? null,
      invited_by_code: payload.inviteCode.trim() || null,
      is_public: payload.visibility.isPublic,
      is_name_public: payload.visibility.isNamePublic,
      is_pfp_public: payload.visibility.isPfpPublic,
      is_gender_public: payload.visibility.isGenderPublic,
      is_occupation_public: payload.visibility.isOccupationPublic,
      is_location_public: payload.visibility.isLocationPublic,
      is_birthyear_public: payload.visibility.isBirthyearPublic,
      is_birthday_public: payload.visibility.isBirthdayPublic,
      status: "active",
    })
    .eq("user_id", user.id)

  if (updateError) {
    return { ok: false, error: updateError.message }
  }

  const { error: clearInterestsError } = await supabase.from("user_interests").delete().eq("user_id", user.id)
  if (clearInterestsError) {
    return { ok: false, error: clearInterestsError.message }
  }

  if (payload.interestIds.length > 0) {
    const interestsPayload = payload.interestIds
      .map((interestId) => parseNumber(interestId))
      .filter((interestId): interestId is number => interestId !== null)
      .map((interest_id) => ({
        user_id: user.id,
        interest_id,
      }))

    if (interestsPayload.length > 0) {
      const { error: interestsError } = await supabase.from("user_interests").insert(interestsPayload)
      if (interestsError) {
        return { ok: false, error: interestsError.message }
      }
    }
  }

  if (payload.inviteCode.trim()) {
    if (!existingProfile?.invited_by_code) {
      const { data: inviteRow } = await supabase
        .from("invitation_codes")
        .select("usage_count")
        .eq("code", payload.inviteCode.trim())
        .single()

      if (inviteRow) {
        await supabase
          .from("invitation_codes")
          .update({ usage_count: inviteRow.usage_count + 1 })
          .eq("code", payload.inviteCode.trim())
      }
    }
  }

  const { error: deleteDraftError } = await supabase.from("user_onboarding_drafts").delete().eq("user_id", user.id)
  if (deleteDraftError) {
    return { ok: false, error: deleteDraftError.message }
  }

  revalidatePath("/")
  revalidatePath("/my-profile")
  revalidatePath("/users")

  return {
    ok: true,
    data: {
      nextFlow: payload.relationshipChoice === "create_project" ? "project" : null,
      relationshipChoice: payload.relationshipChoice,
    },
  }
}

export async function upsertProjectOnboardingDraft(
  input: UpsertDraftInput<ProjectOnboardingScreen, ProjectOnboardingPayload>,
): Promise<OnboardingResult<Tables<"project_onboarding_drafts">>> {
  const context = await getAuthenticatedContext()
  if (!context.ok) {
    return { ok: false, error: context.error }
  }

  const { supabase, user } = context

  const payload = mergeProjectOnboardingPayload(input.payload)
  const { data, error } = await supabase
    .from("project_onboarding_drafts")
    .upsert(
      {
        user_id: user.id,
        current_screen: input.currentScreen,
        payload,
        completed_at: null,
      },
      { onConflict: "user_id" },
    )
    .select()
    .single()

  if (error || !data) {
    return { ok: false, error: error?.message ?? "Failed to save project draft" }
  }

  return { ok: true, data }
}

export async function clearProjectOnboardingDraft(): Promise<OnboardingResult> {
  const context = await getAuthenticatedContext()
  if (!context.ok) {
    return { ok: false, error: context.error }
  }

  const { supabase, user } = context
  const { error } = await supabase.from("project_onboarding_drafts").delete().eq("user_id", user.id)

  if (error) {
    return { ok: false, error: error.message }
  }

  return { ok: true, data: undefined }
}

export async function publishProjectOnboardingDraft(): Promise<OnboardingResult<{ projectSlug: string | null }>> {
  const context = await getAuthenticatedContext()
  if (!context.ok) {
    return { ok: false, error: context.error }
  }

  const { supabase, user } = context
  const { data: draft, error: draftError } = await supabase
    .from("project_onboarding_drafts")
    .select("*")
    .eq("user_id", user.id)
    .single()

  if (draftError || !draft) {
    return { ok: false, error: draftError?.message ?? "Project draft not found" }
  }

  const payload = mergeProjectOnboardingPayload(draft.payload as Partial<ProjectOnboardingPayload>)
  if (!payload.name.trim() || !payload.slug.trim() || !payload.description.trim()) {
    return { ok: false, error: "Project basics are incomplete" }
  }
  if (!payload.pledgeAccepted) {
    return { ok: false, error: "The FundLoop pledge must be accepted before publishing" }
  }
  if ((parseDecimal(payload.paymentPercentage) ?? 0) < 1) {
    return { ok: false, error: "Project payment percentage must be at least 1" }
  }

  const { data: existingProject } = await supabase
    .from("projects")
    .select("id")
    .eq("slug", payload.slug.trim())
    .maybeSingle()

  if (existingProject) {
    return { ok: false, error: "A project with this slug already exists" }
  }

  const categoryIds = payload.categoryIds
    .map((categoryId) => parseNumber(categoryId))
    .filter((categoryId): categoryId is number => categoryId !== null)

  const { data: publishedProject, error: publishError } = await supabase
    .rpc("publish_project_onboarding_draft_atomic", {
      p_name: payload.name.trim(),
      p_slug: payload.slug.trim(),
      p_description: payload.description.trim(),
      p_website: payload.website.trim() || null,
      p_detailed_description: payload.detailedDescription.trim() || null,
      p_logo_url: payload.logoUrl.trim() || null,
      p_contact_email: payload.contactEmail.trim() || null,
      p_billing_email: payload.billingEmail.trim() || null,
      p_billing_frequency: payload.billingFrequency || null,
      p_payment_percentage: parseDecimal(payload.paymentPercentage) ?? 1,
      p_payment_periodicity_id: parseNumber(payload.paymentPeriodicityId),
      p_default_payment_method_id: parseNumber(payload.paymentMethodId),
      p_category_ids: categoryIds,
    } satisfies Record<string, Json>)
    .single()

  if (publishError || !publishedProject) {
    return { ok: false, error: publishError?.message ?? "Failed to publish project draft" }
  }

  revalidatePath("/")
  revalidatePath("/my-profile")
  revalidatePath("/projects")

  return { ok: true, data: { projectSlug: publishedProject.project_slug } }
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

    const profile = userMap.get(participant.user_id)
    const list = participantContacts.get(participant.project_id) ?? []
    list.push({
      name: profile?.full_name ?? "Project admin",
      role: "Project admin",
      email: profile?.email ?? null,
    })
    participantContacts.set(participant.project_id, list)
  })

  const matches = projects.map<TeamMemberProjectMatch>((project) => {
    const contacts =
      (project.organization_id ? orgContacts.get(project.organization_id) : undefined) ??
      participantContacts.get(project.id) ??
      []

    const fallbackMessage = project.email
      ? `Ask the project team for an invite at ${project.email}.`
      : project.website
        ? `Ask the project team for an invite via ${project.website}.`
        : "Ask a project founder or admin for an invitation to the team."

    return {
      id: project.id,
      name: project.name,
      slug: project.slug,
      description: project.description,
      website: project.website,
      contactEmail: project.email,
      contacts,
      fallbackMessage,
    }
  })

  return { ok: true, data: matches }
}

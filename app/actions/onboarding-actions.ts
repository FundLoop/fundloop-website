"use server"

import { revalidatePath } from "next/cache"
import { getCubidPassportOrigin, getCubidWeb2Config } from "@/lib/cubid/config"
import { buildCubidIdentityReadModel } from "@/lib/cubid/read-model"
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
    | (Pick<
        Tables<"users">,
        | "user_id"
        | "status"
        | "full_name"
        | "display_name"
        | "avatar_url"
        | "cubid_identity_status"
        | "cubid_id"
        | "primary_email_identity"
        | "cubid_score"
        | "bio"
        | "occupation_id"
        | "location_id"
      > & {
        profile_headline?: string | null
      })
    | null
  cubidSnapshot: {
    primaryName: string | null
    primaryEmail: string | null
    primaryPhone: string | null
    cubidScore: number | null
    availableStampTypes: string[]
    verifiedStampTypes: string[]
    lastSyncedAt: string | null
    lastSyncErrorCode: string | null
    lastSyncErrorMessage: string | null
  } | null
  profileCompletionPercent: number
  profileCompletionMissingItems: string[]
  cubidPassportOrigin: string | null
  cubidStampPageId: string | null
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
      cubidSnapshot: null,
      profileCompletionPercent: 0,
      profileCompletionMissingItems: [],
      cubidPassportOrigin: null,
      cubidStampPageId: null,
      userDraft: null,
      projectDraft: null,
    }
  }

  const { supabase, user } = context

  const [{ data: profile }, { data: cubidSnapshot }, { count: interestCount }, { data: userDraft }, { data: projectDraft }] =
    await Promise.all([
    supabase
      .from("users")
      .select(
        "user_id, status, full_name, display_name, avatar_url, cubid_identity_status, cubid_id, primary_email_identity, cubid_score, bio, profile_headline, occupation_id, location_id",
      )
      .eq("user_id", user.id)
      .single(),
    supabase.from("cubid_identity_snapshots").select("*").eq("user_id", user.id).maybeSingle(),
    supabase.from("user_interests").select("*", { count: "exact", head: true }).eq("user_id", user.id),
    supabase.from("user_onboarding_drafts").select("*").eq("user_id", user.id).maybeSingle(),
    supabase.from("project_onboarding_drafts").select("*").eq("user_id", user.id).maybeSingle(),
  ])

  const cubidReadModel = buildCubidIdentityReadModel(
    profile
      ? {
          fullName: profile.full_name,
          displayName: profile.display_name,
          profileHeadline: profile.profile_headline,
          bio: profile.bio,
          occupationId: profile.occupation_id,
          locationId: profile.location_id,
          cubidIdentityStatus: profile.cubid_identity_status,
        }
      : null,
    cubidSnapshot ?? null,
    interestCount ?? 0,
  )

  const cubidRuntimeConfig = (() => {
    try {
      const config = getCubidWeb2Config()
      return {
        cubidPassportOrigin: getCubidPassportOrigin(config.baseUrl),
        cubidStampPageId: config.stampPageId,
      }
    } catch {
      return {
        cubidPassportOrigin: null,
        cubidStampPageId: null,
      }
    }
  })()

  return {
    authUserId: user.id,
    authEmail: user.email ?? null,
    profile,
    cubidSnapshot: cubidReadModel.cubidSnapshotSummary,
    profileCompletionPercent: cubidReadModel.profileCompletionPercent,
    profileCompletionMissingItems: cubidReadModel.profileCompletionMissingItems,
    cubidPassportOrigin: cubidRuntimeConfig.cubidPassportOrigin,
    cubidStampPageId: cubidRuntimeConfig.cubidStampPageId,
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

  // Project-level contact details only: a prospective team member is not yet a collaborator,
  // so admin names and personal emails are never returned (enforced by the RPC).
  const { data: projects, error } = await supabase.rpc("search_projects_for_team_member", { p_query: normalized })

  if (error || !projects) {
    return { ok: false, error: error?.message ?? "Failed to search projects" }
  }

  const matches = projects.map<TeamMemberProjectMatch>((project) => ({
    id: project.id,
    name: project.name,
    slug: project.slug,
    description: project.description,
    website: project.website,
    contactEmail: project.email,
    contacts: [],
    fallbackMessage:
      project.email ?? project.website
        ? "Reach out through the public contact details for this project."
        : "This project does not yet have a visible contact path. FundLoop support can help route you.",
  }))

  return { ok: true, data: matches }
}

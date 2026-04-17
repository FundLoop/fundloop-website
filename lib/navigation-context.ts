import "server-only"

import { cache } from "react"
import type { Database } from "@/types/supabase"
import { getCubidPassportOrigin, getCubidWeb2Config } from "@/lib/cubid/config"
import { buildCubidIdentityReadModel, type CubidIdentityOwnership, type ManagedIdentityField } from "@/lib/cubid/read-model"
import { getAdminSupabaseClient } from "@/lib/supabase-admin"
import { createServerSupabaseClient } from "@/lib/supabase-server"
import { isInternalAdminEmail } from "@/lib/zkas/auth"

export type NavigationUser = {
  id: string
  email: string | null
  fullName: string | null
  avatarUrl: string | null
  status: string | null
  cubidIdentityStatus: Database["public"]["Enums"]["cubid_identity_status"]
  cubidId: string | null
  primaryEmailIdentity: string | null
  cubidScore: number | null
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
  managedIdentity: {
    fullName: ManagedIdentityField
    primaryEmail: ManagedIdentityField
    primaryPhone: ManagedIdentityField
  }
  identityOwnership: CubidIdentityOwnership
  localProfile: {
    displayName: string | null
    profileHeadline: string | null
    bio: string | null
    occupationName: string | null
    locationName: string | null
    interestCount: number
    interestNames: string[]
    visibility: {
      isPublic: boolean
      isNamePublic: boolean
      isPfpPublic: boolean
      isGenderPublic: boolean
      isOccupationPublic: boolean
      isLocationPublic: boolean
    }
  }
  profileCompletionPercent: number
  profileCompletionMissingItems: string[]
}

export type ManagedProjectSummary = {
  id: number
  slug: string | null
  name: string
}

export type NavigationContext = {
  user: NavigationUser | null
  isAuthenticated: boolean
  hasWorkspaceAccess: boolean
  hasFounderAccess: boolean
  hasAdminAccess: boolean
  managedProjects: ManagedProjectSummary[]
  cubidPassportOrigin: string | null
  cubidStampPageId: string | null
}

type ProjectRow = {
  id: number
  slug: string | null
  name: string
  organization_id: number | null
}

type RoleRow = {
  id: number
}

type UserProfileRow = {
  full_name: string | null
  display_name: string | null
  avatar_url: string | null
  status: string | null
  bio: string | null
  profile_headline: string | null
  occupation_id: number | null
  location_id: number | null
  is_public: boolean | null
  is_name_public: boolean
  is_pfp_public: boolean
  is_gender_public: boolean
  is_occupation_public: boolean
  is_location_public: boolean
  cubid_identity_status: Database["public"]["Enums"]["cubid_identity_status"]
  cubid_id: string | null
  primary_email_identity: string | null
  cubid_score: number | null
}

function emptyNavigationContext(): NavigationContext {
  return {
    user: null,
    isAuthenticated: false,
    hasWorkspaceAccess: false,
    hasFounderAccess: false,
    hasAdminAccess: false,
    managedProjects: [],
    cubidPassportOrigin: null,
    cubidStampPageId: null,
  }
}

export const getNavigationContext = cache(async (): Promise<NavigationContext> => {
  const supabase = await createServerSupabaseClient()
  const {
    data: { user: authUser },
  } = await supabase.auth.getUser()

  if (!authUser) {
    return emptyNavigationContext()
  }

  const roleAwareSupabase = (() => {
    try {
      return getAdminSupabaseClient()
    } catch {
      // Local and preview environments may omit the service-role key. Fall back
      // to the authenticated SSR client so the shared shell still renders.
      return supabase
    }
  })()

  const [{ data: profile }, { data: cubidSnapshot }, { count: interestCount }, { data: participantRows }, { data: founderRoles }] =
    await Promise.all([
    roleAwareSupabase
      .from("users")
      .select(
        "full_name, display_name, avatar_url, status, bio, profile_headline, occupation_id, location_id, is_public, is_name_public, is_pfp_public, is_gender_public, is_occupation_public, is_location_public, cubid_identity_status, cubid_id, primary_email_identity, cubid_score",
      )
      .eq("user_id", authUser.id)
      .maybeSingle<UserProfileRow>(),
    roleAwareSupabase.from("cubid_identity_snapshots").select("*").eq("user_id", authUser.id).maybeSingle(),
    roleAwareSupabase.from("user_interests").select("*", { count: "exact", head: true }).eq("user_id", authUser.id),
    roleAwareSupabase.from("participants").select("project_id").eq("user_id", authUser.id).eq("is_admin", true),
    roleAwareSupabase.from("ref_roles").select("id").in("name", ["Founder", "Admin"]),
  ])

  const participantProjectIds = Array.from(new Set((participantRows ?? []).map((row) => row.project_id)))
  const founderRoleIds = ((founderRoles as RoleRow[] | null) ?? []).map((role) => role.id)

  const { data: organizationMemberships } =
    founderRoleIds.length > 0
      ? await roleAwareSupabase
          .from("organization_members")
          .select("organization_id")
          .eq("user_id", authUser.id)
          .eq("status", "active")
          .in("role_id", founderRoleIds)
      : { data: [] as { organization_id: number }[] }

  const organizationIds = Array.from(new Set((organizationMemberships ?? []).map((row) => row.organization_id)))

  const [participantProjectsResult, organizationProjectsResult] = await Promise.all([
    participantProjectIds.length > 0
      ? roleAwareSupabase.from("projects").select("id, slug, name, organization_id").in("id", participantProjectIds)
      : Promise.resolve({ data: [] as ProjectRow[] }),
    organizationIds.length > 0
      ? roleAwareSupabase.from("projects").select("id, slug, name, organization_id").in("organization_id", organizationIds)
      : Promise.resolve({ data: [] as ProjectRow[] }),
  ])

  const managedProjectsMap = new Map<number, ManagedProjectSummary>()
  for (const project of [...(participantProjectsResult.data ?? []), ...(organizationProjectsResult.data ?? [])]) {
    managedProjectsMap.set(project.id, {
      id: project.id,
      slug: project.slug,
      name: project.name,
    })
  }

  const managedProjects = Array.from(managedProjectsMap.values()).sort((left, right) => left.name.localeCompare(right.name))

  const interestRowsPromise = roleAwareSupabase.from("user_interests").select("interest_id").eq("user_id", authUser.id)
  const locationRowPromise =
    profile?.location_id !== null && profile?.location_id !== undefined
      ? roleAwareSupabase.from("ref_locations").select("name").eq("id", profile.location_id).maybeSingle<{ name: string }>()
      : Promise.resolve({ data: null as { name: string } | null })
  const occupationRowPromise =
    profile?.occupation_id !== null && profile?.occupation_id !== undefined
      ? roleAwareSupabase.from("ref_occupations").select("name").eq("id", profile.occupation_id).maybeSingle<{ name: string }>()
      : Promise.resolve({ data: null as { name: string } | null })

  const [{ data: interestRows }, { data: locationRow }, { data: occupationRow }] = await Promise.all([
    interestRowsPromise,
    locationRowPromise,
    occupationRowPromise,
  ])

  const interestIds = (interestRows ?? []).map((row) => row.interest_id)
  const { data: interestRefRows } =
    interestIds.length > 0
      ? await roleAwareSupabase.from("ref_interests").select("id, name").in("id", interestIds)
      : { data: [] as { id: number; name: string }[] }
  const interestNameMap = new Map((interestRefRows ?? []).map((row) => [row.id, row.name]))
  const interestNames = interestIds.map((interestId) => interestNameMap.get(interestId)).filter((value): value is string => Boolean(value))

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
    user: {
      id: authUser.id,
      email: authUser.email ?? null,
      fullName: cubidReadModel.managedIdentity.fullName.value,
      avatarUrl: profile?.avatar_url ?? null,
      status: profile?.status ?? null,
      cubidIdentityStatus: profile?.cubid_identity_status ?? "unlinked",
      cubidId: profile?.cubid_id ?? null,
      primaryEmailIdentity: profile?.primary_email_identity ?? null,
      cubidScore: profile?.cubid_score ?? null,
      cubidSnapshot: cubidReadModel.cubidSnapshotSummary,
      managedIdentity: cubidReadModel.managedIdentity,
      identityOwnership: cubidReadModel.identityOwnership,
      localProfile: {
        displayName: profile?.display_name ?? null,
        profileHeadline: profile?.profile_headline ?? null,
        bio: profile?.bio ?? null,
        occupationName: occupationRow?.name ?? null,
        locationName: locationRow?.name ?? null,
        interestCount: interestCount ?? 0,
        interestNames,
        visibility: {
          isPublic: profile?.is_public === true,
          isNamePublic: profile?.is_name_public ?? false,
          isPfpPublic: profile?.is_pfp_public ?? false,
          isGenderPublic: profile?.is_gender_public ?? false,
          isOccupationPublic: profile?.is_occupation_public ?? false,
          isLocationPublic: profile?.is_location_public ?? false,
        },
      },
      profileCompletionPercent: cubidReadModel.profileCompletionPercent,
      profileCompletionMissingItems: cubidReadModel.profileCompletionMissingItems,
    },
    isAuthenticated: true,
    hasWorkspaceAccess: true,
    hasFounderAccess: managedProjects.length > 0,
    hasAdminAccess: isInternalAdminEmail(authUser.email ?? null),
    managedProjects,
    cubidPassportOrigin: cubidRuntimeConfig.cubidPassportOrigin,
    cubidStampPageId: cubidRuntimeConfig.cubidStampPageId,
  }
})

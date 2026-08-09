import "server-only"

import { cache } from "react"
import { createServerSupabaseClient } from "@/lib/supabase-server"
import { canReadInvitationReviewSharing, isReviewPolicyPreviewEnabled } from "@/lib/policies/review-policy"
import { invokeProjectMemberSharedProfilesReadServer } from "@/lib/edge-functions/project-member-shared-profiles-read-server"

export type PublicDiscoveryProject = {
  id: number
  slug: string
  name: string
  description: string
  detailedDescription: string
  isPublic: boolean
  logoUrl: string | null
  website: string | null
  categoryId: number | null
  categoryName: string | null
  createdAt: string | null
  participantCount: number
}

export type PublicProjectCategory = {
  id: number
  name: string
}

export type PublicProjectsDirectoryData = {
  categories: PublicProjectCategory[]
  projects: PublicDiscoveryProject[]
}

export type PublicProjectParticipant = {
  id: string
  name: string
  avatarUrl: string | null
  role: "admin" | "member"
}

export type PublicProjectDetail = {
  project: PublicDiscoveryProject
  participants: PublicProjectParticipant[]
  hasAccess: boolean
  userRole: "admin" | "member" | null
}

export type PublicDiscoveryUser = {
  userId: string
  displayName: string | null
  fullName: string | null
  profileHeadline: string | null
  avatarUrl: string | null
  contributionDetails: string | null
  createdAt: string | null
  location: string | null
  projectCount: number
  projectSlugs: string[]
  cubidIdentityStatus: "unlinked" | "linked" | "verified"
  cubidScore: number | null
}

export type PublicUsersDirectoryData = {
  projects: Array<{ id: number; name: string; slug: string | null }>
  users: PublicDiscoveryUser[]
}

export type PublicUserProject = {
  id: number
  slug: string | null
  name: string
  logoUrl: string | null
}

export type PublicUserProfile = {
  user: PublicDiscoveryUser
  projects: PublicUserProject[]
}

function logPublicDiscoveryError(scope: string, error: unknown) {
  const message = error instanceof Error ? error.message : String(error)
  console.warn(`[public-discovery:${scope}] ${message}`)
}

function normalizeSearchTerm(search: string | undefined) {
  return search?.trim().toLowerCase() ?? ""
}

function projectMatchesSearch(project: PublicDiscoveryProject, search: string) {
  if (!search) {
    return true
  }

  return [project.name, project.description, project.categoryName ?? "", project.detailedDescription]
    .join(" ")
    .toLowerCase()
    .includes(search)
}

function userMatchesSearch(user: PublicDiscoveryUser, search: string) {
  if (!search) {
    return true
  }

  return [user.displayName ?? "", user.fullName ?? "", user.location ?? "", user.contributionDetails ?? ""]
    .join(" ")
    .toLowerCase()
    .includes(search)
}

export async function getPublicProjectsDirectoryData({
  categoryId,
  search,
  sort,
}: {
  categoryId?: number | null
  search?: string
  sort?: "recent" | "oldest" | "name"
}): Promise<PublicProjectsDirectoryData> {
  try {
    const supabase = await createServerSupabaseClient()

    const [{ data: projectRows, error: projectError }, { data: categories, error: categoriesError }] = await Promise.all([
      supabase
        .from("projects")
        .select("id, slug, name, description, detailed_description, logo_url, website, category_id, created_at")
        .eq("status", "active")
        .eq("is_public", true)
        .is("deleted_at", null),
      supabase.from("ref_categories").select("id, name").order("name"),
    ])

    if (projectError) {
      throw new Error(projectError.message)
    }

    if (categoriesError) {
      throw new Error(categoriesError.message)
    }

    const categoryMap = new Map((categories ?? []).map((category) => [category.id, category.name]))
    const projectIds = (projectRows ?? []).map((project) => project.id)

    const { data: participantRows, error: participantError } =
      projectIds.length > 0
        ? await supabase.from("participants").select("project_id, user_id, users(status)").in("project_id", projectIds)
        : { data: [], error: null }

    if (participantError) {
      throw new Error(participantError.message)
    }

    const participantCounts = new Map<number, Set<string>>()
    for (const row of participantRows ?? []) {
      const participantUser = row.users as { status?: string } | null
      if (participantUser?.status !== "active") {
        continue
      }

      const current = participantCounts.get(row.project_id) ?? new Set<string>()
      current.add(row.user_id)
      participantCounts.set(row.project_id, current)
    }

    const searchTerm = normalizeSearchTerm(search)

    const projects = (projectRows ?? [])
      .filter((project) => (categoryId ? project.category_id === categoryId : true))
      .map<PublicDiscoveryProject>((project) => ({
        id: project.id,
        slug: project.slug ?? String(project.id),
        name: project.name,
        description: project.description ?? "",
        detailedDescription: project.detailed_description ?? "",
        isPublic: true,
        logoUrl: project.logo_url,
        website: project.website,
        categoryId: project.category_id,
        categoryName: project.category_id ? categoryMap.get(project.category_id) ?? null : null,
        createdAt: project.created_at,
        participantCount: participantCounts.get(project.id)?.size ?? 0,
      }))
      .filter((project) => projectMatchesSearch(project, searchTerm))

    const sortedProjects = [...projects].sort((left, right) => {
      if (sort === "oldest") {
        return new Date(left.createdAt ?? 0).getTime() - new Date(right.createdAt ?? 0).getTime()
      }

      if (sort === "name") {
        return left.name.localeCompare(right.name)
      }

      return new Date(right.createdAt ?? 0).getTime() - new Date(left.createdAt ?? 0).getTime()
    })

    return {
      categories: categories ?? [],
      projects: sortedProjects,
    }
  } catch (error) {
    logPublicDiscoveryError("projects-directory", error)
    return { categories: [], projects: [] }
  }
}

export const getPublicProjectDetail = cache(async (slug: string): Promise<PublicProjectDetail | null> => {
  try {
    const supabase = await createServerSupabaseClient()
    const {
      data: { user: authUser },
    } = await supabase.auth.getUser()

    const { data: projectRow, error: projectError } = await supabase
      .from("projects")
      .select("id, slug, name, description, detailed_description, logo_url, website, category_id, created_at, is_public, status")
      .eq("slug", slug)
      .is("deleted_at", null)
      .maybeSingle()

    if (projectError) {
      throw new Error(projectError.message)
    }

    if (!projectRow) {
      return null
    }

    const [{ data: participantRows, error: participantError }, { data: categoryRow, error: categoryError }] = await Promise.all([
      supabase
        .from("participants")
        .select("user_id, is_admin")
        .eq("project_id", projectRow.id),
      projectRow.category_id
        ? supabase.from("ref_categories").select("name").eq("id", projectRow.category_id).maybeSingle()
        : Promise.resolve({ data: null, error: null }),
    ])

    if (participantError) {
      throw new Error(participantError.message)
    }

    if (categoryError) {
      throw new Error(categoryError.message)
    }

    const membership = authUser ? (participantRows ?? []).find((participant) => participant.user_id === authUser.id) ?? null : null
    const hasAccess = Boolean(membership)

    if ((projectRow.is_public !== true || projectRow.status !== "active") && !hasAccess) {
      return null
    }

    const sharedProfilesResult = hasAccess && canReadInvitationReviewSharing()
      ? await invokeProjectMemberSharedProfilesReadServer({ projectId: projectRow.id })
      : { ok: true as const, data: [] }
    if (!sharedProfilesResult.ok) throw new Error(sharedProfilesResult.error.message)

    return {
      project: {
        id: projectRow.id,
        slug: projectRow.slug ?? slug,
        name: projectRow.name,
        description: projectRow.description ?? "",
        detailedDescription: projectRow.detailed_description ?? "",
        isPublic: projectRow.is_public === true,
        logoUrl: projectRow.logo_url,
        website: projectRow.website,
        categoryId: projectRow.category_id,
        categoryName: categoryRow?.name ?? null,
        createdAt: projectRow.created_at,
        participantCount: (participantRows ?? []).length,
      },
      participants: sharedProfilesResult.data.map((participant) => ({
        id: participant.userId,
        name: participant.displayName ?? "Project member",
        avatarUrl: participant.avatarUrl,
        role: participant.isAdmin ? "admin" : "member",
      })),
      hasAccess,
      userRole: membership ? (membership.is_admin ? "admin" : "member") : null,
    }
  } catch (error) {
    logPublicDiscoveryError("project-detail", error)
    return null
  }
})

export async function getPublicUsersDirectoryData({
  projectId,
  search,
}: {
  projectId?: number | null
  search?: string
}): Promise<PublicUsersDirectoryData> {
  try {
    if (!isReviewPolicyPreviewEnabled()) return { projects: [], users: [] }
    const supabase = await createServerSupabaseClient()

    const [{ data: publicProjects, error: projectError }, { data: userRows, error: userError }, { data: discoverableRows, error: consentError }] = await Promise.all([
      supabase
        .from("projects")
        .select("id, name, slug")
        .eq("status", "active")
        .eq("is_public", true)
        .is("deleted_at", null)
        .order("name"),
      supabase
        .from("users")
        .select("user_id, display_name, full_name, profile_headline, avatar_url, contribution_details, created_at, location_id, cubid_identity_status, cubid_score")
        .eq("status", "active")
        .eq("is_public", true)
        .is("deleted_at", null),
      supabase.rpc("list_discoverable_public_user_ids"),
    ])

    if (projectError) {
      throw new Error(projectError.message)
    }

    if (userError) {
      throw new Error(userError.message)
    }
    if (consentError) throw new Error(consentError.message)
    const discoverableUserIds = new Set((discoverableRows ?? []).map((row) => row.user_id))

    const projectIds = (publicProjects ?? []).map((project) => project.id)
    const visibleProjectIds = projectId ? [projectId] : projectIds

    const [{ data: participantRows, error: participantError }, { data: locationRows, error: locationError }] =
      await Promise.all([
        projectIds.length > 0
          ? supabase.from("participants").select("project_id, user_id").in("project_id", projectIds)
          : { data: [], error: null },
        supabase.from("ref_locations").select("id, name"),
      ])

    if (participantError) {
      throw new Error(participantError.message)
    }

    if (locationError) {
      throw new Error(locationError.message)
    }

    const locationMap = new Map((locationRows ?? []).map((location) => [location.id, location.name]))
    const projectSlugById = new Map((publicProjects ?? []).map((project) => [project.id, project.slug ?? String(project.id)]))
    const participantProjectsByUser = new Map<string, Set<number>>()

    for (const row of participantRows ?? []) {
      const current = participantProjectsByUser.get(row.user_id) ?? new Set<number>()
      current.add(row.project_id)
      participantProjectsByUser.set(row.user_id, current)
    }

    const searchTerm = normalizeSearchTerm(search)

    const users = (userRows ?? [])
      .filter((user) => discoverableUserIds.has(user.user_id))
      .map<PublicDiscoveryUser>((user) => {
        const projectIdsForUser = Array.from(participantProjectsByUser.get(user.user_id) ?? [])

        return {
          userId: user.user_id,
          displayName: user.display_name,
          fullName: user.full_name,
          profileHeadline: user.profile_headline,
          avatarUrl: user.avatar_url,
          contributionDetails: user.contribution_details,
          createdAt: user.created_at,
          location: user.location_id ? locationMap.get(user.location_id) ?? null : null,
          projectCount: projectIdsForUser.length,
          projectSlugs: projectIdsForUser.map((userProjectId) => projectSlugById.get(userProjectId)).filter((slug): slug is string => Boolean(slug)),
          cubidIdentityStatus: user.cubid_identity_status ?? "unlinked",
          cubidScore: user.cubid_score ?? null,
        }
      })
      .filter((user) => {
        if (visibleProjectIds.length === 0) {
          return false
        }

        const userProjectIds = participantProjectsByUser.get(user.userId) ?? new Set<number>()
        if (projectId && !userProjectIds.has(projectId)) {
          return false
        }

        if (!projectId && userProjectIds.size === 0) {
          return false
        }

        return userMatchesSearch(user, searchTerm)
      })
      .sort((left, right) => {
        const leftName = left.displayName ?? left.fullName ?? ""
        const rightName = right.displayName ?? right.fullName ?? ""
        return leftName.localeCompare(rightName)
      })

    return {
      projects: publicProjects ?? [],
      users,
    }
  } catch (error) {
    logPublicDiscoveryError("users-directory", error)
    return { projects: [], users: [] }
  }
}

export const getPublicUserProfile = cache(async (userId: string): Promise<PublicUserProfile | null> => {
  try {
    if (!isReviewPolicyPreviewEnabled()) return null
    const supabase = await createServerSupabaseClient()

    const { data: discoverableRows, error: consentError } = await supabase.rpc("list_discoverable_public_user_ids")
    if (consentError) throw new Error(consentError.message)
    if (!(discoverableRows ?? []).some((row) => row.user_id === userId)) return null

    const { data: userRow, error: userError } = await supabase
      .from("users")
      .select(
        "user_id, display_name, full_name, profile_headline, avatar_url, contribution_details, created_at, location_id, status, is_public, cubid_identity_status, cubid_score",
      )
      .eq("user_id", userId)
      .maybeSingle()

    if (userError) {
      throw new Error(userError.message)
    }

    if (!userRow || userRow.status !== "active" || userRow.is_public !== true) {
      return null
    }

    const [{ data: participantRows, error: participantError }, { data: locationRow, error: locationError }] = await Promise.all([
      supabase.from("participants").select("project_id").eq("user_id", userId),
      userRow.location_id
        ? supabase.from("ref_locations").select("name").eq("id", userRow.location_id).maybeSingle()
        : Promise.resolve({ data: null, error: null }),
    ])

    if (participantError) {
      throw new Error(participantError.message)
    }

    if (locationError) {
      throw new Error(locationError.message)
    }

    const projectIds = (participantRows ?? []).map((participant) => participant.project_id)
    const { data: projectRows, error: projectError } =
      projectIds.length > 0
        ? await supabase
            .from("projects")
            .select("id, slug, name, logo_url")
            .in("id", projectIds)
            .eq("status", "active")
            .eq("is_public", true)
            .is("deleted_at", null)
        : { data: [], error: null }

    if (projectError) {
      throw new Error(projectError.message)
    }

    return {
      user: {
        userId: userRow.user_id,
        displayName: userRow.display_name,
        fullName: userRow.full_name,
        profileHeadline: userRow.profile_headline,
        avatarUrl: userRow.avatar_url,
        contributionDetails: userRow.contribution_details,
        createdAt: userRow.created_at,
        location: locationRow?.name ?? null,
        projectCount: (projectRows ?? []).length,
        projectSlugs: (projectRows ?? []).map((project) => project.slug ?? String(project.id)),
        cubidIdentityStatus: userRow.cubid_identity_status ?? "unlinked",
        cubidScore: userRow.cubid_score ?? null,
      },
      projects: (projectRows ?? []).map((project) => ({
        id: project.id,
        slug: project.slug,
        name: project.name,
        logoUrl: project.logo_url,
      })),
    }
  } catch (error) {
    logPublicDiscoveryError("user-profile", error)
    return null
  }
})

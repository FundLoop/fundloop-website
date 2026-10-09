import "server-only"

import { cache } from "react"
import { createServerSupabaseClient } from "@/lib/supabase-server"
import { getPublicReadSupabaseClient } from "@/lib/supabase-public-read"
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

const PUBLIC_PROJECT_SELECT =
  "id, slug, name, description, detailed_description, logo_url, website, category_id, created_at"

type PublicProjectRow = {
  id: number
  slug: string | null
  name: string
  description: string
  detailed_description: string | null
  logo_url: string | null
  website: string | null
  category_id: number | null
  created_at: string | null
}

function toDiscoveryProject(row: PublicProjectRow, categoryName: string | null, participantCount: number): PublicDiscoveryProject {
  return {
    id: row.id,
    slug: row.slug ?? String(row.id),
    name: row.name,
    description: row.description ?? "",
    detailedDescription: row.detailed_description ?? "",
    isPublic: true,
    logoUrl: row.logo_url,
    website: row.website,
    categoryId: row.category_id,
    categoryName: row.category_id ? categoryName : null,
    createdAt: row.created_at,
    participantCount,
  }
}

function countMembersByProject(rows: Array<{ project_id: number | null; user_id: string | null }>) {
  const counts = new Map<number, Set<string>>()
  for (const row of rows) {
    if (row.project_id == null || row.user_id == null) {
      continue
    }

    const current = counts.get(row.project_id) ?? new Set<string>()
    current.add(row.user_id)
    counts.set(row.project_id, current)
  }

  return counts
}

// Throwing variant of the public directory read. The public API (#266) needs a database failure to
// surface as a 5xx rather than as an empty directory, which a client cannot tell from "no projects".
export async function loadPublicProjectsDirectory({
  categoryId,
  search,
  sort,
}: {
  categoryId?: number | null
  search?: string
  sort?: "recent" | "oldest" | "name"
}): Promise<PublicProjectsDirectoryData> {
  const supabase = await createServerSupabaseClient()

  const [{ data: projectRows, error: projectError }, { data: categories, error: categoriesError }] = await Promise.all([
    supabase
      .from("projects")
      .select(PUBLIC_PROJECT_SELECT)
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
      ? await supabase.from("project_active_members").select("project_id, user_id").in("project_id", projectIds)
      : { data: [], error: null }

  if (participantError) {
    throw new Error(participantError.message)
  }

  const participantCounts = countMembersByProject(participantRows ?? [])
  const searchTerm = normalizeSearchTerm(search)

  const projects = (projectRows ?? [])
    .filter((project) => (categoryId ? project.category_id === categoryId : true))
    .map<PublicDiscoveryProject>((project) =>
      toDiscoveryProject(
        project,
        project.category_id ? categoryMap.get(project.category_id) ?? null : null,
        participantCounts.get(project.id)?.size ?? 0,
      ),
    )
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
}

export async function getPublicProjectsDirectoryData(options: {
  categoryId?: number | null
  search?: string
  sort?: "recent" | "oldest" | "name"
}): Promise<PublicProjectsDirectoryData> {
  try {
    return await loadPublicProjectsDirectory(options)
  } catch (error) {
    logPublicDiscoveryError("projects-directory", error)
    return { categories: [], projects: [] }
  }
}

export type PublicProjectsPage = { projects: PublicDiscoveryProject[]; hasMore: boolean }

type PublicProjectsPageRow = {
  id: number
  slug: string
  name: string
  description: string
  logo_url: string | null
  website: string | null
  category_name: string | null
  created_at: string | null
  member_count: number | string | null
}

// One keyset page of public projects for the API (#266), newest first.
//
// The paging, the search predicate and the member count all run in api_v1_public_projects_page,
// because PostgREST caps every read at 1,000 rows: assembling a page in application code silently
// truncates once the directory passes the cap, so a match beyond it could never appear and a member
// count built from a capped membership read would understate. The function is SECURITY INVOKER, so
// anon's own grants and RLS still decide what it can see.
//
// Projects without a slug are not listed: the public id is the slug, and a slug-less project can
// be addressed neither by this API nor by the website's own project page.
export async function loadPublicProjectsPage(options: {
  limit: number
  afterId?: number | null
  search?: string | null
}): Promise<PublicProjectsPage> {
  const limit = Math.max(1, Math.trunc(options.limit))
  const afterId = options.afterId && options.afterId > 0 ? options.afterId : null
  const search = normalizeSearchTerm(options.search ?? undefined)

  // types/supabase.ts predates this function; regenerate it against the migration and drop the
  // cast (`supabase gen types typescript`). The row type below mirrors the function's RETURNS TABLE.
  const client = getPublicReadSupabaseClient() as unknown as {
    rpc: (name: string, args: Record<string, unknown>) => PromiseLike<{ data: PublicProjectsPageRow[] | null; error: { message: string } | null }>
  }

  const { data, error } = await client.rpc("api_v1_public_projects_page", {
    p_search: search === "" ? null : search,
    p_after_id: afterId,
    // One row beyond the page answers "is there a next page" without a second count query.
    p_limit: limit + 1,
  })

  if (error) {
    throw new Error(error.message)
  }

  const rows = data ?? []
  return {
    projects: rows.slice(0, limit).map((row) => ({
      id: row.id,
      slug: row.slug,
      name: row.name,
      description: row.description ?? "",
      detailedDescription: "",
      isPublic: true,
      logoUrl: row.logo_url,
      website: row.website,
      categoryId: null,
      categoryName: row.category_name,
      createdAt: row.created_at,
      participantCount: Number(row.member_count ?? 0),
    })),
    hasMore: rows.length > limit,
  }
}

// Resolve one public project by its public id, which is its slug. A numeric id is not an alias:
// `epoch_close_public_project_view` keys on the slug, so a numeric fallback id could be listed but
// never resolve to its cycle, and the website's own project page is addressed by slug too.
export async function loadPublicProjectRef(slug: string): Promise<{ id: number; slug: string } | null> {
  const { data, error } = await getPublicReadSupabaseClient()
    .from("projects")
    .select("id, slug")
    .eq("status", "active")
    .eq("is_public", true)
    .is("deleted_at", null)
    .eq("slug", slug)
    .limit(1)
    .maybeSingle()

  if (error) {
    throw new Error(error.message)
  }

  return data?.slug ? { id: data.id, slug: data.slug } : null
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
      supabase.from("project_active_members").select("user_id, is_admin").eq("project_id", projectRow.id),
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
      // Consent-filtered, active, public profiles only; raw users rows are owner-only under RLS.
      supabase.from("public_user_profiles").select("user_id, display_name, profile_headline, avatar_url, location_id"),
      supabase.rpc("list_discoverable_public_user_ids"),
    ])

    if (projectError) {
      throw new Error(projectError.message)
    }

    if (userError) {
      throw new Error(userError.message)
    }
    if (consentError) throw new Error(consentError.message)
    const consentedFieldsByUser = new Map(
      (discoverableRows ?? []).map((row) => [row.user_id, new Set(Array.isArray(row.fields) ? row.fields.filter((field): field is string => typeof field === "string") : [])]),
    )

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
      .filter((user): user is typeof user & { user_id: string } => user.user_id != null && consentedFieldsByUser.has(user.user_id))
      .map<PublicDiscoveryUser>((user) => {
        const projectIdsForUser = Array.from(participantProjectsByUser.get(user.user_id) ?? [])
        const consentedFields = consentedFieldsByUser.get(user.user_id) ?? new Set<string>()

        return {
          userId: user.user_id,
          displayName: consentedFields.has("display_name") ? user.display_name : null,
          fullName: null,
          profileHeadline: consentedFields.has("headline") ? user.profile_headline : null,
          avatarUrl: consentedFields.has("avatar") ? user.avatar_url : null,
          contributionDetails: null,
          createdAt: null,
          location: consentedFields.has("location") && user.location_id ? locationMap.get(user.location_id) ?? null : null,
          projectCount: projectIdsForUser.length,
          projectSlugs: projectIdsForUser.map((userProjectId) => projectSlugById.get(userProjectId)).filter((slug): slug is string => Boolean(slug)),
          cubidIdentityStatus: "unlinked",
          cubidScore: null,
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
    const discoverableConsent = (discoverableRows ?? []).find((row) => row.user_id === userId)
    if (!discoverableConsent) return null
    const consentedFields = new Set(
      Array.isArray(discoverableConsent.fields)
        ? discoverableConsent.fields.filter((field): field is string => typeof field === "string")
        : [],
    )

    // The view only returns active, public profiles with a current publication grant.
    const { data: userRow, error: userError } = await supabase
      .from("public_user_profiles")
      .select("user_id, display_name, profile_headline, avatar_url, location_id")
      .eq("user_id", userId)
      .maybeSingle()

    if (userError) {
      throw new Error(userError.message)
    }

    if (!userRow?.user_id) {
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
        displayName: consentedFields.has("display_name") ? userRow.display_name : null,
        fullName: null,
        profileHeadline: consentedFields.has("headline") ? userRow.profile_headline : null,
        avatarUrl: consentedFields.has("avatar") ? userRow.avatar_url : null,
        contributionDetails: null,
        createdAt: null,
        location: consentedFields.has("location") ? locationRow?.name ?? null : null,
        projectCount: (projectRows ?? []).length,
        projectSlugs: (projectRows ?? []).map((project) => project.slug ?? String(project.id)),
        cubidIdentityStatus: "unlinked",
        cubidScore: null,
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

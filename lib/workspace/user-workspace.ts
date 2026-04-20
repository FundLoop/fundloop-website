import "server-only"

import type { NavigationContext } from "@/lib/navigation-context"
import { createServerSupabaseClient } from "@/lib/supabase-server"

export type UserWorkspaceWarning = {
  scope: string
  message: string
}

export type UserWorkspaceProject = {
  id: number
  slug: string | null
  name: string
  description: string | null
  logoUrl: string | null
  joinedAt: string | null
  isFavorite: boolean
  isAdmin: boolean
}

export type UserWorkspaceRecommendedProject = {
  id: number
  slug: string | null
  name: string
  description: string | null
  logoUrl: string | null
}

export type UserWorkspaceResultSummary = {
  latest: {
    allocationUsd: number
    aggregateScore: number
    publishedAt: string
    monthLabel: string
  } | null
  totalAllocationUsd: number
  resultCount: number
  detailHref: "/settings/zkas"
}

export type UserWorkspaceHome = {
  profileStatus: {
    signedInEmail: string | null
    cubidStatus: NonNullable<NavigationContext["user"]>["cubidIdentityStatus"]
    completionPercent: number
    missingItems: string[]
  }
  participation: {
    joinedProjectCount: number
    founderProjectCount: number
    favoriteProjectCount: number
    recentProjects: UserWorkspaceProject[]
    hasUnavailableProjectDetails: boolean
  }
  discovery: {
    recommendedProjects: UserWorkspaceRecommendedProject[]
  }
  results: UserWorkspaceResultSummary
  warnings: UserWorkspaceWarning[]
}

type ParticipantRow = {
  project_id: number
  is_admin: boolean | null
  is_favorite: boolean | null
  joined_at: string | null
}

type ProjectRow = {
  id: number
  slug: string | null
  name: string
  description: string | null
  logo_url: string | null
}

type PublishedResultRow = {
  allocation_usd: number
  aggregate_score: number
  published_at: string
  run_id: number
}

type RunRow = {
  id: number
  month: string
}

type SupabaseReadResult<T> = {
  data: T | null
  error: { message?: string } | null
}

function warningFromError(scope: string, error: { message?: string } | null | undefined): UserWorkspaceWarning | null {
  if (!error) {
    return null
  }

  return {
    scope,
    message: error.message ?? "Workspace data could not be loaded.",
  }
}

async function readWorkspaceData<T>(
  scope: string,
  query: PromiseLike<SupabaseReadResult<T>>,
  warnings: UserWorkspaceWarning[],
  fallback: T,
): Promise<T> {
  try {
    const { data, error } = await query
    const warning = warningFromError(scope, error)
    if (warning) {
      warnings.push(warning)
      return fallback
    }

    return data ?? fallback
  } catch (error) {
    warnings.push({
      scope,
      message: error instanceof Error ? error.message : "Workspace data could not be loaded.",
    })
    return fallback
  }
}

function mapProjectWithParticipation(project: ProjectRow, participant: ParticipantRow): UserWorkspaceProject {
  return {
    id: project.id,
    slug: project.slug,
    name: project.name,
    description: project.description,
    logoUrl: project.logo_url,
    joinedAt: participant.joined_at,
    isFavorite: participant.is_favorite === true,
    isAdmin: participant.is_admin === true,
  }
}

function mapRecommendedProject(project: ProjectRow): UserWorkspaceRecommendedProject {
  return {
    id: project.id,
    slug: project.slug,
    name: project.name,
    description: project.description,
    logoUrl: project.logo_url,
  }
}

export function buildUserWorkspaceHome({
  navigationContext,
  participantRows,
  joinedProjects,
  recommendedProjects,
  publishedResults,
  runs,
  warnings,
}: {
  navigationContext: NavigationContext
  participantRows: ParticipantRow[]
  joinedProjects: ProjectRow[]
  recommendedProjects: ProjectRow[]
  publishedResults: PublishedResultRow[]
  runs: RunRow[]
  warnings: UserWorkspaceWarning[]
}): UserWorkspaceHome {
  const user = navigationContext.user
  const joinedProjectById = new Map(joinedProjects.map((project) => [project.id, project]))
  const runById = new Map(runs.map((run) => [run.id, run]))
  const visibleParticipantRows = participantRows.filter((participant) => joinedProjectById.has(participant.project_id))
  const hasJoinedProjectReadWarning = warnings.some((warning) => warning.scope === "joined-projects")
  const recentProjects = visibleParticipantRows
    .map((participant) => {
      const project = joinedProjectById.get(participant.project_id)
      return project ? mapProjectWithParticipation(project, participant) : null
    })
    .filter((project): project is UserWorkspaceProject => Boolean(project))
    .sort((left, right) => new Date(right.joinedAt ?? 0).getTime() - new Date(left.joinedAt ?? 0).getTime())
    .slice(0, 3)

  const latestResult = publishedResults[0] ?? null

  return {
    profileStatus: {
      signedInEmail: user?.email ?? null,
      cubidStatus: user?.cubidIdentityStatus ?? "unlinked",
      completionPercent: user?.profileCompletionPercent ?? 0,
      missingItems: user?.profileCompletionMissingItems ?? [],
    },
    participation: {
      joinedProjectCount: visibleParticipantRows.length,
      founderProjectCount: visibleParticipantRows.filter((participant) => participant.is_admin === true).length,
      favoriteProjectCount: visibleParticipantRows.filter((participant) => participant.is_favorite === true).length,
      recentProjects,
      hasUnavailableProjectDetails: hasJoinedProjectReadWarning && participantRows.length > 0,
    },
    discovery: {
      recommendedProjects: recommendedProjects.slice(0, 3).map(mapRecommendedProject),
    },
    results: {
      latest: latestResult
        ? {
            allocationUsd: Number(latestResult.allocation_usd),
            aggregateScore: Number(latestResult.aggregate_score),
            publishedAt: latestResult.published_at,
            monthLabel: runById.get(latestResult.run_id)?.month ?? `Run ${latestResult.run_id}`,
          }
        : null,
      totalAllocationUsd: publishedResults.reduce((sum, result) => sum + Number(result.allocation_usd), 0),
      resultCount: publishedResults.length,
      detailHref: "/settings/zkas",
    },
    warnings,
  }
}

export async function getUserWorkspaceHome(navigationContext: NavigationContext): Promise<UserWorkspaceHome> {
  const warnings: UserWorkspaceWarning[] = []
  const user = navigationContext.user

  if (!user) {
    return buildUserWorkspaceHome({
      navigationContext,
      participantRows: [],
      joinedProjects: [],
      recommendedProjects: [],
      publishedResults: [],
      runs: [],
      warnings,
    })
  }

  const supabase = await createServerSupabaseClient()
  const [participantRows, publishedResults] = await Promise.all([
    readWorkspaceData<ParticipantRow[]>(
      "participation",
      supabase
        .from("participants")
        .select("project_id, is_admin, is_favorite, joined_at")
        .eq("user_id", user.id)
        .order("joined_at", { ascending: false }),
      warnings,
      [],
    ),
    readWorkspaceData<PublishedResultRow[]>(
      "results",
      supabase
        .from("zkas_published_user_results")
        .select("allocation_usd, aggregate_score, published_at, run_id")
        .eq("user_id", user.id)
        .order("published_at", { ascending: false }),
      warnings,
      [],
    ),
  ])

  const joinedProjectIds = Array.from(new Set(participantRows.map((participant) => participant.project_id)))
  const publicProjectsQuery = supabase
    .from("projects")
    .select("id, slug, name, description, logo_url")
    .eq("status", "active")
    .eq("is_public", true)
    .is("deleted_at", null)
    .order("created_at", { ascending: false })
    .limit(3)
  const unjoinedPublicProjectsQuery =
    joinedProjectIds.length > 0 ? publicProjectsQuery.not("id", "in", `(${joinedProjectIds.join(",")})`) : publicProjectsQuery
  const joinedProjects =
    joinedProjectIds.length > 0
      ? await readWorkspaceData<ProjectRow[]>(
          "joined-projects",
          supabase
            .from("projects")
            .select("id, slug, name, description, logo_url")
            .in("id", joinedProjectIds)
            .is("deleted_at", null),
          warnings,
          [],
        )
      : []
  const resultRunIds = Array.from(new Set(publishedResults.map((result) => result.run_id)))
  const [runs, recommendedProjects] = await Promise.all([
    resultRunIds.length > 0
      ? readWorkspaceData<RunRow[]>(
          "result-runs",
          supabase.from("zkas_runs").select("id, month").in("id", resultRunIds),
          warnings,
          [],
        )
      : Promise.resolve([]),
    readWorkspaceData<ProjectRow[]>("discovery", unjoinedPublicProjectsQuery, warnings, []),
  ])

  return buildUserWorkspaceHome({
    navigationContext,
    participantRows,
    joinedProjects,
    recommendedProjects,
    publishedResults,
    runs,
    warnings,
  })
}

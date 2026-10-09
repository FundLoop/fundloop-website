import "server-only"

import { createServerSupabaseClient } from "@/lib/supabase-server"
import { getPublicProjectsDirectoryData, type PublicDiscoveryProject } from "@/lib/public-discovery"
import { decodeCursor, encodeCursor, isoOrNull, type ApiMeta } from "./response"

// Read models for the public /api/v1 surface (#266). These reuse the same RLS-safe read paths the
// public pages use, so a third party can never see more than fundloop.org already shows.
//
// The public id is the project slug: a stable string id, as third-party clients require.
// Cycle amounts are canonical USD minor units; the public cycle views carry no currency column,
// so the field names state the unit rather than implying a currency field exists.

export type ApiProject = {
  id: string
  name: string
  description: string
  website: string | null
  logo_url: string | null
  category: string | null
  member_count: number
  created_at: string | null
}

export type ApiProjectCycle = {
  project_id: string
  cycle_key: string
  status: string
  root_hash: string | null
  published_cohort_count: number
  source_count: number
  funded_usd_minor: string
  harvested_unclaimed_usd_minor: string
  cap_multiple: string | null
  created_at: string | null
  network: {
    status: string
    published_user_count: number
    funded_usd_minor: string
    final_allocation_usd_minor: string
    returned_residue_usd_minor: string
  } | null
}

function toApiProject(project: PublicDiscoveryProject): ApiProject {
  return {
    id: project.slug,
    name: project.name,
    description: project.description,
    website: project.website,
    logo_url: project.logoUrl,
    category: project.categoryName,
    member_count: project.participantCount,
    created_at: isoOrNull(project.createdAt),
  }
}

function minor(value: string | number | null | undefined) {
  if (value === null || value === undefined) return "0"
  const text = String(value)
  return /^-?\d+$/.test(text) ? text : "0"
}

// Deterministic order so a cursor always resumes at the same place: newest first, slug breaking ties.
function compareProjects(left: PublicDiscoveryProject, right: PublicDiscoveryProject) {
  const leftCreated = left.createdAt ?? ""
  const rightCreated = right.createdAt ?? ""
  if (leftCreated !== rightCreated) return leftCreated < rightCreated ? 1 : -1
  return left.slug < right.slug ? -1 : left.slug > right.slug ? 1 : 0
}

export async function listPublicProjects(options: { limit: number; cursor: string | null; search?: string | null }) {
  const directory = await getPublicProjectsDirectoryData({ search: options.search ?? undefined })
  const ordered = [...directory.projects].sort(compareProjects)

  const cursor = decodeCursor(options.cursor)
  const startIndex = cursor
    ? ordered.findIndex((project) => project.slug === String(cursor.after_id)) + 1
    : 0
  // An unknown cursor would otherwise silently restart the list.
  if (cursor && startIndex === 0) return { ok: false as const, reason: "invalid_cursor" as const }

  const page = ordered.slice(startIndex, startIndex + options.limit)
  const last = page[page.length - 1]
  const hasMore = startIndex + options.limit < ordered.length
  const meta: ApiMeta = { next_cursor: hasMore && last ? encodeCursor({ after_id: last.slug }) : null }
  return { ok: true as const, projects: page.map(toApiProject), meta }
}

export async function getPublicProjectCycle(projectId: string) {
  const supabase = await createServerSupabaseClient()

  // Resolve against the public directory so non-public projects stay invisible, including by slug.
  const directory = await getPublicProjectsDirectoryData({})
  const project = directory.projects.find(
    (candidate) => candidate.slug === projectId || String(candidate.id) === projectId,
  )
  if (!project) return { ok: false as const, reason: "not_found" as const }

  const { data: projectCycle, error: projectCycleError } = await supabase
    .from("epoch_close_public_project_view")
    .select("cycle_key, status, root_hash, funded_minor, published_cohort_count, source_count, cap_multiple, harvested_unclaimed_minor, created_at")
    .eq("project_slug", project.slug)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle()
  if (projectCycleError) return { ok: false as const, reason: "read_failed" as const }
  if (!projectCycle?.cycle_key) return { ok: true as const, cycle: null }

  const { data: networkCycle } = await supabase
    .from("epoch_close_public_view")
    .select("status, published_user_count, funded_minor, final_allocation_minor, returned_residue_minor")
    .eq("cycle_key", projectCycle.cycle_key)
    .maybeSingle()

  const cycle: ApiProjectCycle = {
    project_id: project.slug,
    cycle_key: projectCycle.cycle_key,
    status: projectCycle.status ?? "unknown",
    root_hash: projectCycle.root_hash ?? null,
    published_cohort_count: projectCycle.published_cohort_count ?? 0,
    source_count: projectCycle.source_count ?? 0,
    funded_usd_minor: minor(projectCycle.funded_minor),
    harvested_unclaimed_usd_minor: minor(projectCycle.harvested_unclaimed_minor),
    cap_multiple: projectCycle.cap_multiple === null || projectCycle.cap_multiple === undefined ? null : String(projectCycle.cap_multiple),
    created_at: isoOrNull(projectCycle.created_at),
    network: networkCycle
      ? {
        status: networkCycle.status ?? "unknown",
        published_user_count: networkCycle.published_user_count ?? 0,
        funded_usd_minor: minor(networkCycle.funded_minor),
        final_allocation_usd_minor: minor(networkCycle.final_allocation_minor),
        returned_residue_usd_minor: minor(networkCycle.returned_residue_minor),
      }
      : null,
  }
  return { ok: true as const, cycle }
}

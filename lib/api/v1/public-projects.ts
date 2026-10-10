import "server-only"

import { loadPublicProjectRef, loadPublicProjectsPage, type PublicDiscoveryProject } from "@/lib/public-discovery"
import { getPublicReadSupabaseClient } from "@/lib/supabase-public-read"
import { isEpochClosePreviewEnabled } from "@/lib/monthly-cycles/epoch-close-visibility"
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

// Nullable aggregates are deliberate. The public cycle views withhold every count and amount for a
// cohort below the publication threshold, and a client has to be able to tell a withheld value from
// a real zero, so null is passed through instead of being coerced.
//
// Network-wide totals are deliberately absent. `epoch_close_public_view` is readable by anon, but no
// FundLoop page renders it, and this API must never publish more than fundloop.org already shows.
// Exposing it would need its own decision, not a side effect of shipping the project endpoint.
export type ApiProjectCycle = {
  project_id: string
  cycle_key: string
  status: string
  // Both public cycle views expose provisional, pre-payout packages only. Stated on every response
  // so a client never mistakes these figures for a settled payout.
  provisional: true
  // ISO 4217, constant because every amount in these views is canonical USD minor units.
  currency: "USD"
  root_hash: string | null
  published_cohort_count: number | null
  source_count: number | null
  funded_usd_minor: string | null
  harvested_unclaimed_usd_minor: string | null
  cap_multiple: string | null
  created_at: string | null
}

// The monetary columns are numeric(78,0). They are cast to text in the database so the value never
// passes through an IEEE-754 double on its way here: anything above 2^53 would already be rounded,
// and a large enough value would arrive in exponent notation.
const PROJECT_CYCLE_SELECT =
  "cycle_key, status, root_hash, published_cohort_count, source_count, created_at, funded_minor::text, harvested_unclaimed_minor::text, cap_multiple::text"

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

// An integer amount as text, or null when the view withheld it.
function minor(value: string | null | undefined) {
  if (value === null || value === undefined) return null
  const text = String(value).trim()
  return /^-?\d+$/.test(text) ? text : null
}

// A decimal multiple as text, keeping the scale the database chose (for example "3.00").
function decimalText(value: string | null | undefined) {
  if (value === null || value === undefined) return null
  const text = String(value).trim()
  return /^-?\d+(\.\d+)?$/.test(text) ? text : null
}

function count(value: number | null | undefined) {
  return typeof value === "number" && Number.isInteger(value) ? value : null
}

// Cursors are opaque to clients but must be read strictly here: a cursor this version cannot
// understand has to fail, because silently restarting the list would make a client that is paging
// through projects believe it had reached the end.
function parseCursor(raw: string | null) {
  if (raw === null || raw.trim() === "") return { ok: true as const, afterId: null }
  const decoded = decodeCursor(raw)
  const afterId = decoded?.after_id
  // Number.isInteger accepts 1e21, which PostgREST then rejects for a bigint column, so the
  // request would fail as a 500 instead of being refused as a bad cursor.
  if (typeof afterId !== "number" || !Number.isSafeInteger(afterId) || afterId < 1) return { ok: false as const }
  return { ok: true as const, afterId }
}

export async function listPublicProjects(options: { limit: number; cursor: string | null; search?: string | null }) {
  const cursor = parseCursor(options.cursor)
  if (!cursor.ok) return { ok: false as const, reason: "invalid_cursor" as const }

  const page = await loadPublicProjectsPage({ limit: options.limit, afterId: cursor.afterId, search: options.search })
  const last = page.projects[page.projects.length - 1]
  const meta: ApiMeta = { next_cursor: page.hasMore && last ? encodeCursor({ after_id: last.id }) : null }
  return { ok: true as const, projects: page.projects.map(toApiProject), meta }
}

export async function getPublicProjectCycle(projectId: string) {
  // Resolve against the public project filters so a non-public project stays invisible. The public
  // id is the slug; see loadPublicProjectRef for why a numeric id is not an alias.
  const project = await loadPublicProjectRef(projectId)
  if (!project) return { ok: false as const, reason: "not_found" as const }

  // Shadow-mode figures are published on the deployments where fundloop.org publishes them, and
  // nowhere else. Elsewhere the project exists with no published cycle, which is the honest answer.
  if (!isEpochClosePreviewEnabled()) return { ok: true as const, cycle: null }

  const projectCycle = await getPublicReadSupabaseClient()
    .from("epoch_close_public_project_view")
    .select(PROJECT_CYCLE_SELECT)
    .eq("project_slug", project.slug)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle()
  if (projectCycle.error) return { ok: false as const, reason: "read_failed" as const }
  const row = projectCycle.data
  if (!row?.cycle_key) return { ok: true as const, cycle: null }

  const cycle: ApiProjectCycle = {
    project_id: project.slug,
    cycle_key: row.cycle_key,
    status: row.status ?? "unknown",
    provisional: true,
    currency: "USD",
    root_hash: row.root_hash ?? null,
    published_cohort_count: count(row.published_cohort_count),
    source_count: count(row.source_count),
    funded_usd_minor: minor(row.funded_minor),
    harvested_unclaimed_usd_minor: minor(row.harvested_unclaimed_minor),
    cap_multiple: decimalText(row.cap_multiple),
    created_at: isoOrNull(row.created_at),
  }
  return { ok: true as const, cycle }
}

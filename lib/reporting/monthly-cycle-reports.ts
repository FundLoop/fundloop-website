import "server-only"

import { getAdminSupabaseClient } from "@/lib/supabase-admin"
import { createServerSupabaseClient } from "@/lib/supabase-server"
import type { NavigationContext } from "@/lib/navigation-context"
import type { Database, Json } from "@/types/supabase"

export const MONTHLY_CYCLE_REPORTS_BUCKET = "monthly-cycle-reports"

export type ReportingWarning = {
  scope: string
  message: string
}

export type ReportingArtifact = {
  bucket: string
  path: string | null
  mimeType: string | null
  hash: string | null
}

export type MonthlyReportCard = {
  id: number | null
  cycleId: number
  cycleKey: string
  cycleStatus: Database["public"]["Enums"]["monthly_cycle_status"]
  audience: Database["public"]["Enums"]["monthly_cycle_report_audience"]
  title: string
  summary: string
  publishedAt: string | null
  artifact: ReportingArtifact | null
}

export type PublicReportingOverview = {
  reports: MonthlyReportCard[]
  totals: {
    publishedReportCount: number
    latestCycleKey: string | null
  }
  warnings: ReportingWarning[]
}

export type UserReportingWorkspace = {
  reports: MonthlyReportCard[]
  resultCount: number
  totalAllocationUsd: number
  latestResultCycleKey: string | null
  warnings: ReportingWarning[]
}

export type FounderProjectReportingWorkspace = {
  project: {
    id: number
    slug: string
    name: string
  }
  reports: MonthlyReportCard[]
  summaries: Array<{
    cycleKey: string
    activeUserCount: number
    publishedUserCount: number
    attributedPayoutUsd: number
    contributedAmountUsd: number
  }>
  warnings: ReportingWarning[]
}

export type OperatorCycleReportingWorkspace = {
  cycle: {
    id: number
    cycleKey: string
    status: Database["public"]["Enums"]["monthly_cycle_status"]
    reportingPublishedAt: string | null
  }
  reports: {
    public: MonthlyReportCard | null
    operator: MonthlyReportCard | null
    userCount: number
    founderCount: number
    artifactCount: number
  }
  metrics: {
    publishedUserResultCount: number
    projectSummaryCount: number
    totalPublishedAllocationUsd: number
  }
  warnings: ReportingWarning[]
}

type ReportRow = Pick<
  Database["public"]["Tables"]["monthly_cycle_reports"]["Row"],
  | "id"
  | "monthly_cycle_id"
  | "audience"
  | "title"
  | "summary"
  | "artifact_bucket"
  | "artifact_path"
  | "artifact_mime_type"
  | "artifact_hash"
  | "published_at"
  | "subject_project_id"
  | "subject_user_id"
  | "payload"
>

type CycleRow = Pick<Database["public"]["Tables"]["monthly_cycles"]["Row"], "id" | "cycle_key" | "status" | "reporting_published_at">

type UserResultRow = Pick<Database["public"]["Tables"]["zkas_published_user_results"]["Row"], "monthly_cycle_id" | "allocation_usd">

type ProjectSummaryRow = Pick<
  Database["public"]["Tables"]["zkas_run_project_summaries"]["Row"],
  "monthly_cycle_id" | "project_id" | "active_user_count" | "published_user_count" | "attributed_payout_usd" | "contributed_amount_usd"
>

type ProjectRow = Pick<Database["public"]["Tables"]["projects"]["Row"], "id" | "slug" | "name">

type SupabaseReadResult<T> = {
  data: T | null
  error: { message?: string } | null
}

function warningFromError(scope: string, error: { message?: string } | null | undefined): ReportingWarning | null {
  if (!error) return null
  return { scope, message: error.message ?? "Reporting data could not be loaded." }
}

async function readReportingData<T>(
  scope: string,
  query: PromiseLike<SupabaseReadResult<T>>,
  warnings: ReportingWarning[],
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
      message: error instanceof Error ? error.message : "Reporting data could not be loaded.",
    })
    return fallback
  }
}

function numberValue(value: number | null | undefined) {
  return Number(value ?? 0)
}

function payloadText(payload: Json, key: string) {
  if (!payload || typeof payload !== "object" || Array.isArray(payload)) return null
  const value = payload[key]
  return typeof value === "string" && value.trim().length > 0 ? value : null
}

function artifactFromReport(report: ReportRow): ReportingArtifact | null {
  if (!report.artifact_path) return null
  return {
    bucket: report.artifact_bucket,
    path: report.artifact_path,
    mimeType: report.artifact_mime_type,
    hash: report.artifact_hash,
  }
}

function cardFromReport(report: ReportRow, cycleById: Map<number, CycleRow>): MonthlyReportCard {
  const cycle = cycleById.get(report.monthly_cycle_id)
  return {
    id: report.id,
    cycleId: report.monthly_cycle_id,
    cycleKey: cycle?.cycle_key ?? payloadText(report.payload, "cycleKey") ?? `Cycle ${report.monthly_cycle_id}`,
    cycleStatus: cycle?.status ?? "reporting",
    audience: report.audience,
    title: report.title,
    summary: report.summary,
    publishedAt: report.published_at,
    artifact: artifactFromReport(report),
  }
}

function placeholderCard(cycle: CycleRow, audience: MonthlyReportCard["audience"], title: string, summary: string): MonthlyReportCard {
  return {
    id: null,
    cycleId: cycle.id,
    cycleKey: cycle.cycle_key,
    cycleStatus: cycle.status,
    audience,
    title,
    summary,
    publishedAt: cycle.reporting_published_at,
    artifact: null,
  }
}

export function buildPublicReportingOverview(input: {
  reports: ReportRow[]
  cycles: CycleRow[]
  warnings: ReportingWarning[]
}): PublicReportingOverview {
  const cycleById = new Map(input.cycles.map((cycle) => [cycle.id, cycle]))
  const reports = input.reports
    .map((report) => cardFromReport(report, cycleById))
    .sort((left, right) => (right.publishedAt ?? "").localeCompare(left.publishedAt ?? ""))

  return {
    reports,
    totals: {
      publishedReportCount: reports.length,
      latestCycleKey: reports[0]?.cycleKey ?? null,
    },
    warnings: input.warnings,
  }
}

export function buildUserReportingWorkspace(input: {
  reports: ReportRow[]
  cycles: CycleRow[]
  results: UserResultRow[]
  warnings: ReportingWarning[]
}): UserReportingWorkspace {
  const cycleById = new Map(input.cycles.map((cycle) => [cycle.id, cycle]))
  const reportCards = input.reports.map((report) => cardFromReport(report, cycleById))
  const reportCycleIds = new Set(reportCards.map((report) => report.cycleId))
  const resultPlaceholders = input.results
    .filter((result) => result.monthly_cycle_id && !reportCycleIds.has(result.monthly_cycle_id))
    .map((result) => {
      const cycle = cycleById.get(result.monthly_cycle_id as number)
      return cycle
        ? placeholderCard(
            cycle,
            "user",
            `${cycle.cycle_key} result explanation pending`,
            "A published result exists for this cycle. The detailed user report artifact has not been published yet.",
          )
        : null
    })
    .filter((card): card is MonthlyReportCard => Boolean(card))

  const reports = [...reportCards, ...resultPlaceholders].sort((left, right) => right.cycleKey.localeCompare(left.cycleKey))

  return {
    reports,
    resultCount: input.results.length,
    totalAllocationUsd: input.results.reduce((sum, result) => sum + numberValue(result.allocation_usd), 0),
    latestResultCycleKey: reports[0]?.cycleKey ?? null,
    warnings: input.warnings,
  }
}

export function buildFounderProjectReportingWorkspace(input: {
  project: ProjectRow
  reports: ReportRow[]
  cycles: CycleRow[]
  summaries: ProjectSummaryRow[]
  warnings: ReportingWarning[]
}): FounderProjectReportingWorkspace {
  const cycleById = new Map(input.cycles.map((cycle) => [cycle.id, cycle]))
  const reports = input.reports.map((report) => cardFromReport(report, cycleById)).sort((left, right) => right.cycleKey.localeCompare(left.cycleKey))

  return {
    project: {
      id: input.project.id,
      slug: input.project.slug ?? String(input.project.id),
      name: input.project.name,
    },
    reports,
    summaries: input.summaries
      .map((summary) => ({
        cycleKey: summary.monthly_cycle_id ? (cycleById.get(summary.monthly_cycle_id)?.cycle_key ?? `Cycle ${summary.monthly_cycle_id}`) : "Unassigned",
        activeUserCount: numberValue(summary.active_user_count),
        publishedUserCount: numberValue(summary.published_user_count),
        attributedPayoutUsd: numberValue(summary.attributed_payout_usd),
        contributedAmountUsd: numberValue(summary.contributed_amount_usd),
      }))
      .sort((left, right) => right.cycleKey.localeCompare(left.cycleKey)),
    warnings: input.warnings,
  }
}

export function buildOperatorCycleReportingWorkspace(input: {
  cycle: CycleRow
  reports: ReportRow[]
  publishedResults: UserResultRow[]
  projectSummaries: ProjectSummaryRow[]
  warnings: ReportingWarning[]
}): OperatorCycleReportingWorkspace {
  const cycleById = new Map([[input.cycle.id, input.cycle]])
  const cards = input.reports.map((report) => cardFromReport(report, cycleById))
  const publicReport = cards.find((report) => report.audience === "public") ?? null
  const operatorReport = cards.find((report) => report.audience === "operator") ?? null

  return {
    cycle: {
      id: input.cycle.id,
      cycleKey: input.cycle.cycle_key,
      status: input.cycle.status,
      reportingPublishedAt: input.cycle.reporting_published_at,
    },
    reports: {
      public: publicReport,
      operator: operatorReport,
      userCount: cards.filter((report) => report.audience === "user").length,
      founderCount: cards.filter((report) => report.audience === "founder").length,
      artifactCount: cards.filter((report) => report.artifact?.path).length,
    },
    metrics: {
      publishedUserResultCount: input.publishedResults.length,
      projectSummaryCount: input.projectSummaries.length,
      totalPublishedAllocationUsd: input.publishedResults.reduce((sum, result) => sum + numberValue(result.allocation_usd), 0),
    },
    warnings: input.warnings,
  }
}

async function loadCyclesForReports(reportRows: ReportRow[], warnings: ReportingWarning[]) {
  const cycleIds = Array.from(new Set(reportRows.map((report) => report.monthly_cycle_id)))
  if (cycleIds.length === 0) return []
  const supabase = getAdminSupabaseClient()
  return readReportingData<CycleRow[]>(
    "monthly-cycles",
    supabase.from("monthly_cycles").select("id, cycle_key, status, reporting_published_at").in("id", cycleIds),
    warnings,
    [],
  )
}

export async function loadPublicReportingOverview(): Promise<PublicReportingOverview> {
  const supabase = getAdminSupabaseClient()
  const warnings: ReportingWarning[] = []
  const reports = await readReportingData<ReportRow[]>(
    "public-reports",
    supabase
      .from("monthly_cycle_reports")
      .select("id, monthly_cycle_id, audience, title, summary, artifact_bucket, artifact_path, artifact_mime_type, artifact_hash, published_at, subject_project_id, subject_user_id, payload")
      .eq("audience", "public")
      .order("published_at", { ascending: false })
      .limit(6),
    warnings,
    [],
  )
  const cycles = await loadCyclesForReports(reports, warnings)
  return buildPublicReportingOverview({ reports, cycles, warnings })
}

export async function loadUserReportingWorkspace(navigationContext: NavigationContext): Promise<UserReportingWorkspace> {
  const warnings: ReportingWarning[] = []
  const user = navigationContext.user
  if (!user) return buildUserReportingWorkspace({ reports: [], cycles: [], results: [], warnings })

  const supabase = await createServerSupabaseClient()
  const [reports, results] = await Promise.all([
    readReportingData<ReportRow[]>(
      "user-reports",
      supabase
        .from("monthly_cycle_reports")
        .select("id, monthly_cycle_id, audience, title, summary, artifact_bucket, artifact_path, artifact_mime_type, artifact_hash, published_at, subject_project_id, subject_user_id, payload")
        .eq("audience", "user")
        .eq("subject_user_id", user.id)
        .order("published_at", { ascending: false }),
      warnings,
      [],
    ),
    readReportingData<UserResultRow[]>(
      "published-results",
      supabase.from("zkas_published_user_results").select("monthly_cycle_id, allocation_usd").eq("user_id", user.id),
      warnings,
      [],
    ),
  ])

  const cycleIds = Array.from(
    new Set([
      ...reports.map((report) => report.monthly_cycle_id),
      ...results.map((result) => result.monthly_cycle_id).filter((id): id is number => typeof id === "number"),
    ]),
  )
  const cycles =
    cycleIds.length > 0
      ? await readReportingData<CycleRow[]>(
          "monthly-cycles",
          supabase.from("monthly_cycles").select("id, cycle_key, status, reporting_published_at").in("id", cycleIds),
          warnings,
          [],
        )
      : []

  return buildUserReportingWorkspace({ reports, cycles, results, warnings })
}

export async function loadFounderProjectReportingWorkspace(projectId: number, slug: string): Promise<FounderProjectReportingWorkspace | null> {
  const supabase = getAdminSupabaseClient()
  const warnings: ReportingWarning[] = []
  const { data: project, error: projectError } = await supabase.from("projects").select("id, slug, name").eq("id", projectId).maybeSingle()
  if (projectError) throw new Error(projectError.message)
  if (!project || project.slug !== slug) return null

  const [reports, summaries] = await Promise.all([
    readReportingData<ReportRow[]>(
      "founder-reports",
      supabase
        .from("monthly_cycle_reports")
        .select("id, monthly_cycle_id, audience, title, summary, artifact_bucket, artifact_path, artifact_mime_type, artifact_hash, published_at, subject_project_id, subject_user_id, payload")
        .eq("audience", "founder")
        .eq("subject_project_id", project.id)
        .order("published_at", { ascending: false }),
      warnings,
      [],
    ),
    readReportingData<ProjectSummaryRow[]>(
      "project-summaries",
      supabase
        .from("zkas_run_project_summaries")
        .select("monthly_cycle_id, project_id, active_user_count, published_user_count, attributed_payout_usd, contributed_amount_usd")
        .eq("project_id", project.id),
      warnings,
      [],
    ),
  ])
  const cycleIds = Array.from(
    new Set([
      ...reports.map((report) => report.monthly_cycle_id),
      ...summaries.map((summary) => summary.monthly_cycle_id).filter((id): id is number => typeof id === "number"),
    ]),
  )
  const cycles =
    cycleIds.length > 0
      ? await readReportingData<CycleRow[]>(
          "monthly-cycles",
          supabase.from("monthly_cycles").select("id, cycle_key, status, reporting_published_at").in("id", cycleIds),
          warnings,
          [],
        )
      : []

  return buildFounderProjectReportingWorkspace({ project, reports, cycles, summaries, warnings })
}

export async function loadOperatorCycleReportingWorkspace(cycleKey: string): Promise<OperatorCycleReportingWorkspace | null> {
  const supabase = getAdminSupabaseClient()
  const warnings: ReportingWarning[] = []
  const { data: cycle, error: cycleError } = await supabase
    .from("monthly_cycles")
    .select("id, cycle_key, status, reporting_published_at")
    .eq("cycle_key", cycleKey)
    .maybeSingle()
  if (cycleError) throw new Error(cycleError.message)
  if (!cycle) return null

  const [reports, publishedResults, projectSummaries] = await Promise.all([
    readReportingData<ReportRow[]>(
      "cycle-reports",
      supabase
        .from("monthly_cycle_reports")
        .select("id, monthly_cycle_id, audience, title, summary, artifact_bucket, artifact_path, artifact_mime_type, artifact_hash, published_at, subject_project_id, subject_user_id, payload")
        .eq("monthly_cycle_id", cycle.id)
        .order("audience", { ascending: true }),
      warnings,
      [],
    ),
    readReportingData<UserResultRow[]>(
      "published-results",
      supabase.from("zkas_published_user_results").select("monthly_cycle_id, allocation_usd").eq("monthly_cycle_id", cycle.id),
      warnings,
      [],
    ),
    readReportingData<ProjectSummaryRow[]>(
      "project-summaries",
      supabase
        .from("zkas_run_project_summaries")
        .select("monthly_cycle_id, project_id, active_user_count, published_user_count, attributed_payout_usd, contributed_amount_usd")
        .eq("monthly_cycle_id", cycle.id),
      warnings,
      [],
    ),
  ])

  return buildOperatorCycleReportingWorkspace({ cycle, reports, publishedResults, projectSummaries, warnings })
}

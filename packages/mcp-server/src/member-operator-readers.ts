import type { McpAuthContext } from "./auth.ts"
import { readSupabaseRestClientConfig } from "./founder-reader.ts"

export type ProjectMemberReportingStatus = {
  projectSlug: string
  cycleKey: string | null
  reports: {
    founderReportCount: number
    artifactCount: number
  }
  attribution: {
    approvedDatasetCount: number
    pendingDatasetCount: number
  }
}

export type OperatorCycleStatus = {
  cycleKey: string
  status: string
  lockedAt: string | null
  calculationStartedAt: string | null
  distributionStartedAt: string | null
  reportingPublishedAt: string | null
}

export type OperatorCycleEvent = {
  cycleKey: string
  eventType: string
  outcome: string
  severity: string
  attemptId: string
  message: string | null
  createdAt: string
}

export type OperatorReconciliationVisibility = {
  submitted: number
  confirming: number
  awaitingConfirmation: number
  confirmed: number
  failed: number
}

export type OperatorReportingCoverage = {
  cycleKey: string | null
  publicReports: number
  userReports: number
  founderReports: number
  operatorReports: number
  artifactCount: number
}

export type ProjectMemberWorkflowReader = {
  getProjectReportingStatus(
    input: { projectSlug: string; cycleKey?: string },
    auth: McpAuthContext,
  ): Promise<ProjectMemberReportingStatus>
}

export type OperatorWorkflowReader = {
  listCycleStatuses(auth: McpAuthContext): Promise<OperatorCycleStatus[]>
  listCycleEvents(input: { cycleKey?: string; attemptId?: string }, auth: McpAuthContext): Promise<OperatorCycleEvent[]>
  getReconciliationVisibility(auth: McpAuthContext): Promise<OperatorReconciliationVisibility>
  getReportingCoverage(input: { cycleKey?: string }, auth: McpAuthContext): Promise<OperatorReportingCoverage>
}

type SupabaseRestClientConfig = {
  supabaseUrl: string
  anonKey: string
}

function encodeFilter(value: string) {
  return encodeURIComponent(value)
}

function asArray<T>(value: T[] | null | undefined): T[] {
  return Array.isArray(value) ? value : []
}

class SupabaseRestReader {
  constructor(protected readonly config: SupabaseRestClientConfig) {}

  protected async request<T>(path: string, auth: McpAuthContext): Promise<T> {
    const response = await fetch(`${this.config.supabaseUrl}/rest/v1/${path}`, {
      headers: {
        authorization: `Bearer ${auth.bearerToken}`,
        apikey: this.config.anonKey,
        accept: "application/json",
      },
    })

    if (!response.ok) {
      throw new Error(`Supabase read failed with HTTP ${response.status}.`)
    }

    return (await response.json()) as T
  }
}

export class SupabaseProjectMemberWorkflowReader extends SupabaseRestReader implements ProjectMemberWorkflowReader {
  async getProjectReportingStatus(
    input: { projectSlug: string; cycleKey?: string },
    auth: McpAuthContext,
  ): Promise<ProjectMemberReportingStatus> {
    const projectRows = await this.request<Array<{ id: number; slug: string }>>(
      `projects?select=id,slug&slug=eq.${encodeFilter(input.projectSlug)}&limit=1`,
      auth,
    )
    const project = projectRows[0]
    if (!project) throw new Error("Project not found or not visible to this actor.")

    const cycleRows = input.cycleKey
      ? await this.request<Array<{ id: number; cycle_key: string }>>(
          `monthly_cycles?select=id,cycle_key&cycle_key=eq.${encodeFilter(input.cycleKey)}&limit=1`,
          auth,
        )
      : await this.request<Array<{ id: number; cycle_key: string }>>(
          "monthly_cycles?select=id,cycle_key&order=period_start.desc&limit=1",
          auth,
        )
    const cycle = cycleRows[0] ?? null
    const cycleFilter = cycle ? `&monthly_cycle_id=eq.${cycle.id}` : ""

    const [reports, datasets] = await Promise.all([
      this.request<Array<{ audience: string; artifact_path: string | null }>>(
        `monthly_cycle_reports?select=audience,artifact_path&subject_project_id=eq.${project.id}${cycleFilter}`,
        auth,
      ),
      this.request<Array<{ status: string }>>(`zkas_datasets?select=status&project_id=eq.${project.id}${cycleFilter}`, auth),
    ])

    return {
      projectSlug: project.slug,
      cycleKey: cycle?.cycle_key ?? null,
      reports: {
        founderReportCount: reports.filter((report) => report.audience === "founder").length,
        artifactCount: reports.filter((report) => report.artifact_path).length,
      },
      attribution: {
        approvedDatasetCount: datasets.filter((dataset) => ["approved", "included"].includes(dataset.status)).length,
        pendingDatasetCount: datasets.filter((dataset) => !["approved", "included"].includes(dataset.status)).length,
      },
    }
  }
}

export class SupabaseOperatorWorkflowReader extends SupabaseRestReader implements OperatorWorkflowReader {
  async listCycleStatuses(auth: McpAuthContext): Promise<OperatorCycleStatus[]> {
    const rows = await this.request<
      Array<{
        cycle_key: string
        status: string
        locked_at: string | null
        calculation_started_at: string | null
        distribution_started_at: string | null
        reporting_published_at: string | null
      }>
    >("monthly_cycles?select=cycle_key,status,locked_at,calculation_started_at,distribution_started_at,reporting_published_at&order=period_start.desc&limit=12", auth)

    return rows.map((row) => ({
      cycleKey: row.cycle_key,
      status: row.status,
      lockedAt: row.locked_at,
      calculationStartedAt: row.calculation_started_at,
      distributionStartedAt: row.distribution_started_at,
      reportingPublishedAt: row.reporting_published_at,
    }))
  }

  async listCycleEvents(input: { cycleKey?: string; attemptId?: string }, auth: McpAuthContext): Promise<OperatorCycleEvent[]> {
    const filters = [
      "select=cycle_key,event_type,outcome,severity,attempt_id,message,created_at",
      "order=created_at.desc",
      "limit=50",
      input.cycleKey ? `cycle_key=eq.${encodeFilter(input.cycleKey)}` : null,
      input.attemptId ? `attempt_id=eq.${encodeFilter(input.attemptId)}` : null,
    ].filter(Boolean)
    const rows = await this.request<
      Array<{
        cycle_key: string
        event_type: string
        outcome: string
        severity: string
        attempt_id: string
        message: string | null
        created_at: string
      }>
    >(`monthly_cycle_events?${filters.join("&")}`, auth)

    return rows.map((row) => ({
      cycleKey: row.cycle_key,
      eventType: row.event_type,
      outcome: row.outcome,
      severity: row.severity,
      attemptId: row.attempt_id,
      message: row.message,
      createdAt: row.created_at,
    }))
  }

  async getReconciliationVisibility(auth: McpAuthContext): Promise<OperatorReconciliationVisibility> {
    const rows = await this.request<Array<{ status: string }>>(
      "onchain_payment_submissions?select=status&order=created_at.desc&limit=500",
      auth,
    )

    return {
      submitted: rows.filter((row) => row.status === "submitted").length,
      confirming: rows.filter((row) => row.status === "confirming").length,
      awaitingConfirmation: rows.filter((row) => row.status === "awaiting_confirmation").length,
      confirmed: rows.filter((row) => row.status === "confirmed").length,
      failed: rows.filter((row) => row.status === "failed").length,
    }
  }

  async getReportingCoverage(input: { cycleKey?: string }, auth: McpAuthContext): Promise<OperatorReportingCoverage> {
    const cycleRows = input.cycleKey
      ? await this.request<Array<{ id: number; cycle_key: string }>>(
          `monthly_cycles?select=id,cycle_key&cycle_key=eq.${encodeFilter(input.cycleKey)}&limit=1`,
          auth,
        )
      : []
    const cycle = cycleRows[0] ?? null
    const cycleFilter = cycle ? `&monthly_cycle_id=eq.${cycle.id}` : ""
    const reports = await this.request<Array<{ audience: string; artifact_path: string | null }>>(
      `monthly_cycle_reports?select=audience,artifact_path${cycleFilter}`,
      auth,
    )

    return {
      cycleKey: cycle?.cycle_key ?? input.cycleKey ?? null,
      publicReports: reports.filter((report) => report.audience === "public").length,
      userReports: reports.filter((report) => report.audience === "user").length,
      founderReports: reports.filter((report) => report.audience === "founder").length,
      operatorReports: reports.filter((report) => report.audience === "operator").length,
      artifactCount: reports.filter((report) => report.artifact_path).length,
    }
  }
}

export function createSupabaseProjectMemberWorkflowReader(env: Record<string, string | undefined> = process.env) {
  return new SupabaseProjectMemberWorkflowReader(readSupabaseRestClientConfig(env))
}

export function createSupabaseOperatorWorkflowReader(env: Record<string, string | undefined> = process.env) {
  return new SupabaseOperatorWorkflowReader(readSupabaseRestClientConfig(env))
}

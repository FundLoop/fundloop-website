import type { McpAuthContext } from "./auth.ts"

export type FounderManagedProjectSummary = {
  id: number
  slug: string | null
  name: string
}

export type FounderProjectCycleStatus = {
  project: FounderManagedProjectSummary
  cycle: {
    cycleKey: string | null
    status: string | null
  }
  payments: {
    count: number
    confirmedCount: number
    awaitingConfirmationCount: number
    totalContributionAmount: number
  }
  routes: {
    enabledCount: number
    defaultCount: number
  }
}

export type FounderWorkflowReader = {
  listManagedProjects(auth: McpAuthContext): Promise<FounderManagedProjectSummary[]>
  getProjectCycleStatus(input: { projectSlug: string; cycleKey?: string }, auth: McpAuthContext): Promise<FounderProjectCycleStatus>
}

type SupabaseRestClientConfig = {
  supabaseUrl: string
  anonKey: string
}

type ProjectRow = {
  id: number
  slug: string | null
  name: string | null
}

type ParticipantProjectRow = {
  projects: ProjectRow | ProjectRow[] | null
}

function asArray<T>(value: T[] | null | undefined): T[] {
  return Array.isArray(value) ? value : []
}

function readProject(value: ProjectRow | ProjectRow[] | null | undefined) {
  return Array.isArray(value) ? (value[0] ?? null) : (value ?? null)
}

function normalizeProject(project: ProjectRow): FounderManagedProjectSummary {
  return {
    id: project.id,
    slug: project.slug,
    name: project.name ?? project.slug ?? `Project ${project.id}`,
  }
}

export function readSupabaseRestClientConfig(env: Record<string, string | undefined> = process.env): SupabaseRestClientConfig {
  const supabaseUrl = env.NEXT_PUBLIC_SUPABASE_URL ?? env.SUPABASE_URL
  const anonKey = env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? env.SUPABASE_ANON_KEY
  if (!supabaseUrl?.trim()) throw new Error("NEXT_PUBLIC_SUPABASE_URL or SUPABASE_URL is required for MCP reads.")
  if (!anonKey?.trim()) throw new Error("NEXT_PUBLIC_SUPABASE_ANON_KEY or SUPABASE_ANON_KEY is required for MCP reads.")

  return {
    supabaseUrl: supabaseUrl.replace(/\/$/, ""),
    anonKey: anonKey.trim(),
  }
}

export class SupabaseFounderWorkflowReader implements FounderWorkflowReader {
  constructor(private readonly config: SupabaseRestClientConfig) {}

  private async request<T>(path: string, auth: McpAuthContext): Promise<T> {
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

  async listManagedProjects(auth: McpAuthContext): Promise<FounderManagedProjectSummary[]> {
    const rows = await this.request<ParticipantProjectRow[]>(
      "participants?select=projects(id,slug,name)&is_admin=eq.true&projects.status=eq.active",
      auth,
    )

    return asArray(rows)
      .map((row) => readProject(row.projects))
      .filter((project): project is ProjectRow => Boolean(project?.id))
      .map(normalizeProject)
  }

  async getProjectCycleStatus(
    input: { projectSlug: string; cycleKey?: string },
    auth: McpAuthContext,
  ): Promise<FounderProjectCycleStatus> {
    const projectRows = await this.request<ProjectRow[]>(
      `projects?select=id,slug,name&slug=eq.${encodeURIComponent(input.projectSlug)}&limit=1`,
      auth,
    )
    const project = projectRows[0]
    if (!project) {
      throw new Error("Project not found or not visible to this actor.")
    }

    const cyclePath = input.cycleKey
      ? `monthly_cycles?select=id,cycle_key,status&cycle_key=eq.${encodeURIComponent(input.cycleKey)}&limit=1`
      : "monthly_cycles?select=id,cycle_key,status&order=period_start.desc&limit=1"
    const cycleRows = await this.request<Array<{ id: number; cycle_key: string; status: string }>>(cyclePath, auth)
    const cycle = cycleRows[0] ?? null
    const cycleFilter = cycle ? `&monthly_cycle_id=eq.${cycle.id}` : ""

    const [payments, routes] = await Promise.all([
      this.request<Array<{ payment_amount: number; ref_payment_statuses: { code: string } | null }>>(
        `payments?select=payment_amount,ref_payment_statuses(code)&project_id=eq.${project.id}${cycleFilter}`,
        auth,
      ),
      this.request<Array<{ is_enabled: boolean; is_default: boolean }>>(
        `project_crypto_payment_methods?select=is_enabled,is_default&project_id=eq.${project.id}`,
        auth,
      ),
    ])

    return {
      project: normalizeProject(project),
      cycle: {
        cycleKey: cycle?.cycle_key ?? null,
        status: cycle?.status ?? null,
      },
      payments: {
        count: payments.length,
        confirmedCount: payments.filter((payment) => payment.ref_payment_statuses?.code === "confirmed").length,
        awaitingConfirmationCount: payments.filter((payment) => payment.ref_payment_statuses?.code === "awaiting_confirmation").length,
        totalContributionAmount: payments.reduce((sum, payment) => sum + Number(payment.payment_amount ?? 0), 0),
      },
      routes: {
        enabledCount: routes.filter((route) => route.is_enabled).length,
        defaultCount: routes.filter((route) => route.is_default).length,
      },
    }
  }
}

export function createSupabaseFounderWorkflowReader(env: Record<string, string | undefined> = process.env) {
  return new SupabaseFounderWorkflowReader(readSupabaseRestClientConfig(env))
}

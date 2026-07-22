import type { SupabaseClient } from "@supabase/supabase-js"
import type { Database } from "../../types/supabase.ts"
import type {
  ProjectMonthlyContributionSubmissionSummary,
  ProjectMonthlyContributionSubmitCommandInput,
} from "../edge-functions/project-monthly-contribution-submit-contract.ts"

type ProjectRow = {
  id: number
  slug: string
  name: string
  organization_id: number | null
  payment_percentage: number | null
}

type RoleReferenceRow = {
  id: number
}

type ParticipantAccessRow = {
  id: number
  is_admin: boolean | null
}

type MonthlyCycleRow = {
  id: number
  cycle_key: string
  period_start: string
  period_end: string
  status: string
}

type SubmissionRow = {
  id: number
  project_id: number
  monthly_cycle_id: number
  period_start: string
  period_end: string
  source_currency_code: string
  source_amount: number
  usd_equivalent_amount: number
  commitment_percentage: number
  calculated_contribution_amount: number
  source_reference: string | null
  notes: string | null
  status: string
  submitted_by_user_id: string | null
  submitted_at: string
  updated_at: string
  projects: { slug: string | null } | { slug: string | null }[] | null
  monthly_cycles: { cycle_key: string | null } | { cycle_key: string | null }[] | null
}

export type ProjectMonthlyContributionCommandInput = ProjectMonthlyContributionSubmitCommandInput & {
  actorUserId: string
}

export type ProjectMonthlyContributionCommandFailureCode =
  | "project_not_found"
  | "permission_denied"
  | "cycle_not_found"
  | "cycle_not_open"
  | "period_mismatch"
  | "commitment_missing"
  | "commitment_mismatch"
  | "reference_data_unavailable"
  | "submission_failed"

export type ProjectMonthlyContributionCommandResult =
  | {
      ok: true
      data: ProjectMonthlyContributionSubmissionSummary
    }
  | {
      ok: false
      error: {
        code: ProjectMonthlyContributionCommandFailureCode
        message: string
        projectId: number | null
        cycleId: number | null
      }
    }

type CommandFailure = Extract<ProjectMonthlyContributionCommandResult, { ok: false }>

function commandFailure(
  code: ProjectMonthlyContributionCommandFailureCode,
  message: string,
  context: { projectId?: number | null; cycleId?: number | null } = {},
): CommandFailure {
  return {
    ok: false,
    error: {
      code,
      message,
      projectId: context.projectId ?? null,
      cycleId: context.cycleId ?? null,
    },
  }
}

function relationOne<T>(value: T | T[] | null | undefined): T | null {
  return Array.isArray(value) ? (value[0] ?? null) : (value ?? null)
}

function numberValue(value: number | string | null | undefined) {
  return Number(value ?? 0)
}

function toDateOnly(value: string) {
  return value.slice(0, 10)
}

function roundMoney(value: number) {
  return Math.round((value + Number.EPSILON) * 100) / 100
}

function mapSubmission(row: SubmissionRow): ProjectMonthlyContributionSubmissionSummary {
  return {
    id: row.id,
    projectId: row.project_id,
    projectSlug: relationOne(row.projects)?.slug ?? "",
    cycleId: row.monthly_cycle_id,
    cycleKey: relationOne(row.monthly_cycles)?.cycle_key ?? "",
    periodStart: toDateOnly(row.period_start),
    periodEnd: toDateOnly(row.period_end),
    sourceCurrency: row.source_currency_code,
    sourceAmount: numberValue(row.source_amount),
    usdEquivalentAmount: numberValue(row.usd_equivalent_amount),
    commitmentPercentage: numberValue(row.commitment_percentage),
    calculatedContributionAmount: numberValue(row.calculated_contribution_amount),
    sourceReference: row.source_reference,
    notes: row.notes,
    status: "submitted",
    submittedByUserId: row.submitted_by_user_id,
    submittedAt: row.submitted_at,
    updatedAt: row.updated_at,
  }
}

async function resolveProject(
  supabase: SupabaseClient<Database>,
  projectSlug: string,
): Promise<{ ok: true; data: ProjectRow } | CommandFailure> {
  const { data: project, error } = await supabase
    .from("projects")
    .select("id, slug, name, organization_id, payment_percentage")
    .eq("slug", projectSlug)
    .maybeSingle()

  if (error || !project) {
    return commandFailure("project_not_found", error?.message ?? "Project not found.")
  }

  return { ok: true, data: project as ProjectRow }
}

async function assertProjectContributorAccess(
  supabase: SupabaseClient<Database>,
  actorUserId: string,
  project: ProjectRow,
): Promise<{ ok: true } | CommandFailure> {
  const { data: participant, error: participantError } = await supabase
    .from("participants")
    .select("id, is_admin")
    .eq("project_id", project.id)
    .eq("user_id", actorUserId)
    .eq("is_admin", true)
    .maybeSingle()

  if (participantError) {
    return commandFailure("reference_data_unavailable", participantError.message, { projectId: project.id })
  }

  if ((participant as ParticipantAccessRow | null)?.id) return { ok: true }

  const { data: adminRoles, error: adminRolesError } = await supabase.from("ref_roles").select("id").in("name", ["Founder", "Admin"])
  if (adminRolesError) {
    return commandFailure("reference_data_unavailable", adminRolesError.message, { projectId: project.id })
  }

  const adminRoleIds = ((adminRoles as RoleReferenceRow[] | null) ?? []).map((role) => role.id)
  if (project.organization_id && adminRoleIds.length > 0) {
    const { data: membership, error: membershipError } = await supabase
      .from("organization_members")
      .select("id")
      .eq("organization_id", project.organization_id)
      .eq("user_id", actorUserId)
      .eq("status", "active")
      .in("role_id", adminRoleIds)
      .maybeSingle()

    if (membershipError) {
      return commandFailure("reference_data_unavailable", membershipError.message, { projectId: project.id })
    }

    if (membership?.id) return { ok: true }
  }

  return commandFailure("permission_denied", "You do not have permission to submit contributions for this project.", {
    projectId: project.id,
  })
}

async function resolveOpenCycle(
  supabase: SupabaseClient<Database>,
  cycleKey: string,
  projectId: number,
): Promise<{ ok: true; data: MonthlyCycleRow } | CommandFailure> {
  const { data: cycle, error } = await supabase
    .from("monthly_cycles")
    .select("id, cycle_key, period_start, period_end, status")
    .eq("cycle_key", cycleKey)
    .maybeSingle()

  if (error || !cycle) {
    return commandFailure("cycle_not_found", error?.message ?? "Monthly cycle not found.", { projectId })
  }

  const typedCycle = cycle as MonthlyCycleRow
  if (typedCycle.status !== "open") {
    return commandFailure("cycle_not_open", "Monthly contribution submissions can only be changed while the cycle is open.", {
      projectId,
      cycleId: typedCycle.id,
    })
  }

  return { ok: true, data: typedCycle }
}

export async function executeProjectMonthlyContributionSubmitCommand(
  supabase: SupabaseClient<Database>,
  input: ProjectMonthlyContributionCommandInput,
): Promise<ProjectMonthlyContributionCommandResult> {
  const projectResult = await resolveProject(supabase, input.projectSlug)
  if (!projectResult.ok) return projectResult

  const project = projectResult.data
  const accessResult = await assertProjectContributorAccess(supabase, input.actorUserId, project)
  if (!accessResult.ok) return accessResult

  if (project.payment_percentage === null) {
    return commandFailure("commitment_missing", "Project contribution commitment is missing.", { projectId: project.id })
  }

  if (Number(project.payment_percentage) !== input.commitmentPercentage) {
    return commandFailure("commitment_mismatch", "Submitted commitment percentage must match the project's current commitment.", {
      projectId: project.id,
    })
  }

  const cycleResult = await resolveOpenCycle(supabase, input.cycleKey, project.id)
  if (!cycleResult.ok) return cycleResult
  const cycle = cycleResult.data

  if (toDateOnly(cycle.period_start) !== input.periodStart || toDateOnly(cycle.period_end) !== input.periodEnd) {
    return commandFailure("period_mismatch", "Contribution period must match the monthly cycle bounds.", {
      projectId: project.id,
      cycleId: cycle.id,
    })
  }

  const serverCalculatedContributionAmount = roundMoney(input.usdEquivalentAmount * (input.commitmentPercentage / 100))
  const { data, error } = await supabase
    .from("project_monthly_contribution_submissions")
    .upsert(
      {
        project_id: project.id,
        monthly_cycle_id: cycle.id,
        period_start: input.periodStart,
        period_end: input.periodEnd,
        source_currency_code: input.sourceCurrency,
        source_amount: input.sourceAmount,
        usd_equivalent_amount: input.usdEquivalentAmount,
        commitment_percentage: input.commitmentPercentage,
        calculated_contribution_amount: serverCalculatedContributionAmount,
        source_reference: input.sourceReference ?? null,
        notes: input.notes ?? null,
        status: "submitted",
        submitted_by_user_id: input.actorUserId,
        submitted_at: new Date().toISOString(),
      },
      { onConflict: "project_id,monthly_cycle_id" },
    )
    .select(
      `
      id,
      project_id,
      monthly_cycle_id,
      period_start,
      period_end,
      source_currency_code,
      source_amount,
      usd_equivalent_amount,
      commitment_percentage,
      calculated_contribution_amount,
      source_reference,
      notes,
      status,
      submitted_by_user_id,
      submitted_at,
      updated_at,
      projects(slug),
      monthly_cycles(cycle_key)
    `,
    )
    .single()

  if (error || !data) {
    return commandFailure("submission_failed", error?.message ?? "Contribution submission could not be saved.", {
      projectId: project.id,
      cycleId: cycle.id,
    })
  }

  return {
    ok: true,
    data: mapSubmission(data as SubmissionRow),
  }
}
